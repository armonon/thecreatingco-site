"""Provider adapters, provider health (cooldowns), fallback execution, and per-call telemetry.

OpenAI -> `openclaw infer model run` (ChatGPT/Codex OAuth held by the Gateway; no keys touched here)

Both are subprocesses so credentials never enter this process.
"""
import json
import re
import subprocess
import time

from .db import now_iso, today, event
from .router import provider_of

ERROR_PATTERNS = [
    ("credit", r"credit balance|billing|insufficient_quota|payment"),
    ("quota", r"usage limit|quota|limit reached|exceeded your|cooldown"),
    ("rate_limit", r"rate.?limit|429|too many requests|overloaded|529"),
    ("auth", r"unauthori[sz]ed|401|403|invalid.*(api key|token)|auth(entication)? (failed|error)|not logged in|login"),
    ("network", r"ENOTFOUND|ECONNRE|timed? ?out|network|socket"),
]


class ProviderError(Exception):
    def __init__(self, kind, message):
        super().__init__(message)
        self.kind = kind


def classify_error(text):
    t = (text or "").lower()
    for kind, pat in ERROR_PATTERNS:
        if re.search(pat, t, re.I):
            return kind
    return "unknown"


def est_tokens(chars):
    return max(1, int(chars / 4))


# ---------------------------------------------------------------- adapters

def call_openai(model, system, user, reasoning, timeout=600):
    """One-shot through the Gateway's OpenAI auth. Static system text is sent first so the prefix caches."""
    mid = model
    level = "low" if reasoning in ("none", "minimal") else reasoning
    prompt = f"{system}\n\n---\n\n{user}"
    t0 = time.time()
    p = subprocess.run(["openclaw", "infer", "model", "run", "--model", mid, "--thinking", level,
                        "--json", "--prompt", prompt],
                       capture_output=True, text=True, timeout=timeout)
    latency = int((time.time() - t0) * 1000)
    out = p.stdout.strip()
    data = None
    i = out.find("{")
    if i >= 0:
        try:
            data = json.loads(out[i:])
        except json.JSONDecodeError:
            data = None
    if not data or not data.get("ok"):
        msg = (data or {}).get("error", {}).get("message") if data else (p.stderr[-800:] or out[-800:])
        raise ProviderError(classify_error(msg), msg or "openai call failed")
    text = "".join(o.get("text") or "" for o in data.get("outputs", []))
    usage = data.get("usage") or {}
    return {
        "text": text, "latency_ms": latency,
        "input_tokens": usage.get("input_tokens") or est_tokens(len(prompt)),
        "output_tokens": usage.get("output_tokens") or est_tokens(len(text)),
        "cached_tokens": usage.get("cached_tokens") or 0,
        "tokens_estimated": 0 if usage else 1, "cost": None,
    }


ADAPTERS = {"openai": call_openai}


# ---------------------------------------------------------------- health

PROVIDER_WIDE = ("credit", "auth")   # account-level: cool the whole provider
# quota / rate_limit / network cool only the model that hit it (e.g. an Opus weekly cap leaves Sonnet usable)


def _key_ok(conn, key):
    r = conn.execute("SELECT status, until FROM provider_health WHERE provider=?", (key,)).fetchone()
    return not r or r["status"] == "ok" or (r["until"] or 0) <= time.time()


def provider_available(conn, model_or_provider):
    """True if neither the provider nor (when given a model id) that model is cooling down."""
    prov = provider_of(model_or_provider) if "/" in model_or_provider else model_or_provider
    return _key_ok(conn, prov) and ("/" not in model_or_provider or _key_ok(conn, model_or_provider))


def mark_failure(conn, provider, kind, message, cfg):
    r = conn.execute("SELECT failures FROM provider_health WHERE provider=?", (provider,)).fetchone()
    failures = (r["failures"] if r else 0) + 1
    spec = cfg["provider_cooldowns_minutes"].get(kind, cfg["provider_cooldowns_minutes"]["unknown"])
    minutes = spec[min(failures, len(spec)) - 1] if isinstance(spec, list) else spec
    until = time.time() + minutes * 60
    conn.execute("INSERT INTO provider_health(provider,status,reason,until,failures,updated_at) VALUES (?,?,?,?,?,?) "
                 "ON CONFLICT(provider) DO UPDATE SET status=excluded.status, reason=excluded.reason, "
                 "until=excluded.until, failures=excluded.failures, updated_at=excluded.updated_at",
                 (provider, f"cooldown:{kind}", (message or "")[:300], until, failures, now_iso()))
    event(conn, "provider_cooldown", {"provider": provider, "kind": kind, "minutes": minutes})


