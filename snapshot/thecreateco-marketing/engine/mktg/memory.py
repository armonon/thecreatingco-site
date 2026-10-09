"""Deterministic memory: lead dedupe + contact gates, content dedupe, notes retrieval (FTS5), compact state."""
import hashlib
import json
import os
import re
from datetime import datetime, timedelta
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from .db import now_iso, today, new_id, kv_get, kv_set, WORKSPACE

TRACKING = re.compile(r"^(utm_|fbclid|gclid|ref$|ref_src|si$|feature$|igshid|mc_)")


# ---------------------------------------------------------------- normalization

def normalize_url(url):
    if not url:
        return ""
    u = url.strip()
    if "://" not in u:
        u = "https://" + u
    s = urlsplit(u)
    host = s.netloc.lower()
    if host.startswith("www.") or host.startswith("m."):
        host = host.split(".", 1)[1]
    # paths compare case-insensitively (profile/community URLs); case-sensitive ids live in the query (e.g. ?v=)
    path = re.sub(r"/+$", "", s.path).lower()
    if host == "youtube.com" and path.startswith("/@"):
        path = re.sub(r"/(about|videos|featured|shorts|streams|playlists)$", "", path)
    q = [(k, v) for k, v in parse_qsl(s.query) if not TRACKING.match(k.lower())]
    return urlunsplit(("https", host, path, urlencode(sorted(q)), ""))


def normalize_email(email):
    if not email or "@" not in email:
        return ""
    local, dom = email.strip().lower().split("@", 1)
    local = local.split("+", 1)[0]
    if dom in ("gmail.com", "googlemail.com"):
        local = local.replace(".", "")
        dom = "gmail.com"
    return f"{local}@{dom}"


def normalize_handle(platform, handle):
    if not handle:
        return ""
    return f"{(platform or '').lower()}:{handle.strip().lstrip('@').lower()}"


# ---------------------------------------------------------------- leads

def find_lead(conn, url=None, email=None, handle=None, platform=None):
    un, en = normalize_url(url), normalize_email(email)
    if un:
        r = conn.execute("SELECT * FROM leads WHERE url_norm=?", (un,)).fetchone()
        if r:
            return r
    if en:
        r = conn.execute("SELECT * FROM leads WHERE email_norm=?", (en,)).fetchone()
        if r:
            return r
    hn = normalize_handle(platform, handle)
    if hn:
        r = conn.execute("SELECT * FROM leads WHERE lower(platform)||':'||lower(ltrim(handle,'@'))=?", (hn,)).fetchone()
        if r:
            return r
    return None


def upsert_lead(conn, *, name, platform=None, url=None, email=None, handle=None, org=None, campaign_id=None,
                product=None, relevance=None, status="prospect", notes=None, source=None):
    """Insert or merge. Returns (lead_id, created: bool). Never creates a duplicate for the same url/email/handle."""
    existing = find_lead(conn, url, email, handle, platform)
    if existing:
        sets, vals = [], []
        for col, val in (("email", email), ("email_norm", normalize_email(email)), ("handle", handle),
                         ("org", org), ("product", product), ("relevance", relevance)):
            if val and not existing[col]:
                sets.append(f"{col}=?"); vals.append(val)
        if notes:
            sets.append("notes=?"); vals.append(((existing["notes"] or "") + "\n" + notes).strip())
        if sets:
            conn.execute(f"UPDATE leads SET {', '.join(sets)}, updated_at=? WHERE lead_id=?",
                         (*vals, now_iso(), existing["lead_id"]))
        return existing["lead_id"], False
    lid = new_id("lead")
    dnc = 1 if is_dnc(conn, email=email, url=url) else 0
    conn.execute("INSERT INTO leads(lead_id,name,org,platform,url,url_norm,email,email_norm,handle,campaign_id,product,"
                 "relevance,status,notes,dnc,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                 (lid, name, org, platform, url, normalize_url(url) or None, email, normalize_email(email) or None,
                  handle, campaign_id, product, relevance, status, notes, dnc, source, now_iso(), now_iso()))
    return lid, True


def add_dnc(conn, *, email=None, url=None, reason="opt-out"):
    for key in (normalize_email(email), normalize_url(url)):
        if key:
            conn.execute("INSERT OR IGNORE INTO dnc(key,reason,ts) VALUES (?,?,?)", (key, reason, now_iso()))
    conn.execute("UPDATE leads SET dnc=1, status='opted_out', updated_at=? WHERE email_norm=? OR url_norm=?",
                 (now_iso(), normalize_email(email) or "\0", normalize_url(url) or "\0"))


