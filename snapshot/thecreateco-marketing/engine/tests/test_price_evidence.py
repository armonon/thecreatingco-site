"""Focused no-network regression for unknown model list prices."""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from mktg.db import connect
from mktg.providers import price, record_call


class PriceEvidenceTests(unittest.TestCase):
    def test_missing_sol_rate_persists_null_not_zero(self):
        cfg = {"prices_per_mtok": {}}
        self.assertIsNone(price(cfg, "openai/gpt-6.1-sol", 100, 0, 10))
        with tempfile.TemporaryDirectory() as folder:
            db = connect(os.path.join(folder, "test.db"))
            try:
                record_call(db, cfg, model="openai/gpt-6.1-sol", role="sol", task={"task_id": "T1"},
                            res={"input_tokens": 100, "output_tokens": 10, "cached_tokens": 0}, ok=True)
                self.assertIsNone(db.execute("SELECT est_cost FROM model_calls").fetchone()[0])
            finally:
                db.close()

    def test_configured_zero_and_existing_positive_prices_preserved(self):
        cfg = {"prices_per_mtok": {"priced": {"in": 2, "cached": .2, "out": 10},
                                   "zero": {"in": 0, "cached": 0, "out": 0}}}
        self.assertEqual(price(cfg, "priced", 100, 0, 10), .0003)
        self.assertEqual(price(cfg, "priced", 0, 0, 0), 0)
        self.assertEqual(price(cfg, "zero", 100, 0, 10), 0)


if __name__ == "__main__":
    unittest.main()
