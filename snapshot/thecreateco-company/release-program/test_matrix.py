import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('matrix',Path(__file__).with_name('matrix.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class CompletionGate(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.file=Path(self.tmp.name)/'evidence.md';self.file.write_text('Verified fixture evidence')
        gates={g:{'status':'PASS','source_sha':'exact','observed_at':'2026-10-08','coverage_complete':True,'evidence':[str(self.file)]} for g in m.GATES}
        gates['supported_platforms']['platform_results']={'macOS':'PASS','Windows':'PASS'}
        gates['critical_blockers'].update(known_critical_blockers=[],triage_complete=True)
        self.record={'product_id':'test','completion_observations':{'candidate_sha':'exact','supported_platforms':['macOS','Windows'],'gates':gates}}
    def tearDown(self):self.tmp.cleanup()
    def test_all_exact_evidenced_gates_required(self):
        self.assertTrue(m.assess(self.record)['complete'])
        self.record['completion_observations']['gates']['core_workflow']['coverage_complete']=False
        self.assertFalse(m.assess(self.record)['complete'])
    def test_platform_or_known_critical_blocker_prevents_complete(self):
        self.record['completion_observations']['gates']['supported_platforms']['platform_results']['Windows']='UNVERIFIED'
        self.assertFalse(m.assess(self.record)['complete'])
        self.record['completion_observations']['gates']['supported_platforms']['platform_results']['Windows']='PASS'
        self.record['completion_observations']['gates']['critical_blockers']['known_critical_blockers']=['data loss']
        self.assertFalse(m.assess(self.record)['complete'])
    def test_missing_and_stale_evidence_not_passed(self):
        self.record['completion_observations']['candidate_sha']='new-head'
        self.assertFalse(m.assess(self.record)['complete'])
        self.record['completion_observations']['candidate_sha']='exact';self.file.unlink()
        self.assertFalse(m.assess(self.record)['complete'])
    def test_missing_record_is_unverified(self):
        self.assertEqual(set(m.assess({'product_id':'unknown'})['gates'].values()),{'UNVERIFIED'})

if __name__=='__main__':unittest.main()
