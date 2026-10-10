import datetime as dt
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import os_cycle


class OSCycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "engine").mkdir()
        (self.root / "data").mkdir()
        (self.root / "core-product-lab").mkdir()
        self.products = [
            {"product_id": slug, "product_name": name, "maturity": "ALPHA", "quality_score": None,
             "release_readiness": "NOT QUALIFIED", "next_milestone": f"Qualify {name}", "observed_at": "2026-10-08T00:00:00Z"}
            for slug, name in (("scenepilot", "ScenePilot"), ("luma", "Luma Studio"),
                               ("form", "Form Studio"), ("stemdeck", "StemDeck"))]
        self.products.insert(0, {"product_id": "form-platform", "product_name": "Form Platform Module",
                                 "release_readiness": "must not shadow flagship"})
        self.products[2]["execution_hold"] = True  # exact Luma product has an active hold
        self.tasks = [
            {"task_id": "RUN", "title": "Active work", "status": "RUNNING", "product": "form", "dependencies": []},
            {"task_id": "NEXT", "title": "Qualify ScenePilot golden flow", "status": "QUEUED", "product": "scenepilot",
             "workstream": "CORE_PRODUCT_LAB", "severity": "P1", "priority": 4, "dependencies": []},
            {"task_id": "REV", "title": "Establish company revenue baseline", "status": "QUEUED", "product": None,
             "workstream": "OPERATIONS", "severity": "P0", "dependencies": []},
            {"task_id": "HELD", "title": "Do not start held Luma task", "status": "QUEUED", "product": "luma",
             "workstream": "CORE_PRODUCT_LAB", "severity": "P0", "dependencies": []},
            {"task_id": "BUSY-PRODUCT", "title": "Do not steal active Form owner", "status": "QUEUED", "product": "form",
             "workstream": "CORE_PRODUCT_LAB", "severity": "P0", "dependencies": []},
            {"task_id": "WAIT", "title": "Not ready", "status": "QUEUED", "product": None, "dependencies": ["RUN"]},
            {"task_id": "DONE", "title": "Verified completed work", "status": "COMPLETE", "completed_at": "2026-10-09T11:00:00+00:00",
             "workstream": "ENGINEERING", "dependencies": []},
            {"task_id": "FAIL", "title": "Unverified failing work", "status": "BLOCKED", "completed_at": "2026-10-09T11:30:00+00:00",
             "result": "must not be framed as success", "dependencies": []},
            {"task_id": "CONTACT", "title": "Email a.person@example.org", "status": "COMPLETE", "completed_at": "2026-10-09T11:45:00+00:00",
             "workstream": "MARKETING", "dependencies": []},
        ]
        self.context = {"health": {"score": None, "reason": "No measured rubric"},
                        "biggest_bottleneck": "Qualification and measurement remain incomplete",
                        "observed_at": "2026-10-08T00:00:00Z", "evidence_sources": ["audit.md"],
                        "metrics": {"revenue": {"value": None, "source": None, "period": None, "observed_at": None},
                                    "signups": {"value": None, "source": None, "period": None, "observed_at": None}}}
        (self.root / "PRODUCT_REGISTRY.json").write_text(json.dumps({"generated_at": "fixture", "products": self.products}))
        (self.root / "TASK_QUEUE.json").write_text(json.dumps({"generated_at": "fixture", "tasks": self.tasks}))
        (self.root / "data/context.json").write_text(json.dumps(self.context))
        (self.root / "data/astra-cycles.json").write_text(json.dumps({"cycles": [{"cycle_id": "invent-1",
            "selected_idea": "ENCORE", "implementation_status": "WAITING", "input_tokens": None,
            "output_tokens": None, "cost": None, "value_created": None}]}))
        (self.root / "core-product-lab/HEALTH.md").write_text("Updated: 2026-10-08T00:00:00Z\n")

    def tearDown(self):
        self.tmp.cleanup()

    def test_pause_stops_tick_before_any_child_commands(self):
        (self.root / "PAUSE").touch()
        calls = []
        result = os_cycle.tick(self.root, runner=lambda *a, **kw: calls.append(a))
        self.assertEqual(result["status"], "paused")
        self.assertEqual(calls, [])

    def test_overlap_is_skipped_without_running_child_commands(self):
        calls = []
        with os_cycle.single_run(self.root):
            result = os_cycle.tick(self.root, runner=lambda *a, **kw: calls.append(a))
        self.assertEqual(result["status"], "overlap_skipped")
        self.assertEqual(calls, [])

    def test_dashboard_preserves_unknown_health_revenue_and_astra_snapshot(self):
        cost = {"observed_at": "2026-10-09T12:00:00Z", "daily": {"list_estimated_usd": None, "billed_usd": None},
                "astra": {"ledger_rows": 2, "outcomes_recorded": 1, "outcomes_unknown": 1}}
        payload = os_cycle.build_dashboard(self.root, now="2026-10-09T12:00:00Z", website={"observed_at": "fresh", "probes": []},
                                           supervisor={"status": "available", "observed_at": "recent", "heartbeat_counts": {"IDLE": 1}},
                                           cost_snapshot=cost)
        self.assertIsNone(payload["company_health"]["score"])
        self.assertIsNone(payload["revenue"]["value"])
        self.assertEqual(payload["astra"]["telemetry"]["outcomes_unknown"], 1)
        self.assertEqual(len(payload["products"]), 4)
        self.assertEqual(payload["queue"]["next_task"]["task_id"], "REV")
        flagship_form = next(p for p in payload["products"] if p["name"] == "Form")
        self.assertEqual(flagship_form["product_id"], "form")
        self.assertNotEqual(flagship_form["release_readiness"], "must not shadow flagship")
        self.assertEqual(payload["queue"]["active_count"], 1)
        self.assertEqual(payload["queue"]["blocked_count"], 1)
        view = os_cycle.dashboard_markdown(payload)
        for evidence in ("Cost snapshot:", "Supervisor:", "Marketing:", "Deliberate Astra cycles:",
                         "Experiments: unknown", "NOT QUALIFIED"):
            self.assertIn(evidence, view)
        self.assertIn("ENCORE", view)

    def test_dashboard_and_daily_do_not_expose_contact_or_claim_blocked_work_complete(self):
        payload = os_cycle.build_dashboard(self.root, now="2026-10-09T12:00:00Z", website={"probes": []},
                                           supervisor={"status": "unknown"}, cost_snapshot={"status": "unavailable"})
        os_cycle.write_dashboard(self.root, payload)
        text = os_cycle.daily_summary(self.root, now=dt.datetime.fromisoformat("2026-10-09T12:00:00+00:00"))
        outputs = text + (self.root / "OS_DASHBOARD.json").read_text() + (self.root / "OS_DASHBOARD.md").read_text()
        self.assertNotIn("a.person@example.org", outputs)
        self.assertIn("DONE: Verified completed work", text)
        self.assertNotIn("FAIL: Unverified failing work", text)
        self.assertNotIn("must not be framed as success", outputs)
        self.assertIn("revenue: unknown", text)

    def test_tick_calls_only_bounded_existing_engines_then_writes_dashboard(self):
        calls = []
        def runner(args, **kwargs):
            calls.append(Path(args[1]).name + ":" + args[-1])
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        result = os_cycle.tick(self.root, runner=runner, website_probe=lambda: {"observed_at": "probe", "probes": []}, telemetry=True)
        self.assertEqual(result["status"], "complete")
        self.assertEqual(calls[:3], ["company.py:recover", "company.py:refresh", "telemetry.py:collect"])
        self.assertEqual(calls[3].split(":")[0], "anomalies.py")
        self.assertEqual(calls[-1], "lab.py:refresh")
        self.assertTrue((self.root / "OS_DASHBOARD.json").is_file())
        self.assertTrue((self.root / "OS_DASHBOARD.md").is_file())
        self.assertEqual(json.loads((self.root / "TASK_QUEUE.json").read_text())["generated_at"], "fixture")

    def test_unavailable_telemetry_does_not_discard_dashboard_or_invent_cost(self):
        def runner(args, **kwargs):
            name = Path(args[1]).name
            code = 1 if name == "telemetry.py" else 0
            return SimpleNamespace(returncode=code, stdout="", stderr="unavailable")
        result = os_cycle.tick(self.root, runner=runner, website_probe=lambda: {"probes": []})
        self.assertEqual(result["status"], "partial")
        self.assertFalse(result["steps"][2]["ok"])
        self.assertNotIn("anomaly_sync", [s["step"] for s in result["steps"]])
        payload = json.loads((self.root / "OS_DASHBOARD.json").read_text())
        self.assertEqual(payload["cost_snapshot"]["status"], "unavailable")

    def test_anomaly_failure_returns_partial_and_cli_nonzero(self):
        def runner(args, **kwargs):
            name = Path(args[1]).name
            code = 1 if name == "anomalies.py" else 0
            return SimpleNamespace(returncode=code, stdout="", stderr="failed")
        result = os_cycle.tick(self.root, runner=runner, website_probe=lambda: {"probes": []})
        self.assertEqual(result["status"], "partial")
        self.assertIn("anomaly_sync", result["failed_steps"])
        with patch.object(os_cycle, "tick", return_value={"status": "partial", "failed_steps": ["telemetry_collect"]}), \
             patch.object(sys, "argv", ["os_cycle.py"]):
            self.assertEqual(os_cycle.main(["--root", str(self.root), "tick"]), 1)


if __name__ == "__main__":
    unittest.main()
