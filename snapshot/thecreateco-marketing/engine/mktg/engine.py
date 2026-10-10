"""Task queue + autonomous loop.

LOAD STATE -> recover stale -> pick highest-value unblocked task -> route -> minimal context -> execute
-> validate -> persist -> follow-ups/reviews -> next.  The expensive models are never asked "what next?" per action.
"""
import json
import os
import re
import subprocess
import time

from . import memory, prompts
from .db import now_iso, today, new_id, event, ENGINE_DIR
from .providers import call_with_fallback, ProviderError
from .router import route

TERMINAL = ("COMPLETE", "FAILED", "BLOCKED")
STRATEGY_REPEAT_GUARD = ("next_actions", "prioritize", "performance_analysis", "campaign_plan")
BANNED = re.compile(r"\b(revolutionary|cutting-edge|game-changer|thrilled to announce|unlock|elevate|seamless)\b", re.I)
RESULTS_DIR = os.path.join(ENGINE_DIR, "results")


# ---------------------------------------------------------------- campaigns

def ensure_campaign(conn, campaign_id, name=None, product=None, tier="normal", goal=None):
    if not campaign_id:
        return None
    r = conn.execute("SELECT * FROM campaigns WHERE campaign_id=?", (campaign_id,)).fetchone()
    if r:
        return dict(r)
    conn.execute("INSERT INTO campaigns(campaign_id,name,product,tier,goal,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                 (campaign_id, name or campaign_id, product, tier, goal, now_iso(), now_iso()))
    return dict(conn.execute("SELECT * FROM campaigns WHERE campaign_id=?", (campaign_id,)).fetchone())


def get_campaign(conn, campaign_id):
    if not campaign_id:
        return None
    r = conn.execute("SELECT * FROM campaigns WHERE campaign_id=?", (campaign_id,)).fetchone()
    return dict(r) if r else None


# ---------------------------------------------------------------- queue

def enqueue(conn, cfg, task_type, title, payload=None, *, campaign_id=None, priority=50, importance=1, creativity=0,
            complexity=1, risk=0, dependencies=None, parent_id=None, review_level="none", tool_budget=None):
    payload = payload or {}
    # don't queue the same open task twice (busywork guard)
    dup = conn.execute("SELECT task_id FROM tasks WHERE task_type=? AND title=? AND COALESCE(campaign_id,'')=COALESCE(?, '') "
                       "AND status NOT IN ('COMPLETE','FAILED','BLOCKED')", (task_type, title, campaign_id)).fetchone()
    if dup:
        return dup["task_id"]
    task = {"task_type": task_type, "importance": importance, "creativity": creativity, "complexity": complexity,
            "risk": risk, "payload": payload}
    r = route(task, cfg, get_campaign(conn, campaign_id))
    tid = new_id("task")
    ll = cfg["loop_limits"]
    tb = tool_budget if tool_budget is not None else min(len(payload.get("urls", [])), ll["max_simple_page_reads"])
    conn.execute(
        "INSERT INTO tasks(task_id,campaign_id,task_type,title,payload,priority,status,role,preferred_model,fallback_model,"
        "complexity,creativity,importance,risk,token_budget,tool_budget,reasoning,dependencies,parent_id,review_level,created_at) "
        "VALUES (?,?,?,?,?,?,'QUEUED',?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (tid, campaign_id, task_type, title, json.dumps(payload), priority, r["role"], r["preferred_model"],
         r["fallback_model"], complexity, creativity, importance, risk, r["max_output_tokens"], tb, r["reasoning"],
         json.dumps(dependencies or []), parent_id, review_level, now_iso()))
    return tid


