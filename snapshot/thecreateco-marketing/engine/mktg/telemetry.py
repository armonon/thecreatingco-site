"""Spend + usage reports and anomaly detection. Answers "where did our AI spend money today?"."""
from datetime import datetime, timedelta

from .db import today

GROUPS = {"model": "model", "provider": "provider", "role": "role", "campaign": "COALESCE(campaign_id,'(none)')",
          "task_type": "task_type", "day": "day"}


def _range(period, ref=None):
    ref = datetime.strptime(ref or today(), "%Y-%m-%d")
    if period == "daily":
        return ref.strftime("%Y-%m-%d"), ref.strftime("%Y-%m-%d")
    if period == "weekly":
        return (ref - timedelta(days=6)).strftime("%Y-%m-%d"), ref.strftime("%Y-%m-%d")
    if period == "all":
        return "0000-00-00", "9999-99-99"
    raise ValueError(period)


def breakdown(conn, by="model", period="daily", ref=None):
    a, b = _range(period, ref)
    g = GROUPS[by]
    return [dict(r) for r in conn.execute(
        f"SELECT {g} AS k, COUNT(*) calls, SUM(ok=0) failures, SUM(input_tokens) input_tokens, SUM(output_tokens) output_tokens, "
        f"SUM(cached_tokens) cached_tokens, ROUND(SUM(est_cost),4) cost, CAST(AVG(latency_ms) AS INT) avg_ms, "
        f"SUM(retry>0) retries, MAX(tokens_estimated) any_estimated "
        f"FROM model_calls WHERE day BETWEEN ? AND ? GROUP BY {g} ORDER BY cost DESC, calls DESC", (a, b))]


def role_mix(conn, period="daily", ref=None):
    a, b = _range(period, ref)
    rows = conn.execute("SELECT role, COUNT(*) c FROM model_calls WHERE ok=1 AND day BETWEEN ? AND ? GROUP BY role", (a, b)).fetchall()
    total = sum(r["c"] for r in rows) or 1
    return {r["role"]: round(100 * r["c"] / total, 1) for r in rows}, total


def anomalies(conn, cfg, ref=None):
    an = cfg["anomaly"]
    day = ref or today()
    alerts = []
    mix, total = role_mix(conn, "daily", day)
    if total >= an["min_calls_before_share_alerts"]:
        for role, cap in an["max_share"].items():
            if mix.get(role, 0) > cap:
                alerts.append(f"{role} share {mix[role]}% > {cap}% cap ({total} calls today)")
    routine_opus = conn.execute("SELECT COUNT(*) c FROM model_calls m JOIN tasks t ON t.task_id=m.task_id "
                                "WHERE m.day=? AND m.role='opus' AND t.importance<?", (day, cfg["opus_guardrail"]["min_importance"])).fetchone()["c"]
    if routine_opus:
        alerts.append(f"{routine_opus} Opus call(s) on below-threshold tasks today")
    opus_today = conn.execute("SELECT COUNT(*) c FROM model_calls WHERE day=? AND role='opus'", (day,)).fetchone()["c"]
    if opus_today > cfg["opus_guardrail"]["daily_max_calls"]:
        alerts.append(f"Opus calls today {opus_today} > daily max {cfg['opus_guardrail']['daily_max_calls']}")
    spend = conn.execute("SELECT COALESCE(SUM(est_cost),0) s FROM model_calls WHERE day=?", (day,)).fetchone()["s"]
    if spend > an["daily_spend_alert_usd"]:
        alerts.append(f"spend today ${spend:.2f} > ${an['daily_spend_alert_usd']:.2f} alert line")
    d0 = (datetime.strptime(day, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    prior = conn.execute("SELECT day, SUM(est_cost) s FROM model_calls WHERE day>=? AND day<? AND role IN ('sol','sonnet','opus') "
                         "GROUP BY day", (d0, day)).fetchall()
    if prior:
        avg = sum(r["s"] or 0 for r in prior) / 7
        exp_today = conn.execute("SELECT COALESCE(SUM(est_cost),0) s FROM model_calls WHERE day=? AND role IN ('sol','sonnet','opus')",
                                 (day,)).fetchone()["s"]
        if avg > 0 and exp_today > an["spike_vs_7d_avg_multiplier"] * avg:
            alerts.append(f"premium-model spend ${exp_today:.2f} is {exp_today / avg:.1f}x the 7-day average (${avg:.2f}/day)")
    fails = conn.execute("SELECT provider, COUNT(*) c FROM model_calls WHERE day=? AND ok=0 GROUP BY provider", (day,)).fetchall()
    for f in fails:
        if f["c"] >= 5:
            alerts.append(f"{f['provider']}: {f['c']} failed calls today")
    return alerts


def spend_report(conn, cfg, period="daily", ref=None):
    a, b = _range(period, ref)
    tot = conn.execute("SELECT COUNT(*) c, ROUND(COALESCE(SUM(est_cost),0),4) s, SUM(input_tokens) i, SUM(output_tokens) o, "
                       "SUM(cached_tokens) k, MAX(tokens_estimated) e FROM model_calls WHERE day BETWEEN ? AND ?", (a, b)).fetchone()
    lines = [f"AI spend {a}{'' if a == b else ' → ' + b}: ${tot['s']} list-price equivalent across {tot['c']} calls "
             f"({tot['i'] or 0} in / {tot['o'] or 0} out / {tot['k'] or 0} cached tokens)"]
    if tot["e"]:
        lines.append("note: OpenAI token counts are estimated (chars/4); the OpenClaw infer CLI doesn't return usage.")
    mix, total = role_mix(conn, period, ref)
    lines.append("mix: " + ", ".join(f"{k} {v}%" for k, v in sorted(mix.items(), key=lambda x: -x[1])) if mix else "mix: no calls")
    for by in ("provider", "model", "campaign", "task_type"):
        rows = breakdown(conn, by, period, ref)[:8]
        if rows:
            lines.append(f"by {by}: " + "; ".join(f"{r['k']} ${r['cost']} ({r['calls']} calls{', ' + str(r['failures']) + ' failed' if r['failures'] else ''})" for r in rows))
    al = anomalies(conn, cfg, min(b, today()))
    lines.append("alerts: " + (" | ".join(al) if al else "none"))
    return "\n".join(lines)
