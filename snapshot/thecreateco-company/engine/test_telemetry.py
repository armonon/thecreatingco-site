import datetime as dt
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import telemetry as t

NOW = dt.datetime(2026, 10, 9, 7, 30, tzinfo=dt.timezone.utc)


class TelemetryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "data").mkdir()
        self.cfg = json.loads((t.ROOT / "data/cost-policy.json").read_text())
        self.write_policy()

    def tearDown(self):
        self.temp.cleanup()

    def write_policy(self):
        (self.root / "data/cost-policy.json").write_text(json.dumps(self.cfg))

    def run_receipt(self, **extra):
        return {"jobId": "job-1", "runAtMs": NOW.timestamp() * 1000,
                "model": "gpt-6.1-sol", "status": "ok", **extra}

    def store(self, **extra):
        receipt = t.normalize_run(self.run_receipt(**extra))
        with t.ledger(self.root) as db:
            t.put(db, receipt)
        return receipt

    def snapshot(self):
        with t.ledger(self.root) as db:
            return t.build_snapshot(db, self.cfg, NOW)

    def test_zero_is_known_unknown_is_null_and_cost_not_inferred(self):
        receipt = t.normalize_run(self.run_receipt(usage={"input_tokens": 0, "output_tokens": 0, "cost": 4}))
        self.assertEqual(receipt["total_tokens"], 0)
        self.assertIsNone(receipt["cached_tokens"])
        self.assertIsNone(receipt["billed_usd"])
        self.assertIsNone(receipt["list_estimated_usd"])
        self.assertEqual(receipt["scope"], "scheduled_run")

    def test_allowlist_does_not_persist_raw_messages_or_contacts(self):
        receipt = self.store(summary="private customer secret@example.com", diagnostics={"token": "SECRET"},
                             taskId="email@private.example.test", escalationReasonCode="complex_repair",
                             usage={"input_tokens": 12, "output_tokens": 2, "input_tokens_details": {"cached_tokens": 4}})
        with t.ledger(self.root) as db:
            body = db.execute("SELECT body FROM receipts").fetchone()[0]
        self.assertNotIn("SECRET", body)
        self.assertNotIn("private", body)
        self.assertEqual(receipt["cached_tokens"], 4)
        self.assertIsNone(receipt["task"])

    def test_source_total_and_separate_cache_reads_preserved_without_subtraction(self):
        receipt = t.normalize_run(self.run_receipt(usage={"input_tokens": 10, "output_tokens": 5, "cache_read_tokens": 100, "total_tokens": 115}))
        self.assertEqual(receipt["total_tokens"], 115)
        self.assertEqual(receipt["cached_tokens"], 100)
        self.assertEqual(receipt["cache_read_tokens"], 100)
        self.assertEqual(receipt["token_accounting"], "source_reported_total")
        unknown = t.normalize_run(self.run_receipt(usage={"input_tokens": 10, "output_tokens": 5, "cache_read_tokens": 100}))
        self.assertIsNone(unknown["total_tokens"])

    def test_repeat_collection_is_idempotent_and_refreshes_usage(self):
        first = self.store(usage={"input_tokens": 10})
        second = self.store(usage={"input_tokens": 20})
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(self.snapshot()["daily"]["ledger_rows"], 1)
        self.assertEqual(self.snapshot()["daily"]["input_tokens"], 20)

    def test_missing_usage_not_zero_and_partial_sum_exposed(self):
        self.store()
        self.store(jobId="job-2", usage={"input_tokens": 20})
        daily = self.snapshot()["daily"]
        self.assertEqual(daily["input_tokens"], 20)
        self.assertEqual(daily["input_tokens_known_rows"], 1)
        self.assertIsNone(daily["billed_usd"])

    def test_null_default_caps_never_manufacture_economy(self):
        self.store(usage={"list_estimated_usd": 100000})
        result = t.preflight(self.root, {"low_value": True}, NOW)
        self.assertEqual(result["decision"], "continue")
        self.assertEqual(result["mode"], "normal")

    def test_cap_defers_only_explicit_low_value_and_critical_continues(self):
        self.cfg["budgets"][0]["limit"] = 2
        self.write_policy()
        self.store(usage={"list_estimated_usd": 3})
        self.assertEqual(t.preflight(self.root, {"low_value": True}, NOW)["decision"], "defer_low_value")
        self.assertEqual(t.preflight(self.root, {}, NOW)["decision"], "continue")
        self.assertEqual(t.preflight(self.root, {"low_value": True, "severity": "P0"}, NOW)["decision"], "continue")
        self.assertTrue(t.preflight(self.root, {"low_value": True, "critical": True}, NOW)["critical_override"])

    def test_task_budget_does_not_charge_unattributed_or_other_tasks(self):
        self.cfg["budgets"] = [{"name": "task", "scope": "task", "window": "week", "metric": "total_tokens", "limit": 10}]
        self.write_policy()
        self.store(taskId="TASK-1", usage={"input_tokens": 20, "output_tokens": 2})
        self.assertEqual(t.preflight(self.root, {"task_id": "TASK-2", "low_value": True}, NOW)["decision"], "continue")
        self.assertEqual(t.preflight(self.root, {"task_id": "TASK-1", "low_value": True}, NOW)["decision"], "defer_low_value")

    def test_astra_value_is_evidence_backed_not_automatic_success_roi(self):
        receipt = self.store(model="gpt-6-astra")
        self.assertEqual(self.snapshot()["astra"]["outcomes_unknown"], 1)
        (self.root / "evidence.md").write_text("Verified repair result")
        t.record_value(self.root, receipt["id"], "positive", "evidence.md")
        self.assertEqual(self.snapshot()["astra"]["outcomes_recorded"], 1)
        self.assertEqual(self.snapshot()["astra"]["outcomes_unknown"], 0)
        with self.assertRaises(ValueError):
            t.record_value(self.root, receipt["id"], "positive", "../evidence.md")

    def test_local_day_and_monday_week_boundaries(self):
        self.assertEqual(t.window_start(NOW, "day", self.cfg["timezone"]), dt.datetime(2026, 10, 9, 7, tzinfo=dt.timezone.utc))
        self.assertEqual(t.window_start(NOW, "week", self.cfg["timezone"]), dt.datetime(2026, 10, 5, 7, tzinfo=dt.timezone.utc))
        sunday = dt.datetime(2026, 11, 1, 12, tzinfo=dt.timezone.utc)
        self.assertEqual(t.window_start(sunday, "day", self.cfg["timezone"]), dt.datetime(2026, 11, 1, 7, tzinfo=dt.timezone.utc))

    def test_cron_pagination_bounded_and_exec_only_not_counted_as_ai(self):
        self.cfg["collection"]["cron_max_pages"] = 1
        self.cfg["collection"]["cron_page_size"] = 999
        with patch.object(t, "cli_json", side_effect=[{"jobs": []}, {"entries": [self.run_receipt(), {"jobId": "exec", "runAtMs": 1}], "hasMore": True}]) as cli:
            with t.ledger(self.root) as db:
                coverage = t.collect_cron(db, self.cfg)
            self.assertIn("200", cli.call_args.args[0])
        self.assertEqual(coverage["status"], "partial")
        self.assertEqual(coverage["upserted_model_receipts"], 1)
        self.assertEqual(self.snapshot()["daily"]["records"], 1)

    def test_failure_anomaly_and_unavailable_sources_do_not_erase_ledger(self):
        for i in range(3):
            self.store(jobId="failure-" + str(i), status="error")
        with patch.object(t, "cli_json", return_value={"unavailable": "offline"}):
            result = t.collect(self.root, self.root / "missing.db", NOW)
        self.assertEqual(result["daily"]["failures"], 3)
        self.assertEqual(result["sources"]["openclaw_cron"]["status"], "unavailable")
        self.assertEqual(result["anomalies"][0]["kind"], "repeated_failures")

    def test_marketing_per_call_allowlist_is_idempotent_and_not_billed(self):
        source = self.root / "mktg.db"
        with closing(sqlite3.connect(source)) as db, db:
            db.execute("CREATE TABLE model_calls(id INTEGER PRIMARY KEY,ts,day,model,provider,task_id,reasoning,ok,input_tokens,output_tokens,cached_tokens,est_cost,latency_ms,tokens_estimated,prompt_chars)")
            db.execute("CREATE TABLE leads(email)")
            db.execute("INSERT INTO leads VALUES ('secret@customer.example.test')")
            db.executemany("INSERT INTO model_calls VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
                (1, "2026-10-08T13:00:00-07:00", "2026-10-08", "gpt-6.1-sol", "openai", "TASK-1", "medium", 1, 10, 2, 3, .5, 5, 0, 1000),
                (2, "2026-10-08T13:10:00-07:00", "2026-10-08", "gpt-6.1-sol", "openai", "TASK-1", "medium", 0, 20, 4, 6, .2, 7, 1, 1000)])
        with t.ledger(self.root) as db:
            t.collect_marketing(db, source, self.cfg, NOW)
            t.collect_marketing(db, source, self.cfg, NOW)
            rows = t.read_rows(db)
        self.assertEqual(len(rows), 2)
        self.assertEqual(sum(r["records"] for r in rows), 2)
        self.assertEqual(sum(r["failures"] for r in rows), 1)
        self.assertEqual(sum(r["total_tokens"] for r in rows), 36)
        self.assertEqual(sum(r["list_estimated_usd"] for r in rows), .7)
        self.assertIsNone(rows[0]["billed_usd"])
        self.assertTrue(any(r["tokens_estimated"] for r in rows))
        self.assertFalse(all(r["tokens_estimated"] for r in rows))
        self.assertNotIn("secret@", json.dumps(rows))
        self.assertNotIn("prompt_chars", json.dumps(rows))

    def test_invalid_nonfinite_cap_rejected(self):
        self.cfg["budgets"][0]["limit"] = float("nan")
        self.write_policy()
        with self.assertRaises(ValueError):
            t.policy(self.root)

    def test_missing_price_sol_zero_is_unknown_but_proven_zero_preserved(self):
        source = self.root / "mktg.db"
        with closing(sqlite3.connect(source)) as db, db:
            db.execute("CREATE TABLE model_calls(id INTEGER PRIMARY KEY,ts,day,model,provider,task_id,reasoning,ok,input_tokens,output_tokens,cached_tokens,est_cost,latency_ms,tokens_estimated)")
            db.executemany("INSERT INTO model_calls VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
                (1, "2026-10-08T13:00:00-07:00", "2026-10-08", "openai/gpt-6.1-sol", "openai", "T1", "medium", 1, 100, 10, 0, 0, 5, 0),
                (2, "2026-10-08T13:01:00-07:00", "2026-10-08", "openai/gpt-6.1-sol", "openai", "T2", "medium", 1, 0, 0, 0, 0, 5, 0),
                (3, "2026-10-08T13:02:00-07:00", "2026-10-08", "openai/gpt-6.1-sol", "openai", "T3", "medium", 0, 0, 0, 0, 0, 5, 0),
                (4, "2026-10-08T13:03:00-07:00", "2026-10-08", "openai/gpt-6.1-sol", "openai", "T4", "medium", 1, 0, 0, 0, 0, 5, 1)])
        with t.ledger(self.root) as db:
            t.collect_marketing(db, source, self.cfg, NOW)
            rows = {r["task"]: r for r in t.read_rows(db)}
        self.assertIsNone(rows["T1"]["list_estimated_usd"])
        self.assertEqual(rows["T1"]["estimate_basis"], "ambiguous_source_zero")
        self.assertEqual(rows["T2"]["list_estimated_usd"], 0)
        self.assertIsNone(rows["T3"]["list_estimated_usd"])
        self.assertIsNone(rows["T4"]["list_estimated_usd"])
        self.assertEqual(t.totals(list(rows.values()))["list_estimated_usd_known_rows"], 1)

    def test_compact_snapshot_is_read_only_and_missing_is_unknown(self):
        self.assertIsNone(t.compact_snapshot(self.root)["billed_usd"])
        self.assertFalse((self.root / "engine").exists())


if __name__ == "__main__":
    unittest.main()
