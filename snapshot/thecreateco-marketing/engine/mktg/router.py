"""Deterministic model routing. No model is ever asked which model to use."""
import json
import os

from .db import ENGINE_DIR

CONFIG_PATH = os.environ.get("MKTG_CONFIG", os.path.join(ENGINE_DIR, "config", "routing.json"))
REASONING_ORDER = ["none", "low", "medium", "high", "xhigh", "max"]


def load_config(path=None):
    with open(path or CONFIG_PATH) as f:
        return json.load(f)


def provider_of(model):
    return model.split("/", 1)[0]


def _clamp_level(level, floor, cap):
    i = REASONING_ORDER.index(level)
    i = max(i, REASONING_ORDER.index(floor))
    i = min(i, REASONING_ORDER.index(cap))
    return REASONING_ORDER[i]


def route(task, cfg, campaign=None):
    """Return a routing decision dict for a task row/dict.

    task needs: task_type, complexity, creativity, importance, risk, (optional) payload.allow_max_reasoning.
    """
    ttype = task["task_type"]
    imp = int(task.get("importance") or 0)
    cre = int(task.get("creativity") or 0)
    cx = int(task.get("complexity") or 0)
    role = cfg["task_types"].get(ttype, cfg["default_role"])
    reasons = [f"task_type {ttype} -> {role}"]

    esc = cfg["escalation"]
    # `sonnet` is retained only as a legacy task/telemetry role. Ordinary
    # creative work stays on Luna; Astra is reserved for explicit invention.
    if role == "sonnet":
        role = "luna"
        reasons.append("legacy creative role -> Luna (OpenAI-only default)")
    # Planner-produced importance/creativity scores cannot authorize premium
    # invention. Deliberate Astra capsules belong to the company director's
    # cycle ledger, outside this routine department's auto-generated queue.
    if role == "astra":
        role = "luna"
        reasons.append("Astra requires company creative-cycle capsule; routine queue -> Luna")

    tier = (campaign or {}).get("tier", "normal")
    if role == "opus":
        allowed = cfg["opus_guardrail"]["per_campaign_tier"].get(tier, 0)
        used = int((campaign or {}).get("opus_reviews_used") or 0)
        if tier == "routine" or imp < cfg["opus_guardrail"]["min_importance"]:
            role = "consensus"
            reasons.append(f"opus prohibited (tier={tier}, importance={imp}) -> sol+sonnet consensus")
        elif used >= allowed:
            role = "consensus"
            reasons.append(f"opus cap reached ({used}/{allowed} for {tier}) -> consensus")

    chain_role = "sol" if role == "consensus" else role
    chain = list(cfg["roles"][chain_role]["chain"])
    if cfg.get("review_policy") and (ttype.endswith("_review") or ttype == "second_opinion"):
        chain = list(cfg["review_policy"]["model_chain"])
        if not chain or any(provider_of(model) != "openai" for model in chain):
            raise ValueError("Owner review policy requires OpenAI-only reviewer and fallback models")
        reasons.append("Owner preference: ChatGPT/OpenAI reviews only")
    if any(provider_of(model) != "openai" for model in chain):
        raise ValueError("Active marketing routes must be OpenAI-only")

    levels = cfg["reasoning"]["levels"]
    level = levels[max(0, min(cx, len(levels) - 1))]
    if level == "max" and cfg["reasoning"].get("max_requires_flag") and not (task.get("payload") or {}).get("allow_max_reasoning"):
        level = "xhigh"
    level = _clamp_level(level, cfg["reasoning"]["role_floor"][chain_role], cfg["reasoning"]["role_cap"][chain_role])

    budget = cfg["token_budgets"][chain_role]
    return {
        "role": role,
        "chain": chain,
        "preferred_model": chain[0],
        "fallback_model": chain[1] if len(chain) > 1 else None,
        "reasoning": level,
        "context_chars": budget["context_chars"],
        "max_output_tokens": budget["max_output_tokens"],
        "reasons": reasons,
    }
