"""One-way, idempotent import of the existing markdown workspace into the DB.

Markdown files stay as the human-readable record and are never modified or deleted.
"""
import glob
import hashlib
import os
import re

from . import memory
from .db import WORKSPACE, kv_get, kv_set, now_iso

NOTE_SOURCES = {
    "PRODUCTS.md": "product", "AUDIENCES.md": "audience", "BRAND.md": "brand", "COMMUNITY_RULES.md": "community_rules",
    "EXPERIMENTS.md": "experiment", "LEARNINGS.md": "learning", "CATALOG.md": "product", "CAMPAIGNS.md": "campaign",
    "research/*.md": "research", "content/*.md": "content", "outreach/*.md": "outreach_draft",
}
PRODUCT_NAMES = ["Form Studio", "Luma Studio", "StemDeck", "ScenePilot", "Ghost Studio", "Librarian", "Reclaim", "Bounce",
                 "Sattari", "Glyph Studio", "AutoCut", "Captions", "Canvas", "Split", "Vox", "Pocket", "Cast", "Mockup"]


def _chunks(text, max_chars=1800):
    parts = re.split(r"\n(?=#{1,4} )", text)
    for p in parts:
        p = p.strip()
        if not p:
            continue
        title = p.splitlines()[0].lstrip("# ").strip()[:120]
        while len(p) > max_chars:
            cut = p.rfind("\n", 0, max_chars)
            cut = cut if cut > max_chars // 2 else max_chars
            yield title, p[:cut]
            p = p[cut:].strip()
        yield title, p


def _product_for(text):
    for name in PRODUCT_NAMES:
        if name.lower() in text.lower()[:400]:
            return name
    return None


def import_notes(conn):
    seen = kv_get(conn, "import_hashes", {})
    n = 0
    for pattern, kind in NOTE_SOURCES.items():
        for path in sorted(glob.glob(os.path.join(WORKSPACE, pattern))):
            rel = os.path.relpath(path, WORKSPACE)
            text = open(path).read()
            h = hashlib.sha256(text.encode()).hexdigest()
            if seen.get(rel) == h:
                continue
            conn.execute("DELETE FROM notes WHERE source=?", (rel,))
            for title, body in _chunks(text):
                memory.add_note(conn, kind=kind, title=f"{rel} › {title}", body=body, product=_product_for(title + "\n" + body),
                                source=rel)
                n += 1
            seen[rel] = h
    kv_set(conn, "import_hashes", seen)
    return n


def _field(block, name):
    m = re.search(rf"^- {re.escape(name)}:\s*(.+)$", block, re.M)
    return m.group(1).strip() if m else ""


def import_crm(conn):
    path = os.path.join(WORKSPACE, "CREATOR_CRM.md")
    if not os.path.exists(path):
        return 0, 0
    text = open(path).read()
    product_ctx = None
    created = merged = 0
    for sec in re.split(r"\n(?=### |\*\*)", text):
        if sec.startswith("### "):
            product_ctx = sec.splitlines()[0][4:].strip()
            if "skipped" in product_ctx.lower():
                product_ctx = "__skip__"
            continue
        m = re.match(r"\*\*(.+?)\*\*", sec)
        if not m or product_ctx == "__skip__":
            continue
        block = sec
        plat_url = _field(block, "Platform + URL")
        url_m = re.search(r"https?://\S+", plat_url)
        contact = _field(block, "Public contact route")
        email_m = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", contact)
        status_raw = _field(block, "Status")
        status = "contacted" if status_raw.lower().startswith("contacted") else ("opted_out" if "opted" in status_raw.lower() else "prospect")
        lid, was_new = memory.upsert_lead(
            conn, name=m.group(1).strip(), platform=plat_url.split(",")[0].strip() or None,
            url=url_m.group(0).rstrip(".,)") if url_m else None, email=email_m.group(0) if email_m else None,
            product=_field(block, "Relevant product") or product_ctx, relevance=_field(block, "Reason")[:500],
            status=status, notes=f"Imported from CREATOR_CRM.md ({product_ctx}). Status: {status_raw}", source="CREATOR_CRM.md")
        created += was_new
        merged += (not was_new)
    return created, merged