def recover_stale(conn, cfg):
    """RUNNING tasks whose lease expired (crash/restart) go back to QUEUED; nothing else restarts."""
    now = time.time()
    rows = conn.execute("SELECT task_id, retry_count FROM tasks WHERE status='RUNNING' AND (lease_until IS NULL OR lease_until < ?)",
                        (now,)).fetchall()
    for r in rows:
        if r["retry_count"] + 1 > cfg["loop_limits"]["max_model_retries"]:
            conn.execute("UPDATE tasks SET status='FAILED', error='stale lease, retries exhausted', completed_at=? WHERE task_id=?",
                         (now_iso(), r["task_id"]))
        else:
            conn.execute("UPDATE tasks SET status='QUEUED', retry_count=retry_count+1, started_at=NULL, lease_until=NULL, "
                         "error='recovered from stale RUNNING' WHERE task_id=?", (r["task_id"],))
    # WAITING tasks (all providers down) get re-queued once a provider is back; tick() decides
    if rows:
        event(conn, "recovered_stale", {"count": len(rows)})
    return len(rows)


def _deps_state(conn, deps):
    if not deps:
        return "ready"
    rows = conn.execute(f"SELECT status FROM tasks WHERE task_id IN ({','.join('?' * len(deps))})", deps).fetchall()
    st = [r["status"] for r in rows]
    if any(s in ("FAILED", "BLOCKED") for s in st):
        return "blocked"
    if len(st) == len(deps) and all(s == "COMPLETE" for s in st):
        return "ready"
    return "waiting"


def claim_next(conn, cfg, skip=()):
    lease = cfg["loop_limits"]["running_lease_minutes"] * 60
    rows = conn.execute("SELECT * FROM tasks WHERE status IN ('QUEUED','WAITING') ORDER BY priority DESC, created_at").fetchall()
    for r in rows:
        if r["task_id"] in skip:
            continue
        ds = _deps_state(conn, json.loads(r["dependencies"] or "[]"))
        if ds == "blocked":
            conn.execute("UPDATE tasks SET status='BLOCKED', error='dependency failed', completed_at=? WHERE task_id=?",
                         (now_iso(), r["task_id"]))
            continue
        if ds != "ready":
            continue
        cur = conn.execute("UPDATE tasks SET status='RUNNING', started_at=?, lease_until=? WHERE task_id=? AND status IN ('QUEUED','WAITING')",
                           (now_iso(), time.time() + lease, r["task_id"]))
        if cur.rowcount == 1:
            return dict(conn.execute("SELECT * FROM tasks WHERE task_id=?", (r["task_id"],)).fetchone())
    return None


# ---------------------------------------------------------------- tools (deterministic, budgeted)

def _html_to_text(html):
    html = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr)>", "\n", html)
    text = re.sub(r"<[^>]+>", " ", html)
    import html as _h
    text = _h.unescape(text)
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n\n", text)).strip()


def web_fetch(url):
    """Gateway web.fetch when enabled; otherwise a plain stdlib GET (no JS). Failures return '' (data, not crash)."""
    try:
        p = subprocess.run(["openclaw", "infer", "web", "fetch", "--url", url, "--json"], capture_output=True, text=True, timeout=120)
        i = p.stdout.find("{")
        d = json.loads(p.stdout[i:]) if i >= 0 else {}
        if d.get("ok"):
            texts = [o.get("text") or o.get("content") or "" for o in d.get("outputs", [])]
            if any(texts):
                return "\n".join(texts)
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        pass
    import urllib.request
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (thecreateco research; hello@thecreatingco.com)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read(2_000_000).decode(r.headers.get_content_charset() or "utf-8", "replace")
    return _html_to_text(raw) if "<" in raw[:2000] else raw


# ---------------------------------------------------------------- execution

def _upstream(conn, task, max_chars, exclude=()):
    deps = [d for d in json.loads(task["dependencies"] or "[]") if d not in exclude]
    out = []
    per = max_chars // max(len(deps), 1) if deps else 0
    for d in deps:
        r = conn.execute("SELECT r.content, t.task_type, r.role FROM results r JOIN tasks t ON t.task_id=r.task_id WHERE r.task_id=?",
                         (d,)).fetchone()
        if r:
            c = r["content"]
            out.append({"task_type": r["task_type"], "role": r["role"],
                        "content": c if len(c) <= per else c[:per] + "…"})
    return out


