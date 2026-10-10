"""The 12 acceptance tests. Run: cd engine && python3 -m unittest -v tests.test_engine

Uses fake adapters (no network, no spend). tests/test_live.py does a real smoke run against all four models.
"""
import json
import os
import random
import shutil
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mktg import engine, memory, telemetry  # noqa: E402
from mktg.db import connect, today  # noqa: E402
from mktg.providers import ProviderError  # noqa: E402
from mktg.router import load_config, route  # noqa: E402

ROUTINE_TYPES = ["research_summary", "extract", "lead_classify", "lead_score", "keyword_research", "headline_variations",
                 "social_variations", "categorize", "structured_json", "analytics_summary", "forum_classify", "format",
                 "repurpose", "community_discovery", "cta_variations", "email_personalize", "first_draft"]


class Fake:
    """Fake provider adapters. down = set of providers or model ids that fail with the given kind."""

    def __init__(self):
        self.calls = []
        self.down = {}
        self.failures_left = {}
        self.review_verdict = "APPROVE"

    def _call(self, model, system, user, reasoning):
        prov = model.split("/")[0]
        kind = self.down.get(model) or self.down.get(prov)
        self.calls.append((model, len(system) + len(user)))
        if self.failures_left.get(model, 0):
            self.failures_left[model] -= 1
            raise ProviderError("rate_limit", f"{model} temporary rate limit")
        if kind:
            raise ProviderError(kind, f"{model} unavailable ({kind})")
        if "VERDICT:" in user:
            text = f"VERDICT: {self.review_verdict}\nCONFIDENCE: 82\nCRITICAL ISSUES:\n- none\nRECOMMENDED CHANGES:\n- tighten line 2"
        elif "OUTPUT: valid JSON only." in user:
            text = json.dumps({"ok": True, "items": [1, 2, 3]})
        else:
            text = f"[{model}] draft for: {user.splitlines()[1][:60]}"
        return {"text": text, "latency_ms": 5, "input_tokens": (len(system) + len(user)) // 4, "output_tokens": 50,
                "cached_tokens": len(system) // 4, "tokens_estimated": 0, "cost": None}

    @property
    def adapters(self):
        return {"openai": self._call, "anthropic": self._call}

    def models(self):
        return [c[0] for c in self.calls]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.conn = connect(os.path.join(self.tmp, "t.db"))
        self.cfg = load_config()
        self.fake = Fake()
        engine.RESULTS_DIR = os.path.join(self.tmp, "results")

    def tearDown(self):
        self.conn.close()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_all(self, max_ticks=200):
        for _ in range(max_ticks):
            s = engine.tick(self.conn, self.cfg, 50, self.fake.adapters, fetcher=False)
            if sum(s.values()) == 0:
                break

    def roles_called(self):
        return [r["role"] for r in self.conn.execute("SELECT role FROM model_calls WHERE ok=1")]


class T01RoutineMostlyLuna(Base):
    def test_100_routine_tasks(self):
        random.seed(1)
        for i in range(100):
            engine.enqueue(self.conn, self.cfg, random.choice(ROUTINE_TYPES), f"routine {i}",
                           {"instructions": "do it"}, importance=random.choice([0, 1]), creativity=random.choice([0, 1]))
        self.run_all()
        roles = self.roles_called()
        self.assertEqual(len(roles), 100)
        self.assertGreaterEqual(roles.count("luna") / len(roles), 0.9, roles)
        self.assertNotIn("opus", roles)
        self.assertTrue(all(m.startswith("openai/gpt-6-luna") for m in self.fake.models()))


class T02CreativeOpenAI(Base):
    def test_routine_creative_stays_on_luna_and_invention_is_explicit(self):
        for tt in ("community_post", "launch_copy", "outreach_copy", "kickstarter_copy", "landing_copy"):
            engine.enqueue(self.conn, self.cfg, tt, f"{tt} for Glyph Studio", {"product": "Glyph Studio"}, importance=2, creativity=3)
        self.assertEqual(route({"task_type": "campaign_concept", "importance": 2, "creativity": 3}, self.cfg)["role"], "luna")
        invention = route({"task_type": "campaign_concept", "importance": 3, "creativity": 3}, self.cfg)
        self.assertEqual(invention["role"], "luna")
        self.assertEqual(invention["preferred_model"], "openai/gpt-6-luna")
        self.run_all()
        self.assertEqual(set(self.fake.models()), {"openai/gpt-6-luna"})

    def test_bulk_variations_stay_luna(self):
        self.assertEqual(route({"task_type": "headline_variations", "importance": 0, "creativity": 2}, self.cfg)["role"], "luna")


class T03StrategySol(Base):
    def test_strategy_routes_to_sol(self):
        for tt in ("campaign_plan", "rank_opportunities", "experiment_eval", "audience_selection"):
            d = route({"task_type": tt, "importance": 2, "complexity": 3}, self.cfg)
            self.assertEqual(d["role"], "sol", tt)
            self.assertEqual(d["preferred_model"], "openai/gpt-6.1-sol")
            self.assertIn(d["reasoning"], ("medium", "high"))
        self.assertEqual(route({"task_type": "extract", "complexity": 0}, self.cfg)["reasoning"], "low")


class T04OpusReview(Base):
    def test_major_campaign_triggers_opus_once_per_cap(self):
        engine.ensure_campaign(self.conn, "ks", "Kickstarter master story", "Form Studio", tier="major")
        engine.enqueue(self.conn, self.cfg, "kickstarter_copy", "KS master story", {"product": "Form Studio"},
                       campaign_id="ks", importance=3, creativity=3, review_level="opus")
        self.run_all()
        roles = self.roles_called()
        self.assertEqual(roles.count("opus"), 1, roles)
        self.assertIn("sol", roles)       # alignment review ran before Opus
        self.assertIn("luna", roles)       # routine creative work uses Luna
        rv = self.conn.execute("SELECT * FROM reviews WHERE mode='opus'").fetchone()
        self.assertEqual(rv["verdict"], "APPROVE")
        self.assertEqual(self.conn.execute("SELECT opus_reviews_used FROM campaigns").fetchone()[0], 1)

    def test_reject_allows_one_final_check_then_stops(self):
        engine.ensure_campaign(self.conn, "ks", "KS", "Form Studio", tier="major")
        self.fake.review_verdict = "REJECT"
        engine.enqueue(self.conn, self.cfg, "kickstarter_copy", "KS story", {}, campaign_id="ks", importance=3,
                       creativity=3, review_level="opus")
        self.run_all()
        opus_calls = self.roles_called().count("opus")
        self.assertEqual(opus_calls, 2)  # initial + ONE final check; never recursive
        types = [r[0] for r in self.conn.execute("SELECT task_type FROM tasks")]
        self.assertIn("revise_strategy", types)
        self.assertIn("revise_copy", types)

    def test_routine_never_reaches_opus(self):
        engine.ensure_campaign(self.conn, "r", "routine social", tier="routine")
        engine.enqueue(self.conn, self.cfg, "final_review", "review routine post", {}, campaign_id="r", importance=3)
        engine.enqueue(self.conn, self.cfg, "final_review", "review low-importance", {}, importance=1)
        self.run_all()
        self.assertNotIn("opus", self.roles_called())

    def test_sol_plan_cannot_summon_opus(self):
        plan = {"tasks": [{"task_type": "final_review", "title": "x"}, {"task_type": "extract", "title": "y"}]}
        tid = engine.enqueue(self.conn, self.cfg, "next_actions", "plan", {"output": "json"}, importance=2)
        self.conn.execute("INSERT INTO results(task_id,role,model,content) VALUES (?,?,?,?)", (tid, "sol", "m", json.dumps(plan)))
        n = engine._spawn_from_plan(self.conn, self.cfg, {"task_id": tid, "campaign_id": None})
        self.assertEqual(n, 1)


class T05FormerClaudeFallback(Base):
    def test_no_anthropic_route_exists(self):
        for role, spec in self.cfg["roles"].items():
            self.assertTrue(all(m.startswith("openai/") for m in spec["chain"]), role)
        for tt in ("community_post", "extract", "campaign_plan"):
            self.assertTrue(all(m.startswith("openai/") for m in route({"task_type": tt}, self.cfg)["chain"]))


class T06OpenAIDown(Base):
    def test_openai_failure_waits_without_non_openai_escape(self):
        self.fake.down["openai"] = "auth"
        engine.enqueue(self.conn, self.cfg, "extract", "routine", {})
        engine.enqueue(self.conn, self.cfg, "campaign_plan", "plan", {}, importance=2, complexity=3)
        engine.enqueue(self.conn, self.cfg, "launch_copy", "copy", {}, importance=2, creativity=3)
        self.run_all()
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM tasks WHERE status='WAITING'").fetchone()[0], 3)
        self.assertTrue(all(m.startswith("openai/") for m in self.fake.models()))


class T07OpusQuota(Base):
    def test_legacy_opus_role_uses_openai_review_policy(self):
        engine.ensure_campaign(self.conn, "big", "launch", tier="major")
        engine.enqueue(self.conn, self.cfg, "launch_copy", "launch post", {}, campaign_id="big", importance=3,
                       creativity=3, review_level="opus")
        self.run_all()
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM tasks WHERE status NOT IN ('COMPLETE')").fetchone()[0], 0)
        self.assertTrue(all(model.startswith("openai/") for model in self.fake.models()))


class ReviewProviderPolicy(Base):
    def test_all_review_routes_and_consensus_are_openai_only(self):
        for kind in ("final_review", "creative_review", "strategy_review", "alignment_review", "second_opinion"):
            decision = route({"task_type": kind, "importance": 3}, self.cfg, {"tier": "major"})
            self.assertTrue(all(m.startswith("openai/") for m in decision["chain"]), kind)
        engine.enqueue(self.conn, self.cfg, "final_review", "Routine consensus", {}, importance=1)
        self.run_all()
        self.assertTrue(self.fake.models())
        self.assertTrue(all(m.startswith("openai/") for m in self.fake.models()))
        self.assertEqual(set(self.fake.models()), {"openai/gpt-6.1-sol"})

    def test_active_config_routes_are_openai_only_and_successful_luna_does_not_escalate(self):
        for role, spec in self.cfg["roles"].items():
            self.assertTrue(all(model.startswith("openai/") for model in spec["chain"]), role)
        for task_type, role in self.cfg["task_types"].items():
            d = route({"task_type": task_type, "importance": 3, "creativity": 3, "complexity": 4}, self.cfg,
                      {"tier": "major"})
            self.assertTrue(all(model.startswith("openai/") for model in d["chain"]), task_type)
        tid = engine.enqueue(self.conn, self.cfg, "launch_copy", "successful Luna copy", {}, importance=3, creativity=3)
        engine.tick(self.conn, self.cfg, 1, self.fake.adapters, fetcher=False)
        self.assertEqual(self.fake.models(), ["openai/gpt-6-luna"])
        self.assertEqual(self.conn.execute("SELECT model_used FROM tasks WHERE task_id=?", (tid,)).fetchone()[0],
                         "openai/gpt-6-luna")

    def test_retry_budgets_are_luna_two_attempts_and_sol_one(self):
        luna = engine.enqueue(self.conn, self.cfg, "extract", "Luna retries identical transient failure", {})
        self.fake.failures_left["openai/gpt-6-luna"] = 1
        engine.tick(self.conn, self.cfg, 1, self.fake.adapters, fetcher=False)
        self.assertEqual(self.fake.models(), ["openai/gpt-6-luna", "openai/gpt-6-luna"])
        self.assertEqual(self.conn.execute("SELECT status FROM tasks WHERE task_id=?", (luna,)).fetchone()[0], "COMPLETE")
        sol = engine.enqueue(self.conn, self.cfg, "campaign_plan", "Sol has one attempt", {}, importance=2, complexity=3)
        self.fake.failures_left["openai/gpt-6.1-sol"] = 1
        engine.tick(self.conn, self.cfg, 1, self.fake.adapters, fetcher=False)
        self.assertEqual(self.fake.models().count("openai/gpt-6.1-sol"), 1)
        self.assertEqual(self.conn.execute("SELECT status FROM tasks WHERE task_id=?", (sol,)).fetchone()[0], "WAITING")

    def test_review_waits_if_openai_unavailable_without_claude_escape(self):
        self.fake.down["openai"] = "quota"
        engine.ensure_campaign(self.conn, "policy", "review", tier="major")
        tid = engine.enqueue(self.conn, self.cfg, "final_review", "Independent review", {},
                             campaign_id="policy", importance=3)
        engine.tick(self.conn, self.cfg, 1, self.fake.adapters, fetcher=False)
        self.assertEqual(self.conn.execute("SELECT status FROM tasks WHERE task_id=?", (tid,)).fetchone()[0], "WAITING")
        self.assertTrue(all(m.startswith("openai/") for m in self.fake.models()))


class T08CrashResume(Base):
    def test_stale_running_recovered_without_restart(self):
        ids = [engine.enqueue(self.conn, self.cfg, "extract", f"t{i}", {}) for i in range(6)]
        engine.tick(self.conn, self.cfg, 3, self.fake.adapters, fetcher=False)
        crashed = engine.claim_next(self.conn, self.cfg)          # claimed, then the process "dies"
        self.conn.execute("UPDATE tasks SET lease_until=? WHERE task_id=?", (time.time() - 1, crashed["task_id"]))
        before = len(self.fake.calls)
        self.run_all()
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM tasks WHERE status='COMPLETE'").fetchone()[0], 6)
        self.assertEqual(len(self.fake.calls) - before, 3, "only the unfinished 3 run; completed work is not redone")
        r = self.conn.execute("SELECT retry_count FROM tasks WHERE task_id=?", (crashed["task_id"],)).fetchone()
        self.assertEqual(r[0], 1)


class T09MinimalContext(Base):
    def test_large_history_gets_retrieval_not_everything(self):
        for i in range(4000):
            memory.add_note(self.conn, kind="research", title=f"old note {i}",
                            body=("3D app history and unrelated campaign chatter " * 30), product="Form Studio")
        memory.add_note(self.conn, kind="research", title="StemDeck producer pain: stems split across tools",
                        body="Producers on r/edmproduction complain stems live in five apps.", product="StemDeck")
        tid = engine.enqueue(self.conn, self.cfg, "outreach_copy", "Email a producer about StemDeck stems",
                             {"instructions": "Write to a bedroom producer about stems", "product": "StemDeck"},
                             importance=2, creativity=3)
        t = dict(self.conn.execute("SELECT * FROM tasks WHERE task_id=?", (tid,)).fetchone())
        d = route(dict(t, payload={}), self.cfg)
        system, user, _ = engine.build_prompt(self.conn, self.cfg, t, d, fetcher=False)
        self.assertIn("stems live in five apps", user)
        self.assertNotIn("3D app history", user)
        self.assertLess(len(user), d["context_chars"] + 6000)  # instructions + product facts + capped retrieval


class T10DuplicateLead(Base):
    def test_no_duplicate_outreach(self):
        a, new_a = memory.upsert_lead(self.conn, name="DJ X", url="https://www.youtube.com/@DJTechTips/videos?utm_source=x",
                                      email="DJ.X+promo@" + "Gmail.com")
        b, new_b = memory.upsert_lead(self.conn, name="DJ X dup", url="youtube.com/@djtechtips/")
        c, new_c = memory.upsert_lead(self.conn, name="DJ X dup2", email="djx@" + "gmail.com")
        self.assertTrue(new_a); self.assertFalse(new_b); self.assertFalse(new_c)
        self.assertEqual(a, b); self.assertEqual(a, c)
        self.assertEqual(memory.can_contact(self.conn, self.cfg, a, "initial")[0], True)
        memory.record_contact(self.conn, self.cfg, a, "initial", subject="hi")
        ok, why = memory.can_contact(self.conn, self.cfg, a, "initial")
        self.assertFalse(ok); self.assertIn("already contacted", why)
        with self.assertRaises(ValueError):
            memory.record_contact(self.conn, self.cfg, a, "initial")
        self.assertFalse(memory.can_contact(self.conn, self.cfg, a, "followup")[0])  # too soon

    def test_dnc_and_daily_cap(self):
        lid, _ = memory.upsert_lead(self.conn, name="opted", email="no@example.test")
        memory.add_dnc(self.conn, email="NO@example.test")
        self.assertEqual(memory.can_contact(self.conn, self.cfg, lid)[1], "do-not-contact")
        later, _ = memory.upsert_lead(self.conn, name="opted again", email="no@example.test")
        self.assertEqual(later, lid)
        for i in range(10):
            l, _ = memory.upsert_lead(self.conn, name=f"p{i}", email=f"p{i}@example.test")
            memory.record_contact(self.conn, self.cfg, l, "initial")
        l11, _ = memory.upsert_lead(self.conn, name="p11", email="p11@example.test")
        self.assertIn("daily new-recipient cap", memory.can_contact(self.conn, self.cfg, l11)[1])


class T11NoContextGrowth(Base):
    def test_hundreds_of_tasks_flat_context(self):
        for i in range(300):
            engine.enqueue(self.conn, self.cfg, random.choice(ROUTINE_TYPES), f"task {i} about Form Studio rings",
                           {"instructions": "summarize", "product": "Form Studio"})
            if i % 10 == 0:
                memory.add_note(self.conn, kind="result", title=f"result {i} Form Studio rings", body="ring notes " * 200)
        self.run_all()
        sizes = [r[0] for r in self.conn.execute("SELECT prompt_chars FROM model_calls ORDER BY id")]
        self.assertEqual(len(sizes), 300)
        first, last = max(sizes[:50]), max(sizes[-50:])
        self.assertLessEqual(last, first * 1.25 + 500, (first, last))
        self.assertLess(max(sizes), self.cfg["token_budgets"]["luna"]["context_chars"] + 8000)
        st = memory.render_state(self.conn, self.cfg)
        self.assertLess(len(st), self.cfg["state"]["max_chars"])


class T12AbnormalSpend(Base):
    def test_detects_premium_spike(self):
        day = today()
        for i in range(30):
            role = "opus" if i < 7 else "luna"
            self.conn.execute("INSERT INTO model_calls(ts,day,provider,model,role,est_cost,ok,input_tokens,output_tokens,cached_tokens) "
                              "VALUES (?,?,?,?,?,?,1,0,0,0)", (day, day, "anthropic" if role == "opus" else "openai",
                                                             "anthropic/claude-opus-5-5" if role == "opus" else "openai/gpt-6-luna",
                                                             role, 1.2 if role == "opus" else 0.001))
        alerts = telemetry.anomalies(self.conn, self.cfg)
        self.assertTrue(any("opus share" in a for a in alerts), alerts)
        self.assertTrue(any("spend today" in a for a in alerts), alerts)
        self.assertTrue(any("Opus calls today" in a for a in alerts), alerts)
        report = telemetry.spend_report(self.conn, self.cfg)
        self.assertIn("by model", report)
        self.assertIn("alerts:", report)


class T13StrategyLoopGuard(Base):
    def test_no_reconsideration_without_new_data(self):
        engine.enqueue(self.conn, self.cfg, "next_actions", "plan A", {"spawn_tasks": False}, campaign_id=None, importance=2)
        self.run_all()
        engine.enqueue(self.conn, self.cfg, "next_actions", "plan B", {"spawn_tasks": False}, importance=2)
        self.run_all()
        self.assertEqual(self.roles_called().count("sol"), 1)
        err = self.conn.execute("SELECT error FROM tasks WHERE title='plan B'").fetchone()[0]
        self.assertIn("no new data", err)


if __name__ == "__main__":
    unittest.main(verbosity=2)
