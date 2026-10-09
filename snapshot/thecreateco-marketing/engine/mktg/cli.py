"""mktg — command line for the thecreateco marketing engine.

  mktg import                      pull markdown workspace into the DB (idempotent, read-only on markdown)
  mktg enqueue TYPE "title" [--campaign C] [--importance N] [--creativity N] [--complexity N] [--priority N]
               [--review none|sol|opus] [--instructions TEXT] [--product P] [--json] [--url U ...]
  mktg route TYPE [--importance N] [--creativity N] [--complexity N] [--campaign C]   (dry-run routing)
  mktg tick [--max N] [--alerts-only]   run one bounded loop pass (what the scheduler calls)
  mktg plan [--campaign C]         queue today's single Sol planning batch (idempotent per day)
  mktg status                      queue + provider health + today's spend/mix + alerts
  mktg spend [daily|weekly|all] [--by model|provider|campaign|task_type|role]
  mktg health [--reset PROVIDER]
  mktg campaign add ID "name" [--product P] [--tier routine|normal|major] [--goal G]
  mktg lead add "name" [--url U] [--email E] [--platform P] [--product P] [--campaign C]
  mktg lead check (--url U | --email E) [--kind initial|followup]
  mktg lead sent LEAD_ID --kind initial|followup|reply [--subject S]     (refuses if the gate says no)
  mktg lead dnc (--email E | --url U) [--reason R]
  mktg content add PLATFORM --body-file F [--campaign C]
  mktg outcome --campaign C [--platform P] [--angle A] [--impressions N --clicks N --replies N --signups N ...]
  mktg state [render|set SECTION "line" ...|push SECTION "line"]
  mktg show TASK_ID
"""
import argparse
import json
import os
import sys
import time

from . import engine, importer, memory, telemetry
from .db import connect, now_iso, today
from .router import load_config, route


