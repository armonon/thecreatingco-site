import json
import io
import sqlite3
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import supervisor as sup


class SupervisorTests(unittest.TestCase):
    def fixture(self, now=3_600_000):
        return {
            "at_ms": now, "start_ms": now - 3_600_000, "agents": [],
            "sessions": [], "all_channels": 2, "seen_channels": [], "runs": [],
            "jobs": [], "repos": [], "queues": {}, "heartbeats": [], "source_errors": []
        }

    def test_old_aborted_session_is_idle_not_failed(self):
        old = {"status": "done", "abortedLastRun": True, "updatedAt": 1}
        self.assertEqual(sup.status_of(old, 3_600_000, 1000), "IDLE")
        recent = {**old, "updatedAt": 2000}
        self.assertEqual(sup.status_of(recent, 3_600_000, 1000), "FAILED")

    def test_active_requires_running_state(self):
        data = self.fixture()
        data["sessions"] = [{"key": "agent:main:discord:channel:111", "kind": "group",
                             "updatedAt": 3_500_000, "status": "done", "agentId": "main"},
                            {"key": "agent:main:discord:channel:222", "kind": "group",
                             "updatedAt": 3_500_000, "status": "running", "agentId": "main"}]
        text = sup.report_text(data)
        self.assertIn("1 active · 1 idle", text)
        self.assertIn("#222", text)
        self.assertNotIn("#111 (main): ACTIVE", text)

    def test_unchanged_dirty_repo_is_not_repeated(self):
        data = self.fixture()
        repo = {"name": "Form", "branch": "main", "commits": [], "dirty": ["src/a.ts"],
                "dirty_count": 1, "files": [], "files_count": 0, "added": 0, "removed": 0}
        data["repos"] = [repo]
        text = sup.report_text(data, {"repos": [repo], "queues": {}})
        self.assertIn("No commits in monitored repository heads", text)

    def test_unavailable_source_does_not_hide_other_evidence(self):
        data = self.fixture()
        data["source_errors"] = ["sessions"]
        data["repos"] = [{"name": "StemDeck", "branch": "test", "commits": [{"sha": "abc", "refs": "test", "subject": "fix"}],
                          "files": ["src/a.ts"], "files_count": 1, "added": 4, "removed": 2, "dirty": [], "dirty_count": 0}]
        text = sup.report_text(data)
        self.assertIn("Source unavailable: sessions", text)
        self.assertIn("StemDeck: 1 commit(s)", text)

    def test_opus_alert_from_actual_run_receipt(self):
        data = self.fixture()
        data["runs"] = [{"jobName": "major review", "model": "claude-opus-5", "status": "ok",
                         "usage": {"input_tokens": 30, "output_tokens": 4}}]
        self.assertIn("⚠️ OPUS USED", sup.report_text(data))

    def test_cached_cost_snapshot_is_reported_as_estimate_not_billed(self):
        data = self.fixture()
        data["cost_snapshot"] = {"observed_at": "2026-10-09T07:00:00+00:00",
                                 "daily_by_source": {"marketing_aggregate": {"list_estimated_usd": .25}},
                                 "governor": {"mode": "economy"}}
        text = sup.report_text(data)
        self.assertIn("source estimate $0.2500", text)
        self.assertIn("billed total unknown", text)
        self.assertIn("economy advisory mode", text)
        self.assertIn("not total company spend", text)

    def test_missing_scheduled_tokens_are_unknown_not_zero_calls(self):
        data = self.fixture()
        data["runs"] = [{"model": "gpt-6.1-sol", "status": "ok", "usage": {}}]
        text = sup.report_text(data)
        self.assertIn("1 run receipt(s), unknown in/unknown out", text)
        self.assertNotIn("1 call(s)", text)

    def test_cost_snapshot_missing_does_not_create_company_files(self):
        with tempfile.TemporaryDirectory() as temp:
            cfg = {**sup.CFG, "queue_databases": {"company": str(Path(temp) / "engine/company.sqlite3")}}
            with patch.object(sup, "CFG", cfg):
                self.assertEqual(sup.cost_snapshot()["status"], "unavailable")
                self.assertEqual(list(Path(temp).iterdir()), [])

    def test_recent_opus_session_activity_is_labeled_as_partial_evidence(self):
        data = self.fixture()
        data["sessions"] = [{"key": "agent:main:discord:channel:111", "kind": "group", "agentId": "main",
                             "updatedAt": 3_500_000, "model": "claude-opus-5", "status": "done"}]
        text = sup.report_text(data)
        self.assertIn("OPUS SESSION ACTIVITY", text)
        self.assertIn("call count/reason unavailable", text)

    def test_database_state_survives_reopen_and_channel_disable(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(sup, "DB", Path(temp) / "supervisor.sqlite3"):
                with sup.db_open() as db:
                    db.execute("INSERT INTO channels(id,reporting_enabled) VALUES ('111',0)")
                    db.execute("INSERT INTO reports(at_ms,window_start_ms,text,evidence_json) VALUES (10,0,'x','{}')")
                    db.commit()
                with sup.db_open() as db:
                    self.assertEqual(db.execute("SELECT reporting_enabled FROM channels WHERE id='111'").fetchone()[0], 0)
                    self.assertEqual(db.execute("SELECT at_ms FROM reports").fetchone()[0], 10)

    def test_disabled_or_inaccessible_channel_does_not_break_collection(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(sup, "DB", Path(temp) / "state.sqlite3"), \
                 patch.object(sup, "discover_repos", return_value=[]), \
                 patch.object(sup, "command") as cli:
                cli.side_effect = [[], {"sessions": [
                    {"key": "agent:main:discord:channel:111", "kind": "group", "agentId": "main", "updatedAt": 2000},
                    {"key": "unreadable", "kind": "group", "updatedAt": 2000},
                    {"key": "agent:main:discord:channel:222", "kind": "group", "agentId": "main", "updatedAt": 2000}
                ]}, {"jobs": []}, {"entries": []}]
                with sup.db_open() as db:
                    db.execute("INSERT INTO channels(id,reporting_enabled) VALUES ('111',0)")
                    db.commit()
                    data = sup.collect(db, 3000, 1000)
                self.assertEqual([sup.channel_id(s["key"]) for s in data["sessions"]], ["222"])

    def test_stale_active_heartbeat_is_flagged_not_killed(self):
        data = self.fixture(now=7_200_000)
        data["heartbeats"] = [{"id": "form-dev", "status": "ACTIVE", "updated_ms": 1,
                               "current_task": "render proof"}]
        text = sup.report_text(data)
        self.assertIn("POSSIBLE STALL form-dev", text)
        self.assertNotIn("killed", text)

    def test_critical_alert_needs_repeated_evidence_and_deduplicates(self):
        with tempfile.TemporaryDirectory() as temp:
            config = {**sup.CFG, "critical_urls": ["https://example.invalid/"],
                      "queue_databases": {"marketing": str(Path(temp) / "missing.db")}}
            with patch.object(sup, "DB", Path(temp) / "state.sqlite3"), \
                 patch.object(sup, "CFG", config), \
                 patch.object(sup, "command", return_value={"entries": []}), \
                 patch.object(sup.urllib.request, "urlopen", side_effect=OSError("offline")), \
                 patch.object(sup.time, "time", side_effect=[1000, 1300, 1360]):
                output = []
                for _ in range(3):
                    buffer = io.StringIO()
                    with redirect_stdout(buffer):
                        sup.critical()
                    output.append(buffer.getvalue())
            self.assertEqual(output[0], "\n")
            self.assertIn("Production site unreachable", output[1])
            self.assertEqual(output[2], "\n")


if __name__ == "__main__":
    unittest.main()