def is_dnc(conn, email=None, url=None):
    keys = [k for k in (normalize_email(email), normalize_url(url)) if k]
    return any(conn.execute("SELECT 1 FROM dnc WHERE key=?", (k,)).fetchone() for k in keys)


def can_contact(conn, cfg, lead_id, kind="initial", on_day=None):
    """Deterministic outreach gate. Returns (ok, reason)."""
    lead = conn.execute("SELECT * FROM leads WHERE lead_id=?", (lead_id,)).fetchone()
    if not lead:
        return False, "unknown lead"
    if lead["dnc"] or is_dnc(conn, lead["email"], lead["url"]):
        return False, "do-not-contact"
    o = cfg["outreach"]
    day = on_day or today()
    prior = conn.execute("SELECT kind, day FROM outreach WHERE lead_id=? ORDER BY ts", (lead_id,)).fetchall()
    if kind == "initial":
        if prior or lead["last_contact"]:
            return False, f"already contacted ({lead['last_contact'] or prior[-1]['day']})"
        new_today = conn.execute("SELECT COUNT(*) c FROM outreach WHERE day=? AND kind='initial'", (day,)).fetchone()["c"]
        if new_today >= o["max_new_recipients_per_day"]:
            return False, f"daily new-recipient cap reached ({new_today}/{o['max_new_recipients_per_day']})"
        return True, "ok"
    if kind == "followup":
        if lead["response"]:
            return False, "they replied — handle as conversation, not follow-up"
        if not prior and not lead["last_contact"]:
            return False, "no initial contact on record"
        if lead["followups"] >= o["max_followups"]:
            return False, f"follow-up limit reached ({lead['followups']})"
        last = prior[-1]["day"] if prior else lead["last_contact"][:10]
        if datetime.strptime(day, "%Y-%m-%d") - datetime.strptime(last, "%Y-%m-%d") < timedelta(days=o["min_days_between_followups"]):
            return False, f"too soon after {last}"
        return True, "ok"
    if kind == "reply":
        return True, "ok"
    return False, f"unknown kind {kind}"


def record_contact(conn, cfg, lead_id, kind, channel="email", subject=None, campaign_id=None, task_id=None, model=None):
    ok, why = can_contact(conn, cfg, lead_id, kind)
    if not ok:
        raise ValueError(f"blocked: {why}")
    conn.execute("INSERT INTO outreach(lead_id,ts,day,kind,channel,subject,campaign_id,task_id,model) VALUES (?,?,?,?,?,?,?,?,?)",
                 (lead_id, now_iso(), today(), kind, channel, subject, campaign_id, task_id, model))
    conn.execute("UPDATE leads SET last_contact=?, status='contacted', followups=followups+?, updated_at=? WHERE lead_id=?",
                 (today(), 1 if kind == "followup" else 0, now_iso(), lead_id))


# ---------------------------------------------------------------- content

def body_hash(text):
    t = re.sub(r"\s+", " ", (text or "").strip().lower())
    t = re.sub(r"https?://\S+", "", t)
    return hashlib.sha256(t.encode()).hexdigest()[:24]