def build_prompt(conn, cfg, task, decision, fetcher=None):
    payload = json.loads(task["payload"] or "{}")
    budget = decision["context_chars"]
    role = decision["role"]
    if payload.get("urls") and fetcher is not False:
        fetch = fetcher or web_fetch
        pages = []
        per_page = max(budget // (2 * max(len(payload["urls"]), 1)), 600)
        for url in payload["urls"][: task["tool_budget"] or 0]:
            try:
                pages.append({"url": url, "text": (fetch(url) or "")[:per_page]})
            except Exception as e:  # tool failure is data, not a crash
                pages.append({"url": url, "text": f"(fetch failed: {e})"})
        payload["pages"] = pages
    # workspace files named in the task (e.g. outreach/drafts-2026-10-06.md) are injected deterministically, capped
    from .db import WORKSPACE
    names = list(payload.get("files", [])) + re.findall(r"\b((?:[\w.-]+/)*[\w.-]+\.md)\b", payload.get("instructions", ""))
    files, room = [], budget // 2
    for name in dict.fromkeys(names):
        path = os.path.realpath(os.path.join(WORKSPACE, name))
        if not path.startswith(WORKSPACE + os.sep) or not os.path.isfile(path) or "/engine/" in path:
            continue
        body = open(path).read()[: max(room, 0)]
        if body:
            files.append({"url": f"file:{name}", "text": body})
            room -= len(body)
    payload["pages"] = payload.get("pages", []) + files
    upstream = _upstream(conn, task, budget // 2, payload.get("exclude_upstream", ()))
    used = sum(len(u["content"]) for u in upstream) + sum(len(p["text"]) for p in payload.get("pages", []))
    retrieved = []
    if not payload.get("no_retrieval"):
        retrieved = memory.retrieve(conn, f"{task['title']} {payload.get('instructions', '')}",
                                    product=payload.get("product"), kinds=payload.get("memory_kinds"),
                                    campaign_id=task["campaign_id"], max_chars=max(budget - used, 0), k=6)
    state = None
    if role in ("sol", "consensus") and task["task_type"] in ("next_actions", "prioritize", "campaign_plan", "performance_analysis", "resource_allocation"):
        state = memory.render_state(conn, cfg)[:3000]
    system = prompts.static_prefix(role)
    user = prompts.dynamic_block(task, payload, retrieved, upstream, state)
    if task["task_type"] in ("next_actions", "prioritize") and payload.get("spawn_tasks", True):
        allowed = sorted(t for t, r in cfg["task_types"].items() if r != "opus")
        user += ("\n\nALLOWED TASK TYPES: " + ", ".join(allowed) +
                 "\nThe engine has no send/post tools: every task produces drafts or research for Armon. Max 8 tasks.")
    if task["task_type"] in ("final_review", "alignment_review", "creative_review", "strategy_review"):
        user += "\n\n" + prompts.REVIEW_FORMAT
    return system, user, payload


def validate(task, payload, text):
    problems = []
    if not text.strip():
        problems.append("empty output")
    if payload.get("output") == "json":
        try:
            json.loads(_strip_fence(text))
        except json.JSONDecodeError:
            problems.append("invalid JSON")
    if task["role"] in ("sonnet", "luna") and BANNED.search(text or "") and task["task_type"] not in ("extract", "research_summary"):
        problems.append(f"banned phrase: {BANNED.search(text).group(0)}")
    return problems


def _strip_fence(text):
    t = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", t, re.S)
    return m.group(1) if m else t


def parse_review(text):
    v = re.search(r"VERDICT:\s*(APPROVE_WITH_CHANGES|APPROVE|REJECT)", text or "", re.I)
    c = re.search(r"CONFIDENCE:\s*(\d+)", text or "")
    crit = re.search(r"CRITICAL ISSUES:\s*(.*?)(?:RECOMMENDED CHANGES:|$)", text or "", re.S)
    chg = re.search(r"RECOMMENDED CHANGES:\s*(.*)$", text or "", re.S)
    return {"verdict": (v.group(1).upper() if v else "APPROVE_WITH_CHANGES"),
            "confidence": int(c.group(1)) if c else 50,
            "critical": (crit.group(1).strip() if crit else ""), "changes": (chg.group(1).strip() if chg else "")}


def _persist(conn, task, role, model, text, meta=None):
    day_dir = os.path.join(RESULTS_DIR, today())
    os.makedirs(day_dir, exist_ok=True)
    path = os.path.join(day_dir, f"{task['task_id']}.md")
    with open(path, "w") as f:
        f.write(f"<!-- {task['task_type']} | {role} | {model} | {now_iso()} -->\n# {task['title']}\n\n{text}\n")
    conn.execute("INSERT OR REPLACE INTO results(task_id,role,model,content,meta,created_at) VALUES (?,?,?,?,?,?)",
                 (task["task_id"], role, model, text, json.dumps(meta or {}), now_iso()))
    return path


def _complete(conn, task, model, ref, status="COMPLETE", error=None):
    conn.execute("UPDATE tasks SET status=?, model_used=?, result_reference=?, completed_at=?, lease_until=NULL, error=? WHERE task_id=?",
                 (status, model, ref, now_iso(), error, task["task_id"]))


def _run_review_consensus(conn, cfg, task, system_unused, user, adapters):
    """Independent bounded reviews; model policy overrides legacy role identifiers."""
    out = []
    for index, role in enumerate(("sol", "sonnet")):
        policy = cfg.get("review_policy")
        chain = policy["consensus_chains"][index] if policy else cfg["roles"][role]["chain"]
        if policy and (not chain or any(not model.startswith("openai/") for model in chain)):
            raise ValueError("Owner review policy requires OpenAI-only consensus reviewers")
        res, model = call_with_fallback(conn, cfg, chain, role, prompts.static_prefix("opus"), user, "medium", task, adapters)
        out.append((role, model, res["text"], parse_review(res["text"])))
    verdicts = [o[3]["verdict"] for o in out]
    if all(v == "APPROVE" for v in verdicts):
        final = "APPROVE"
    elif "REJECT" in verdicts and verdicts.count("REJECT") == 2:
        final = "REJECT"
    elif "REJECT" in verdicts:
        final = "APPROVE_WITH_CHANGES"  # split decision: fix the flagged issues rather than restart
    else:
        final = "APPROVE_WITH_CHANGES"
    text = f"VERDICT: {final}\nCONFIDENCE: {min(o[3]['confidence'] for o in out)}\nCRITICAL ISSUES:\n" + \
        "\n".join(f"[{o[0]}] {o[3]['critical']}" for o in out) + "\nRECOMMENDED CHANGES:\n" + \
        "\n".join(f"[{o[0]}] {o[3]['changes']}" for o in out)
    return text, "+".join(o[1] for o in out)


def _after_review(conn, cfg, task, payload, review, reviewer_mode):
    target = payload.get("target_task_id")
    camp = task["campaign_id"]
    conn.execute("INSERT INTO reviews(ts,task_id,target_task_id,campaign_id,reviewer,mode,verdict,confidence,critical,changes) "
                 "VALUES (?,?,?,?,?,?,?,?,?,?)", (now_iso(), task["task_id"], target, camp, task["model_used"] or reviewer_mode,
                                                  reviewer_mode, review["verdict"], review["confidence"], review["critical"], review["changes"]))
    if task["task_type"] != "final_review":
        return
    if review["verdict"] == "APPROVE":
        return
    is_final_check = payload.get("final_check")
    if review["verdict"] == "APPROVE_WITH_CHANGES":
        enqueue(conn, cfg, "apply_changes", f"Apply review changes: {task['title']}",
                {"instructions": "Apply ONLY these review changes to the work and output the finished piece once (no duplicate "
                                 "alternatives). Keep everything else.\nCRITICAL ISSUES:\n" + review["critical"] +
                                 "\nCHANGES:\n" + review["changes"],
                 "product": payload.get("product"), "no_retrieval": True},
                campaign_id=camp, priority=task["priority"] + 1, importance=2, creativity=2,
                dependencies=[target] if target else [], parent_id=task["task_id"])
        return
    # REJECT
    s = enqueue(conn, cfg, "revise_strategy", f"Revise strategy after review: {task['title']}",
                {"instructions": "The independent review rejected this. Issues:\n" + review["critical"] +
                 "\nDecide the minimal strategic correction.", "product": payload.get("product"), "no_retrieval": True},
                campaign_id=camp, priority=task["priority"] + 2, importance=3, complexity=3,
                dependencies=[target] if target else [], parent_id=task["task_id"])
    c = enqueue(conn, cfg, "revise_copy", f"Revise copy after review: {task['title']}",
                {"instructions": "Rewrite the work per the strategic correction.", "product": payload.get("product")},
                campaign_id=camp, priority=task["priority"] + 2, importance=3, creativity=3,
                dependencies=[s] + ([target] if target else []), parent_id=task["task_id"])
    campaign = get_campaign(conn, camp)
    if not is_final_check and campaign and campaign["tier"] == "major":
        enqueue(conn, cfg, "final_review", f"Final check: {task['title']}",
                {"target_task_id": c, "final_check": True, "product": payload.get("product"), "no_retrieval": True},
                campaign_id=camp, priority=task["priority"] + 1, importance=3, complexity=3, dependencies=[c],
                parent_id=task["task_id"])


def _spawn_followups(conn, cfg, task, payload):
    # explicit pipeline: payload.next = [task specs], each depends on this task
    for spec in payload.get("next", []):
        spec = dict(spec)
        enqueue(conn, cfg, spec.pop("task_type"), spec.pop("title"), spec.pop("payload", {}),
                campaign_id=task["campaign_id"], dependencies=[task["task_id"]], parent_id=task["task_id"], **spec)
    lvl = task["review_level"]
    if lvl in ("sol", "opus"):
        a = enqueue(conn, cfg, "alignment_review", f"Strategy alignment: {task['title']}",
                    {"instructions": "Check this work aligns with the campaign strategy and brand. Be brief.",
                     "target_task_id": task["task_id"], "product": payload.get("product"), "no_retrieval": True},
                    campaign_id=task["campaign_id"], priority=task["priority"], importance=2, complexity=2,
                    dependencies=[task["task_id"]], parent_id=task["task_id"])
        if lvl == "opus":
            # Opus sees the underlying work (dependency = original task), not Sol's reasoning
            enqueue(conn, cfg, "final_review", f"Final review: {task['title']}",
                    {"target_task_id": task["task_id"], "product": payload.get("product"), "no_retrieval": True,
                     "exclude_upstream": [a]},
                    campaign_id=task["campaign_id"], priority=task["priority"], importance=3, complexity=3,
                    dependencies=[task["task_id"], a], parent_id=task["task_id"])
    if task["task_type"] in ("next_actions", "prioritize") and payload.get("spawn_tasks", True):
        _spawn_from_plan(conn, cfg, task)


def _spawn_from_plan(conn, cfg, task):
    r = conn.execute("SELECT content FROM results WHERE task_id=?", (task["task_id"],)).fetchone()
    try:
        plan = json.loads(_strip_fence(r["content"]))
    except (json.JSONDecodeError, TypeError):
        return 0
    n = 0
    made = {}  # plan index -> task_id, so items can depend on earlier items via "after": [index, ...]
    for i, t in enumerate((plan.get("tasks") or [])[:10]):
        tt = t.get("task_type")
        if tt not in cfg["task_types"] or cfg["task_types"][tt] == "opus":
            continue  # plans can't summon Opus; reviews come only from review_level
        deps = [made[j] for j in (t.get("after") or []) if isinstance(j, int) and j in made]
        made[i] = enqueue(conn, cfg, tt, (t.get("title") or tt)[:140],
                          {"instructions": t.get("instructions", ""), "product": t.get("product"),
                           **({"urls": [u for u in t["urls"] if isinstance(u, str) and u.startswith("http")][:5]} if t.get("urls") else {})},
                          campaign_id=task["campaign_id"], priority=40 - i, importance=int(t.get("importance", 1)),
                          creativity=int(t.get("creativity", 0)), complexity=int(t.get("complexity", 1)),
                          dependencies=deps, parent_id=task["task_id"])
        n += 1
    return n


def _strategy_repeat_without_new_data(conn, cfg, task):
    if task["task_type"] not in STRATEGY_REPEAT_GUARD:
        return False
    last = conn.execute("SELECT completed_at FROM tasks WHERE task_type=? AND COALESCE(campaign_id,'')=COALESCE(?,'') "
                        "AND status='COMPLETE' AND task_id!=? ORDER BY completed_at DESC LIMIT 1",
                        (task["task_type"], task["campaign_id"], task["task_id"])).fetchone()
    if not last:
        return False
    newer = conn.execute("SELECT COUNT(*) c FROM tasks WHERE status='COMPLETE' AND completed_at>? AND role NOT IN ('sol','opus','consensus') "
                         "AND COALESCE(campaign_id,'')=COALESCE(?,'')", (last["completed_at"], task["campaign_id"])).fetchone()["c"]
    outcomes = conn.execute("SELECT COUNT(*) c FROM outcomes WHERE ts>?", (last["completed_at"],)).fetchone()["c"]
    return newer + outcomes == 0


def execute(conn, cfg, task, adapters=None, fetcher=None):
    payload = json.loads(task["payload"] or "{}")
    if _strategy_repeat_without_new_data(conn, cfg, task):
        _complete(conn, task, None, None, error="skipped: no new data since last reconsideration")
        return "skipped"
    campaign = get_campaign(conn, task["campaign_id"])
    decision = route(dict(task, payload=payload), cfg, campaign)   # re-route at run time (caps may have changed)
    conn.execute("UPDATE tasks SET role=? WHERE task_id=?", (decision["role"], task["task_id"]))
    task = dict(task, role=decision["role"])
    system, user, payload = build_prompt(conn, cfg, task, decision, fetcher)
    try:
        if decision["role"] == "consensus":
            text, model = _run_review_consensus(conn, cfg, task, system, user, adapters)
            mode = "consensus"
        else:
            res, model = call_with_fallback(conn, cfg, decision["chain"], decision["role"], system, user,
                                            decision["reasoning"], task, adapters)
            text, mode = res["text"], decision["role"]
    except ProviderError as e:
        if decision["role"] == "opus":
            # Preserve independent review, but never escape the owner's provider policy.
            try:
                text, model = _run_review_consensus(conn, cfg, task, system, user, adapters)
                mode = "consensus"
            except ProviderError as review_error:
                conn.execute("UPDATE tasks SET status='WAITING', lease_until=NULL, error=? WHERE task_id=?",
                             (str(review_error)[:500], task["task_id"]))
                event(conn, "task_waiting", {"task_id": task["task_id"], "why": str(review_error)[:200]})
                return "waiting"
        else:
            conn.execute("UPDATE tasks SET status='WAITING', lease_until=NULL, error=? WHERE task_id=?", (str(e)[:500], task["task_id"]))
            event(conn, "task_waiting", {"task_id": task["task_id"], "why": str(e)[:200]})
            return "waiting"
    if decision["role"] == "opus" and mode == "opus" and task["campaign_id"]:
        conn.execute("UPDATE campaigns SET opus_reviews_used=opus_reviews_used+1, updated_at=? WHERE campaign_id=?",
                     (now_iso(), task["campaign_id"]))

    problems = validate(task, payload, text)
    if problems and task["rewrite_count"] < cfg["loop_limits"]["max_rewrites"]:
        conn.execute("UPDATE tasks SET rewrite_count=rewrite_count+1 WHERE task_id=?", (task["task_id"],))
        fix_user = user + "\n\nYOUR PREVIOUS ANSWER HAD PROBLEMS: " + "; ".join(problems) + "\nReturn a corrected answer only."
        try:
            res, model = call_with_fallback(conn, cfg, decision["chain"],
                                            decision["role"], system, fix_user, decision["reasoning"], task, adapters)
            text = res["text"]
            problems = validate(task, payload, text)
        except ProviderError:
            pass
    ref = _persist(conn, task, decision["role"], model, text, {"problems": problems, "reasons": decision["reasons"]})
    task["model_used"] = model
    if problems:
        _complete(conn, task, model, ref, status="NEEDS_REVIEW", error="; ".join(problems))
        return "needs_review"
    _complete(conn, task, model, ref)
    if int(task.get("importance") or 0) >= 2 and not task["task_type"].endswith("review"):
        memory.push_state_item(conn, "IMPORTANT RECENT RESULTS",
                               f"{today()} {task['task_type']} ({model.split('/')[-1]}): {task['title'][:90]} → {os.path.relpath(ref, os.path.dirname(ENGINE_DIR))}")
    if payload.get("content_platform"):
        memory.add_content(conn, platform=payload["content_platform"], body=text, campaign_id=task["campaign_id"],
                           topic=payload.get("topic"), cta=payload.get("cta"), model=model, task_id=task["task_id"])
    if task["task_type"] in ("final_review", "alignment_review", "creative_review", "strategy_review"):
        _after_review(conn, cfg, task, payload, parse_review(text), mode)
    _spawn_followups(conn, cfg, task, payload)
    return "complete"


def tick(conn, cfg, max_tasks=None, adapters=None, fetcher=None):
    """One bounded pass of the autonomous loop. Safe to run from a scheduler; resumable after crashes."""
    recover_stale(conn, cfg)
    # WAITING tasks (every provider in their chain cooling down) are retried once per tick; cooled providers aren't called
    n = max_tasks or cfg["loop_limits"]["tasks_per_tick"]
    summary = {"complete": 0, "waiting": 0, "needs_review": 0, "skipped": 0, "failed": 0}
    seen_waiting = set()
    for _ in range(n):
        t = claim_next(conn, cfg, skip=seen_waiting)
        if not t:
            break
        try:
            outcome = execute(conn, cfg, t, adapters, fetcher)
        except Exception as e:  # one bad task never stops the loop
            conn.execute("UPDATE tasks SET status=CASE WHEN retry_count+1>? THEN 'FAILED' ELSE 'QUEUED' END, "
                         "retry_count=retry_count+1, error=?, lease_until=NULL WHERE task_id=?",
                         (cfg["loop_limits"]["max_model_retries"], f"{type(e).__name__}: {e}"[:500], t["task_id"]))
            outcome = "failed"
        if outcome == "waiting":
            seen_waiting.add(t["task_id"])
        summary[outcome] = summary.get(outcome, 0) + 1
    return summary


def plan_daily(conn, cfg, campaign_id=None):
    """Queue at most one Sol planning batch per day (per campaign). Workers execute it; Sol isn't asked again per action."""
    title = f"Daily plan {today()}" + (f" ({campaign_id})" if campaign_id else "")
    if conn.execute("SELECT 1 FROM tasks WHERE title=?", (title,)).fetchone():
        return None
    return enqueue(conn, cfg, "next_actions", title,
                   {"instructions": "Pick today's highest-value marketing batch from the state, blockers and recent results. "
                                    "Skip anything blocked on Armon. Favor work that moves 1,000 qualified founding users.",
                    "output": "json", "memory_kinds": ["learning", "experiment", "result", "campaign", "audience"]},
                   campaign_id=campaign_id, priority=90, importance=2, complexity=3)