def mark_ok(conn, provider):
    """provider may be a provider id or a model id (per-model cooldown key)."""
    conn.execute("INSERT INTO provider_health(provider,status,reason,until,failures,updated_at) VALUES (?,?,?,?,?,?) "
                 "ON CONFLICT(provider) DO UPDATE SET status='ok', reason=NULL, until=NULL, failures=0, updated_at=excluded.updated_at",
                 (provider, "ok", None, None, 0, now_iso()))


# ---------------------------------------------------------------- telemetry

def price(cfg, model, inp, cached, out):
    p = cfg["prices_per_mtok"].get(model)
    if not p:
        return None  # Unknown rate is not a measured zero-cost model call.
    return round((max(inp - cached, 0) * p["in"] + cached * p["cached"] + out * p["out"]) / 1e6, 6)


def record_call(conn, cfg, *, model, role, task, res=None, ok=True, error_kind=None, retry=0, prompt_chars=0, reasoning=None):
    res = res or {}
    inp, out, cached = res.get("input_tokens", 0), res.get("output_tokens", 0), res.get("cached_tokens", 0)
    cost = res.get("cost")
    if cost is None:
        cost = price(cfg, model, inp, cached, out) if ok else 0.0
    conn.execute(
        "INSERT INTO model_calls(ts,day,provider,model,role,task_id,campaign_id,task_type,input_tokens,output_tokens,"
        "cached_tokens,est_cost,latency_ms,ok,error_kind,retry,tokens_estimated,prompt_chars,reasoning) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (now_iso(), today(), provider_of(model), model, role, task.get("task_id"), task.get("campaign_id"),
         task.get("task_type"), inp, out, cached, cost, res.get("latency_ms", 0), 1 if ok else 0, error_kind,
         retry, res.get("tokens_estimated", 0), prompt_chars, reasoning))


# ---------------------------------------------------------------- fallback execution

def call_with_fallback(conn, cfg, chain, role, system, user, reasoning, task, adapters=None):
    """Walk the chain, skipping providers in cooldown. Never hammers a failed provider.

    Returns (result_dict, model_used). Raises ProviderError('all_unavailable') when nothing is reachable.
    """
    adapters = adapters or ADAPTERS
    # Luna gets at most two attempts; strategy/innovation gets one. Other
    # legacy roles inherit Luna's bounded retry budget unless explicitly set.
    retries_by_role = cfg["loop_limits"].get("retries_by_role", {})
    max_retries = retries_by_role.get(role, cfg["loop_limits"].get("max_provider_retries", 0))
    tried = []
    for model in chain:
        prov = provider_of(model)
        if not provider_available(conn, model):
            tried.append(f"{model}:cooldown")
            continue
        previous_kind = None
        for attempt in range(max_retries + 1):
            try:
                res = adapters[prov](model, system, user, reasoning)
                record_call(conn, cfg, model=model, role=role, task=task, res=res, retry=attempt,
                            prompt_chars=len(system) + len(user), reasoning=reasoning)
                mark_ok(conn, prov)
                mark_ok(conn, model)
                return res, model
            except ProviderError as e:
                record_call(conn, cfg, model=model, role=role, task=task, ok=False, error_kind=e.kind,
                            retry=attempt, prompt_chars=len(system) + len(user), reasoning=reasoning)
                tried.append(f"{model}:{e.kind}")
                if attempt and e.kind != previous_kind:
                    break  # retry only an identical failure once
                previous_kind = e.kind
                if e.kind in PROVIDER_WIDE:
                    mark_failure(conn, prov, e.kind, str(e), cfg)
                    break
                if e.kind == "quota":
                    mark_failure(conn, model, e.kind, str(e), cfg)
                    break
                if e.kind == "unknown" and "model" in str(e).lower() and "not" in str(e).lower():
                    break  # model-specific (e.g. not in catalog): try next model, same provider ok
                if attempt >= max_retries:
                    mark_failure(conn, model, e.kind, str(e), cfg)
                    break
                time.sleep(min(2 ** attempt, 8) if adapters is ADAPTERS else 0)
            except subprocess.TimeoutExpired:
                record_call(conn, cfg, model=model, role=role, task=task, ok=False, error_kind="network",
                            retry=attempt, prompt_chars=len(system) + len(user), reasoning=reasoning)
                tried.append(f"{model}:timeout")
                mark_failure(conn, model, "network", "timeout", cfg)
                break
        # cooled providers/models are skipped by the availability check above — never hammered
    raise ProviderError("all_unavailable", "; ".join(tried))