def add_content(conn, *, platform, body, campaign_id=None, topic=None, cta=None, status="draft", url=None,
                model=None, task_id=None):
    h = body_hash(body)
    r = conn.execute("SELECT content_id FROM content WHERE body_hash=?", (h,)).fetchone()
    if r:
        return r["content_id"], False
    cid = new_id("content")
    conn.execute("INSERT INTO content(content_id,platform,campaign_id,body,body_hash,topic,cta,status,url,model,task_id,created_at) "
                 "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                 (cid, platform, campaign_id, body, h, topic, cta, status, url, model, task_id, now_iso()))
    return cid, True


# ---------------------------------------------------------------- notes / retrieval

def add_note(conn, *, kind, title, body, product=None, campaign_id=None, source=None):
    conn.execute("INSERT INTO notes(ts,kind,product,campaign_id,source,title,body) VALUES (?,?,?,?,?,?,?)",
                 (now_iso(), kind, product, campaign_id, source, title, body))


def _fts_query(text):
    words = [w for w in re.findall(r"[A-Za-z0-9]{3,}", text or "")][:12]
    return " OR ".join(f'"{w}"' for w in words)


def retrieve(conn, query, *, product=None, kinds=None, campaign_id=None, max_chars=6000, k=8):
    """Top-k relevant notes, hard-capped by characters. Never returns the whole history."""
    q = _fts_query(query)
    if not q:
        return []
    sql = ("SELECT n.id, n.kind, n.product, n.title, n.body, n.campaign_id FROM notes_fts f JOIN notes n ON n.id=f.rowid "
           "WHERE notes_fts MATCH ?")
    args = [q]
    if kinds:
        sql += f" AND n.kind IN ({','.join('?' * len(kinds))})"
        args += list(kinds)
    if product:
        sql += " AND (n.product IS NULL OR n.product='' OR lower(n.product)=lower(?))"
        args.append(product)
    if campaign_id:
        sql += " AND (n.campaign_id IS NULL OR n.campaign_id=?)"
        args.append(campaign_id)
    sql += " ORDER BY bm25(notes_fts) LIMIT ?"
    args.append(k * 3)
    out, used = [], 0
    for r in conn.execute(sql, args):
        body = r["body"]
        room = max_chars - used
        if room <= 200:
            break
        if len(body) > room:
            body = body[:room] + "…"
        out.append({"title": r["title"], "kind": r["kind"], "body": body})
        used += len(body) + len(r["title"] or "") + 8
        if len(out) >= k:
            break
    return out


# ---------------------------------------------------------------- compact marketing state

STATE_SECTIONS = ["CURRENT GOALS", "ACTIVE CAMPAIGNS", "CURRENT PRIORITIES", "IMPORTANT RECENT RESULTS",
                  "TOP LEARNINGS", "KNOWN FAILURES", "EXPERIMENTS", "BLOCKERS", "NEXT ACTIONS", "KEY METRICS"]


def set_state_section(conn, section, lines, max_items=8):
    section = section.upper()
    if section not in STATE_SECTIONS:
        raise ValueError(f"unknown section {section}")
    st = kv_get(conn, "state", {})
    st[section] = [l.strip() for l in lines if l.strip()][:max_items]
    kv_set(conn, "state", st)


def push_state_item(conn, section, line, max_items=8):
    st = kv_get(conn, "state", {})
    items = [line.strip()] + [x for x in st.get(section.upper(), []) if x != line.strip()]
    st[section.upper()] = items[:max_items]
    kv_set(conn, "state", st)


def render_state(conn, cfg):
    """Compact state (~1-3k tokens). Older items fall off; full history lives in notes/results."""
    st = kv_get(conn, "state", {})
    camps = conn.execute("SELECT campaign_id, name, product, tier FROM campaigns WHERE status='active' ORDER BY created_at DESC LIMIT 8").fetchall()
    if camps:
        st["ACTIVE CAMPAIGNS"] = [f"{c['campaign_id']}: {c['name']} ({c['product'] or '-'}, {c['tier']})" for c in camps]
    q = conn.execute("SELECT status, COUNT(*) c FROM tasks GROUP BY status").fetchall()
    calls = conn.execute("SELECT COUNT(*) c, ROUND(COALESCE(SUM(est_cost),0),4) s FROM model_calls WHERE day=?", (today(),)).fetchone()
    leads = conn.execute("SELECT COUNT(*) c, SUM(status='contacted') k FROM leads").fetchone()
    metrics = list(st.get("KEY METRICS", []))
    metrics = [m for m in metrics if not m.startswith(("queue:", "ai today:", "leads:"))]
    metrics += [
        "queue: " + ", ".join(f"{r['status']}={r['c']}" for r in q) if q else "queue: empty",
        f"ai today: {calls['c']} calls, ${calls['s']} list-equivalent",
        f"leads: {leads['c']} tracked, {leads['k'] or 0} contacted",
    ]
    st["KEY METRICS"] = metrics[-8:]
    lines = ["# MARKETING STATE (generated — edit via `mktg state set`, not by hand)", f"_rendered {now_iso()}_", ""]
    for sec in STATE_SECTIONS:
        items = st.get(sec, [])
        lines.append(f"## {sec}")
        lines += [f"- {x}" for x in items] or ["- (none)"]
        lines.append("")
    text = "\n".join(lines)
    cap = cfg["state"]["max_chars"]
    if len(text) > cap:
        text = text[:cap - 40] + "\n…(truncated to state cap)\n"
    return text


def write_state_file(conn, cfg, path=None):
    path = path or os.path.join(WORKSPACE, "STATE.md")
    text = render_state(conn, cfg)
    with open(path, "w") as f:
        f.write(text)
    return path, len(text)