def _print(obj):
    print(json.dumps(obj, indent=2, default=str) if not isinstance(obj, str) else obj)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="mktg", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("import")
    e = sub.add_parser("enqueue")
    e.add_argument("task_type"); e.add_argument("title")
    for k in ("importance", "creativity", "complexity", "risk"):
        e.add_argument(f"--{k}", type=int, default={"importance": 1, "complexity": 1}.get(k, 0))
    e.add_argument("--priority", type=int, default=50); e.add_argument("--campaign")
    e.add_argument("--review", default="none", choices=["none", "sol", "opus"])
    e.add_argument("--instructions", default=""); e.add_argument("--product")
    e.add_argument("--json", action="store_true"); e.add_argument("--url", action="append", default=[])
    e.add_argument("--content-platform"); e.add_argument("--payload", help="raw JSON payload merged in")

    r = sub.add_parser("route")
    r.add_argument("task_type")
    for k in ("importance", "creativity", "complexity", "risk"):
        r.add_argument(f"--{k}", type=int, default=1 if k in ("importance", "complexity") else 0)
    r.add_argument("--campaign")

    t = sub.add_parser("tick"); t.add_argument("--max", type=int)
    t.add_argument("--quiet-if-idle", action="store_true")
    t.add_argument("--alerts-only", action="store_true", help="print NO_REPLY unless there are alerts or NEEDS_REVIEW items")
    pl = sub.add_parser("plan"); pl.add_argument("--campaign")
    sub.add_parser("status")
    s = sub.add_parser("spend"); s.add_argument("period", nargs="?", default="daily"); s.add_argument("--by")
    h = sub.add_parser("health"); h.add_argument("--reset")

    c = sub.add_parser("campaign"); csub = c.add_subparsers(dest="sub", required=True)
    ca = csub.add_parser("add"); ca.add_argument("id"); ca.add_argument("name"); ca.add_argument("--product")
    ca.add_argument("--tier", default="normal", choices=["routine", "normal", "major"]); ca.add_argument("--goal")
    csub.add_parser("list")

    l = sub.add_parser("lead"); lsub = l.add_subparsers(dest="sub", required=True)
    la = lsub.add_parser("add"); la.add_argument("name")
    for k in ("url", "email", "platform", "product", "campaign", "handle", "notes"):
        la.add_argument(f"--{k}")
    lc = lsub.add_parser("check"); lc.add_argument("--url"); lc.add_argument("--email"); lc.add_argument("--kind", default="initial")
    ls = lsub.add_parser("sent"); ls.add_argument("lead_id"); ls.add_argument("--kind", required=True)
    ls.add_argument("--subject"); ls.add_argument("--campaign")
    ld = lsub.add_parser("dnc"); ld.add_argument("--email"); ld.add_argument("--url"); ld.add_argument("--reason", default="opt-out")
    lsub.add_parser("list")

    co = sub.add_parser("content"); cosub = co.add_subparsers(dest="sub", required=True)
    coa = cosub.add_parser("add"); coa.add_argument("platform"); coa.add_argument("--body-file", required=True)
    coa.add_argument("--campaign"); coa.add_argument("--status", default="draft"); coa.add_argument("--url")

    o = sub.add_parser("outcome")
    for k in ("campaign", "content", "platform", "audience", "angle", "cta", "model"):
        o.add_argument(f"--{k}")
    for k in ("impressions", "clicks", "replies", "signups", "conversions", "engagement"):
        o.add_argument(f"--{k}", type=int)
    o.add_argument("--cost", type=float)

    st = sub.add_parser("state"); st.add_argument("action", nargs="?", default="render")
    st.add_argument("section", nargs="?"); st.add_argument("lines", nargs="*")
    sh = sub.add_parser("show"); sh.add_argument("task_id")

    a = ap.parse_args(argv)
    conn = connect(a.db)
    cfg = load_config()

    if a.cmd == "import":
        _print(importer.run_all(conn)); memory.write_state_file(conn, cfg)
    elif a.cmd == "enqueue":
        payload = {"instructions": a.instructions}
        if a.product: payload["product"] = a.product
        if a.json: payload["output"] = "json"
        if a.url: payload["urls"] = a.url
        if a.content_platform: payload["content_platform"] = a.content_platform
        if a.payload: payload.update(json.loads(a.payload))
        tid = engine.enqueue(conn, cfg, a.task_type, a.title, payload, campaign_id=a.campaign, priority=a.priority,
                             importance=a.importance, creativity=a.creativity, complexity=a.complexity, risk=a.risk,
                             review_level=a.review)
        row = conn.execute("SELECT task_id, role, preferred_model, fallback_model, reasoning FROM tasks WHERE task_id=?", (tid,)).fetchone()
        _print(dict(row))
    elif a.cmd == "route":
        _print(route({"task_type": a.task_type, "importance": a.importance, "creativity": a.creativity,
                      "complexity": a.complexity, "risk": a.risk}, cfg, engine.get_campaign(conn, a.campaign)))
    elif a.cmd == "tick":
        summary = engine.tick(conn, cfg, a.max)
        memory.write_state_file(conn, cfg)
        alerts = telemetry.anomalies(conn, cfg)
        for x in alerts:  # surfaced in STATE.md so the operator sees them without asking
            memory.push_state_item(conn, "KNOWN FAILURES", f"ALERT {today()}: {x}")
        if alerts:
            memory.write_state_file(conn, cfg)
        if a.alerts_only:  # report each alert once per day, not every hour
            from .db import kv_get, kv_set
            seen = kv_get(conn, "alerted", {})
            fresh = [x for x in alerts if x.split(" ")[0] + x.split(" ")[1] not in seen.get(today(), [])]
            seen = {today(): seen.get(today(), []) + [x.split(" ")[0] + x.split(" ")[1] for x in fresh]}
            kv_set(conn, "alerted", seen)
            alerts = fresh
        did = sum(summary.values())
        if (a.quiet_if_idle and did == 0 and not alerts) or (a.alerts_only and not alerts and not summary.get("needs_review")):
            print("NO_REPLY")
        else:
            out = f"marketing engine tick: {summary}"
            if alerts:
                out += "\nALERTS: " + " | ".join(alerts)
            print(out)
    elif a.cmd == "plan":
        _print({"queued": engine.plan_daily(conn, cfg, a.campaign)})
    elif a.cmd == "status":
        q = conn.execute("SELECT status, COUNT(*) c FROM tasks GROUP BY status").fetchall()
        print("queue:", ", ".join(f"{r['status']}={r['c']}" for r in q) or "empty")
        for r in conn.execute("SELECT * FROM provider_health"):
            left = max(0, int(((r['until'] or 0) - time.time()) / 60))
            print(f"provider {r['provider']}: {r['status']}" + (f" ({left}m left: {r['reason'][:120]})" if r['status'] != 'ok' else ""))
        print(telemetry.spend_report(conn, cfg, "daily"))
    elif a.cmd == "spend":
        if a.by:
            _print(telemetry.breakdown(conn, a.by, a.period))
        else:
            print(telemetry.spend_report(conn, cfg, a.period))
    elif a.cmd == "health":
        if a.reset:
            conn.execute("UPDATE provider_health SET status='ok', until=NULL, failures=0, reason=NULL WHERE provider=?", (a.reset,))
        _print([dict(r) for r in conn.execute("SELECT * FROM provider_health")])
    elif a.cmd == "campaign":
        if a.sub == "add":
            _print(engine.ensure_campaign(conn, a.id, a.name, a.product, a.tier, a.goal))
        else:
            _print([dict(r) for r in conn.execute("SELECT * FROM campaigns")])
    elif a.cmd == "lead":
        if a.sub == "add":
            lid, new = memory.upsert_lead(conn, name=a.name, url=a.url, email=a.email, platform=a.platform, product=a.product,
                                          campaign_id=a.campaign, handle=a.handle, notes=a.notes, source="cli")
            _print({"lead_id": lid, "created": new})
        elif a.sub == "check":
            lead = memory.find_lead(conn, url=a.url, email=a.email)
            if not lead:
                _print({"known": False, "dnc": memory.is_dnc(conn, a.email, a.url)})
            else:
                ok, why = memory.can_contact(conn, cfg, lead["lead_id"], a.kind)
                _print({"known": True, "lead_id": lead["lead_id"], "name": lead["name"], "status": lead["status"],
                        "last_contact": lead["last_contact"], "can_contact": ok, "reason": why})
        elif a.sub == "sent":
            try:
                memory.record_contact(conn, cfg, a.lead_id, a.kind, subject=a.subject, campaign_id=a.campaign)
                print("recorded")
            except ValueError as ex:
                print(str(ex)); sys.exit(2)
        elif a.sub == "dnc":
            memory.add_dnc(conn, email=a.email, url=a.url, reason=a.reason); print("added to do-not-contact")
        else:
            for r in conn.execute("SELECT lead_id,name,product,status,last_contact,dnc FROM leads ORDER BY created_at"):
                print(" | ".join(str(r[k]) for k in r.keys()))
    elif a.cmd == "content":
        body = open(a.body_file).read()
        cid, new = memory.add_content(conn, platform=a.platform, body=body, campaign_id=a.campaign, status=a.status, url=a.url)
        _print({"content_id": cid, "created": new, "duplicate_of_existing": not new})
    elif a.cmd == "outcome":
        conn.execute("INSERT INTO outcomes(ts,campaign_id,content_id,platform,audience,angle,cta,model,impressions,clicks,replies,"
                     "signups,conversions,engagement,cost) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                     (now_iso(), a.campaign, a.content, a.platform, a.audience, a.angle, a.cta, a.model, a.impressions,
                      a.clicks, a.replies, a.signups, a.conversions, a.engagement, a.cost))
        print("outcome recorded")
    elif a.cmd == "state":
        if a.action == "set":
            memory.set_state_section(conn, a.section, a.lines)
        elif a.action == "push":
            memory.push_state_item(conn, a.section, " ".join(a.lines))
        path, n = memory.write_state_file(conn, cfg)
        print(open(path).read() if a.action == "render" else f"{path} ({n} chars)")
    elif a.cmd == "show":
        t = conn.execute("SELECT * FROM tasks WHERE task_id=?", (a.task_id,)).fetchone()
        r = conn.execute("SELECT * FROM results WHERE task_id=?", (a.task_id,)).fetchone()
        _print({"task": dict(t) if t else None, "result": dict(r) if r else None})


if __name__ == "__main__":
    main()
