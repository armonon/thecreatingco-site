import json
from pathlib import Path
import tempfile
import unittest
from anomalies import sync
from company import Engine

class AnomalyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.root=Path(self.tmp.name)
        (self.root/'data').mkdir()
        (self.root/'data/cost-snapshot.json').write_text(json.dumps({'observed_at':'2026-10-09T06:00:00+00:00','anomalies':[{'kind':'repeated_failures','count':14}]}))
    def tearDown(self): self.tmp.cleanup()
    def test_idempotent_without_resetting_owner(self):
        first=sync(self.root);self.assertEqual(len(first['created']),1)
        engine=Engine(self.root);t=engine.claim('owner');engine.close()
        self.assertEqual(sync(self.root)['created'],[])
        engine=Engine(self.root)
        self.assertEqual(engine.heartbeat(t['task_id'],'owner',t['lease_token'])['status'],'RUNNING');engine.close()
    def test_pause_creates_no_database(self):
        (self.root/'PAUSE').touch();self.assertEqual(sync(self.root)['status'],'paused')
        self.assertFalse((self.root/'engine/company.sqlite3').exists())
    def test_private_or_unstructured_kind_not_exported(self):
        (self.root/'data/cost-snapshot.json').write_text(json.dumps({'observed_at':'2026-10-09T06:00:00+00:00','anomalies':[{'kind':'someone@example.com'}]}))
        self.assertEqual(sync(self.root)['created'],[])

if __name__=='__main__':unittest.main()
