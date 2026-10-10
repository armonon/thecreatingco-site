"""Prompt assembly. STATIC prefix (stable, cacheable) is separated from DYNAMIC task context.

Nothing time-varying goes into the static prefix. Static text is built once per role and memoized.
"""
import os
import re
from functools import lru_cache

from .db import WORKSPACE

ROLE_BRIEFS = {
    "luna": ("You are LUNA, the high-volume marketing worker for thecreateco. Do the task directly and completely. "
             "Be concise. No preamble. If the task asks for JSON, output only valid JSON."),
    "sol": ("You are SOL, marketing director for thecreateco. You plan, prioritize, delegate, review, and adjust. "
            "Decide; don't hedge. Prefer a small batch of high-value actions over many small ones. "
            "When asked for next tasks, output JSON {\"tasks\": [{\"task_type\", \"title\", \"instructions\", "
            "\"importance\" 0-3, \"creativity\" 0-3, \"complexity\" 0-4, \"product\", \"urls\" (optional: exact pages a worker should fetch, max 5), \"after\" (optional: indexes of earlier tasks in this list whose output this task needs)}]} using only task types from the provided list."),
    "astra": ("You are ASTRA, thecreateco's invention specialist. Use only for explicitly selected, "
              "high-leverage invention work. Produce a few original, strategically distinctive concepts; "
              "do not inflate routine copy or add unsupported product claims."),
    "sonnet": ("You are the senior creative director and copywriter for thecreateco. Write human, specific, "
               "community-native copy that does not read as AI-generated. Respect each platform's culture."),
    "opus": ("You are the independent senior reviewer for thecreateco. Review the underlying proposal on its merits; "
             "do not defer to earlier models' reasoning. Approve strong work as-is — never rewrite for style alone."),
}

REVIEW_FORMAT = """Respond in exactly this format:
VERDICT: APPROVE | APPROVE_WITH_CHANGES | REJECT
CONFIDENCE: 0-100
CRITICAL ISSUES:
- only meaningful problems (or "none")
RECOMMENDED CHANGES:
- minimal changes necessary (or "none")"""

OPERATING_RULES = """OPERATING RULES (always):
- Truth: never fabricate customers, testimonials, stats, reviews, partnerships, press, features, benchmarks, downloads, user counts, awards, endorsements, or having watched/read something you were not given.
- Only claim product capabilities present in the PRODUCT FACTS you are given; obey NEVER CLAIM lines.
- No spam. Be useful before promotional. Disclose affiliation with thecreateco when relevant. Never impersonate an independent user.
- Anything involving money, pricing, discounts, partnerships, press, legal, or mass email is flagged for Armon, not decided.
- Primary CTA: try the free web alpha + join the launch list at https://thecreatingco.com (not a pledge).
- Refer to people (including the founder, Armon) by name or "they"; never assume anyone's pronouns.
- Never imply a demo, capture, or asset exists unless the input says it does; leave a clearly marked [CAPTURE NEEDED] slot instead.
- You have no live web access. Use only the inputs given (PAGE blocks are real fetches). If the task needs fresh web data you weren't given, say NEEDS_WEB and list the exact URLs to fetch; never invent sources, threads, handles, or numbers."""


def _read(path, limit=None):
    try:
        with open(path) as f:
            t = f.read()
    except OSError:
        return ""
    return t[:limit] if limit else t


@lru_cache(maxsize=1)
def brand_block():
    b = _read(os.path.join(WORKSPACE, "BRAND.md"))
    b = re.sub(r"- Postal address.*\n", "", b)  # recipients' copy never needs this; footer is added at send time
    return b.strip()


@lru_cache(maxsize=1)
def never_claim_block():
    p = _read(os.path.join(WORKSPACE, "PRODUCTS.md"))
    m = re.search(r"## NEVER CLAIM.*", p, re.S)
    return (m.group(0) if m else "").strip()[:4000]


@lru_cache(maxsize=8)
def static_prefix(role):
    brief = ROLE_BRIEFS["opus" if role == "consensus" else role]
    parts = [brief, OPERATING_RULES]
    if role in ("sonnet", "sol", "opus", "consensus"):
        parts.append(brand_block())
        parts.append(never_claim_block())
    else:
        # Luna gets the short voice rules + never-claim, not the full brand doc
        parts.append("VOICE: creative, minimal, confident, human, slightly rebellious, respectful of artists. "
                     "Banned words: revolutionary, cutting-edge, game-changer, thrilled to announce, unlock, elevate, seamless.")
        parts.append(never_claim_block())
    return "\n\n".join(p for p in parts if p)


@lru_cache(maxsize=32)
def product_facts(product):
    """Only the PRODUCTS.md section(s) mentioning this product — not the whole 30 KB file."""
    if not product:
        return ""
    p = _read(os.path.join(WORKSPACE, "PRODUCTS.md"))
    chunks = re.split(r"\n(?=#{2,3} |\*\*|- \*\*)", p)
    hits = [c.strip() for c in chunks if product.lower() in c.lower() and "NEVER CLAIM" not in c]
    out, used = [], 0
    for c in hits:
        if used + len(c) > 3500:
            break
        out.append(c); used += len(c)
    return "\n\n".join(out)


def dynamic_block(task, payload, retrieved, upstream, state_excerpt=None):
    parts = [f"TASK TYPE: {task['task_type']}", f"TASK: {task.get('title') or ''}".strip()]
    company_state = _read(os.path.join(WORKSPACE, "..", "thecreateco-company", "COMPANY_STATE.md"), 6000)
    if company_state:
        parts.append("COMPANY DIRECTOR CONTEXT (dated evidence, not new publishing permission):\n" + company_state)
        parts.append("Marketing is the growth department. Align this task with company priorities; "
                     "do not invent traction or expand unsupported product claims. Escalate stale/conflicting "
                     "product facts for verification instead of choosing whichever claim sounds better.")
    if payload.get("instructions"):
        parts.append("INSTRUCTIONS:\n" + payload["instructions"])
    if payload.get("product"):
        facts = product_facts(payload["product"])
        if facts:
            parts.append(f"PRODUCT FACTS ({payload['product']}):\n{facts}")
    if payload.get("recipient"):
        parts.append("RECIPIENT CONTEXT:\n" + str(payload["recipient"]))
    if payload.get("campaign_goal"):
        parts.append("CAMPAIGN GOAL: " + payload["campaign_goal"])
    if payload.get("cta"):
        parts.append("CTA: " + payload["cta"])
    if payload.get("constraints"):
        parts.append("CONSTRAINTS:\n" + str(payload["constraints"]))
    if state_excerpt:
        parts.append("MARKETING STATE:\n" + state_excerpt)
    for u in upstream:
        parts.append(f"INPUT FROM {u['task_type']} ({u['role']}):\n{u['content']}")
    if payload.get("pages"):
        for pg in payload["pages"]:
            parts.append(f"PAGE {pg['url']}:\n{pg['text']}")
    if retrieved:
        parts.append("RELEVANT MEMORY:\n" + "\n\n".join(f"[{r['kind']}] {r['title']}\n{r['body']}" for r in retrieved))
    if payload.get("output") == "json":
        parts.append("OUTPUT: valid JSON only.")
    return "\n\n".join(parts)