def import_email_history(conn):
    path = os.path.join(WORKSPACE, "EMAIL_HISTORY.md")
    if not os.path.exists(path):
        return 0
    n = 0
    for line in open(path):
        m = re.match(r"- (\d{4}-\d{2}-\d{2})[^|]*\|\s*(\S+@\S+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*(\w+)", line)
        if not m:
            continue
        day, email, who, product, subject, kind = (x.strip() for x in m.groups())
        lead = memory.find_lead(conn, email=email)
        lid = lead["lead_id"] if lead else memory.upsert_lead(conn, name=who, email=email, product=product,
                                                               platform="email", source="EMAIL_HISTORY.md")[0]
        if conn.execute("SELECT 1 FROM outreach WHERE lead_id=? AND day=? AND kind=?", (lid, day, kind)).fetchone():
            continue
        # historical record: written directly (the gate is for new sends)
        conn.execute("INSERT INTO outreach(lead_id,ts,day,kind,channel,subject) VALUES (?,?,?,?,?,?)",
                     (lid, f"{day}T08:20:00-07:00", day, kind, "email", subject))
        conn.execute("UPDATE leads SET last_contact=?, status='contacted', email=COALESCE(email,?), email_norm=COALESCE(email_norm,?) "
                     "WHERE lead_id=?", (day, email, memory.normalize_email(email), lid))
        n += 1
    return n


def import_dnc(conn):
    path = os.path.join(WORKSPACE, "DO_NOT_CONTACT.md")
    if not os.path.exists(path):
        return 0
    n = 0
    for line in open(path):
        for e in re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", line):
            memory.add_dnc(conn, email=e, reason="DO_NOT_CONTACT.md")
            n += 1
        for u in re.findall(r"https?://\S+", line):
            memory.add_dnc(conn, url=u, reason="DO_NOT_CONTACT.md")
            n += 1
    return n


def seed_state(conn):
    if kv_get(conn, "state"):
        return False
    ds = open(os.path.join(WORKSPACE, "DAILY_STATE.md")).read() if os.path.exists(os.path.join(WORKSPACE, "DAILY_STATE.md")) else ""
    blockers = re.findall(r"^- (.+)$", ds.split("## Current priority")[0].split("## Blockers")[-1], re.M) if "## Blockers" in ds else []
    prio = ds.split("## Current priority")[-1].split("##")[0].strip() if "## Current priority" in ds else ""
    memory.set_state_section(conn, "CURRENT GOALS", ["1,000 qualified founding users; learn which product/audience/message/channel wins organically"])
    memory.set_state_section(conn, "CURRENT PRIORITIES", [prio[:400]] if prio else [])
    memory.set_state_section(conn, "BLOCKERS", [b[:220] for b in blockers if not b.startswith("(")])
    memory.set_state_section(conn, "NEXT ACTIONS", ["Follow-ups due 2026-10-12 for the 3 emails sent 2026-10-05",
                                                    "Wave 2 outreach drafts in outreach/drafts-2026-10-06.md (10 prospects, not contacted)"])
    memory.set_state_section(conn, "EXPERIMENTS", ["Launch hook tests H1-H6 (hypotheses only; blocked on owned social accounts)"])
    memory.set_state_section(conn, "KNOWN FAILURES", ["Web search provider (DuckDuckGo) returned provider_error all of 2026-10-06"])
    return True


def run_all(conn):
    notes = import_notes(conn)
    created, merged = import_crm(conn)
    sent = import_email_history(conn)
    dnc = import_dnc(conn)
    seeded = seed_state(conn)
    return {"notes_chunks": notes, "leads_created": created, "leads_merged": merged, "historical_sends": sent,
            "dnc_entries": dnc, "state_seeded": seeded, "at": now_iso()}
