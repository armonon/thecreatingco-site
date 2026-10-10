import concurrent.futures
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location('company',Path(__file__).with_name('company.py'))
company = importlib.util.module_from_spec(spec)
spec.loader.exec_module(company)

class EngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root/'data').mkdir()
        self.write('products',[{'product_id':'p1','product_name':'One','maturity':'BETA','kind':'module','quality_scores':None,'custom':{'preserved':True}}])
        self.write('candidates',[self.task('one')])
        self.write('context',{'company':'Test Co','metrics':{'visitors':{'value':None,'source':None,'period':None}}})
        self.engine = company.Engine(self.root)
        self.engine.init()
    def tearDown(self):
        self.engine.close()
        self.tmp.cleanup()
    def write(self,name,value):
        (self.root/'data'/f'{name}.json').write_text(json.dumps(value))
    def task(self,id,**kwargs):
        return dict(task_id=id,title=id,scores={'impact':7,'user_value':9,'confidence':8,'effort':2,'risk':1},**kwargs)
    def expire(self):
        with self.engine.transaction():
            task = self.engine.get_tasks()[0]
            token = self.engine.db.execute('SELECT token FROM tasks WHERE id=?',(task['task_id'],)).fetchone()[0]
            task['lease_until']='2000-01-01T00:00:00+00:00'
            self.engine.save_task(task,token)
    def test_concurrent_claim_has_exactly_one_winner(self):
        def claim(i):
            engine=company.Engine(self.root)
            try:
                return engine.claim(str(i))
            finally:
                engine.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(claim,range(8)))
        self.assertEqual(sum(r.get('status')=='RUNNING' for r in results),1)
        self.assertEqual(self.engine.get_tasks()[0]['attempts'],1)
        self.assertEqual(self.engine.db.execute("SELECT COUNT(*) FROM events WHERE type='CLAIMED'").fetchone()[0],1)
    def test_severity_beats_numeric_score_and_product_claims_are_exclusive(self):
        self.engine.enqueue(self.task('critical',severity='P0',product='p1'))
        self.engine.enqueue(self.task('related',severity='P1',product='p1'))
        self.assertEqual(self.engine.claim('a')['task_id'],'critical')
        self.assertFalse(self.engine.claim('b','related')['claimed'])
        self.assertEqual(self.engine.claim('b')['task_id'],'one')
    def test_capsule_budgets_validate_and_survive_revision(self):
        changed=self.engine.revise({'task_id':'one','token_budget':8000,'tool_budget':30,'model_tier':'LUNA'},'bounded capsule')
        self.assertEqual(changed['token_budget'],8000)
        with self.assertRaisesRegex(ValueError,'tool_budget'):
            self.engine.revise({'task_id':'one','tool_budget':-1},'invalid')
        self.assertEqual(self.engine.get_tasks()[0]['tool_budget'],30)
    def test_product_and_task_holds_cannot_be_claimed(self):
        self.engine.enqueue(self.task('held',product='p1',severity='P0'))
        self.engine.update_products({'product_id':'p1','execution_hold':'owner hold'})
        self.assertFalse(self.engine.claim('worker','held')['claimed'])
        self.engine.enqueue(self.task('task-held',execution_hold=True,severity='P0'))
        self.assertFalse(self.engine.claim('worker','task-held')['claimed'])
        self.assertEqual(self.engine.claim('worker')['task_id'],'one')
    def test_flagship_reprioritization_preserves_fencing_and_validates_severity(self):
        revised=self.engine.revise({'task_id':'one','severity':'P0','area':'persistence','test_requirements':'Save/reopen compare'},'Reproduced data loss')
        self.assertEqual(revised['severity'],'P0')
        with self.assertRaisesRegex(ValueError,'severity'):
            self.engine.revise({'task_id':'one','severity':'P9'},'Invalid category')
        self.assertEqual(self.engine.get_tasks()[0]['severity'],'P0')
        claimed=self.engine.claim('worker','one')
        with self.assertRaisesRegex(ValueError,'running'):
            self.engine.revise({'task_id':'one','severity':'P5'},'Must not mutate owned work')
        self.assertEqual(self.engine.heartbeat('one','worker',claimed['lease_token'])['status'],'RUNNING')
    def test_stale_owner_fenced_even_when_owner_name_reused(self):
        old=self.engine.claim('same')
        self.expire()
        self.engine.recover()
        new=self.engine.claim('same')
        self.assertNotEqual(old['lease_token'],new['lease_token'])
        with self.assertRaisesRegex(ValueError,'Stale'):
            self.engine.heartbeat('one','same',old['lease_token'])
        with self.assertRaisesRegex(ValueError,'Stale'):
            self.engine.finish('one','same',old['lease_token'],'BLOCKED','stale')
        self.assertEqual(self.engine.heartbeat('one','same',new['lease_token'])['status'],'RUNNING')
    def test_recovery_retry_limit(self):
        for i in range(3):
            self.assertEqual(self.engine.claim('worker')['attempts'],i+1)
            self.expire()
            self.engine.recover()
        self.assertEqual(self.engine.get_tasks()[0]['status'],'BLOCKED')
        self.assertFalse(self.engine.claim('worker')['claimed'])
    def test_failed_retry_limit(self):
        for i in range(3):
            task=self.engine.claim('worker')
            self.engine.finish('one','worker',task['lease_token'],'FAILED','distinct failure '+str(i))
        self.assertEqual(self.engine.get_tasks()[0]['status'],'BLOCKED')
    def test_identical_failure_has_only_one_retry(self):
        for i in range(2):
            task=self.engine.claim('worker')
            self.engine.finish('one','worker',task['lease_token'],'FAILED','same build error')
        self.assertEqual(self.engine.get_tasks()[0]['status'],'BLOCKED')
        self.assertFalse(self.engine.claim('worker')['claimed'])
    def test_dependencies_only_complete_unblocks(self):
        self.engine.enqueue(self.task('two',dependencies=['one']))
        self.assertFalse(self.engine.claim('w','two')['claimed'])
        task=self.engine.claim('w','one')
        evidence=self.root/'proof.txt'
        evidence.write_text('Verified checks\n')
        self.engine.finish('one','w',task['lease_token'],'COMPLETE','verified',evidence=str(evidence))
        self.assertEqual(self.engine.claim('w','two')['task_id'],'two')
        with self.assertRaisesRegex(ValueError,'Unknown dependency'):
            self.engine.enqueue(self.task('three',dependencies=['missing']))
    def test_corrupt_seed_does_not_wipe_database(self):
        task=self.engine.claim('w')
        count=self.engine.db.execute('SELECT COUNT(*) FROM events').fetchone()[0]
        (self.root/'data/candidates.json').write_text('{ bad json')
        with self.assertRaises(ValueError):
            self.engine.init()
        self.assertEqual(self.engine.get_tasks()[0]['status'],'RUNNING')
        self.assertEqual(self.engine.db.execute('SELECT COUNT(*) FROM events').fetchone()[0],count)
        self.assertEqual(self.engine.heartbeat('one','w',task['lease_token'])['status'],'RUNNING')
    def test_init_preserves_queue_and_history(self):
        task=self.engine.claim('w')
        self.engine.init()
        self.assertEqual(self.engine.get_tasks()[0]['attempts'],1)
        self.assertEqual(self.engine.heartbeat('one','w',task['lease_token'])['status'],'RUNNING')
    def test_requires_completion_evidence(self):
        task=self.engine.claim('w')
        for status in ('COMPLETE','NEEDS_REVIEW'):
            with self.assertRaisesRegex(ValueError,'evidence'):
                self.engine.finish('one','w',task['lease_token'],status,'done')
        self.assertEqual(self.engine.get_tasks()[0]['status'],'RUNNING')
    def test_unknown_truthful_atomic_and_private_token(self):
        task=self.engine.claim('w')
        content=(self.root/'COMPANY_STATE.md').read_text()
        self.assertIn('Unknown / not scored',content)
        self.assertIn('Unknown / not measured: visitors',content)
        self.assertNotIn(task['lease_token'],content)
        self.assertNotIn(task['lease_token'],(self.root/'TASK_QUEUE.json').read_text())
        registry=json.loads((self.root/'PRODUCT_REGISTRY.json').read_text())
        self.assertTrue(registry['products'][0]['custom']['preserved'])
        file=self.root/'atomic.txt'
        file.write_text('old valid snapshot')
        with mock.patch.object(company.os,'replace',side_effect=OSError('disk fault')):
            with self.assertRaises(OSError):
                company.atomic_write(file,'new snapshot')
        self.assertEqual(file.read_text(),'old valid snapshot')
        self.assertEqual(list(self.root.glob('.atomic.txt.*')),[])
    def test_priority_and_unknown_priority(self):
        self.assertEqual(self.engine.get_tasks()[0]['priority'],126)
        self.engine.enqueue({'task_id':'unknown','title':'unknown'})
        self.assertIsNone(next(t for t in self.engine.get_tasks() if t['task_id']=='unknown')['priority'])
    def test_dependency_cycle_rejected_without_mutation(self):
        self.write('candidates',[self.task('a',dependencies=['b']),self.task('b',dependencies=['a'])])
        with self.assertRaisesRegex(ValueError,'cycle'):
            self.engine.init()
        self.assertEqual(len(self.engine.get_tasks()),1)

    def test_review_revision_reason_and_preserved_attempts(self):
        self.engine.enqueue(self.task('idea',status='WAITING'))
        self.assertFalse(self.engine.claim('w','idea')['claimed'])
        with self.assertRaisesRegex(ValueError,'reason'):
            self.engine.revise({'task_id':'idea','status':'QUEUED'},'')
        self.engine.revise({'task_id':'idea','status':'QUEUED'},'Customer interviews validate pain')
        self.assertEqual(self.engine.claim('w','idea')['status'],'RUNNING')
        with self.assertRaisesRegex(ValueError,'running'):
            self.engine.revise({'task_id':'idea','title':'changed'},'Plan change')
    def test_live_context_and_product_updates(self):
        self.engine.update_context({'biggest_bottleneck':'Missing measurement','metrics':{'downloads':{'value':None}}})
        with self.assertRaisesRegex(ValueError,'require source'):
            self.engine.update_context({'metrics':{'visitors':{'value':412}}})
        self.engine.update_context({'metrics':{'visitors':{'value':4,'source':'test fixture','period':'2026-10-01/2026-10-07','observed_at':company.now()}}})
        self.engine.update_products({'product_id':'p1','maturity':'RELEASE_CANDIDATE'})
        snapshot=self.engine.refresh()
        self.assertIn('downloads',snapshot['context']['metrics'])
        self.assertEqual(snapshot['context']['metrics']['visitors']['value'],4)
        self.assertTrue(snapshot['products'][0]['custom']['preserved'])
        self.assertEqual(snapshot['products'][0]['maturity'],'RELEASE_CANDIDATE')
    def test_marketing_readonly_aggregates_unknowns_and_private_fields(self):
        path=self.root/'marketing.sqlite'
        db=company.sqlite3.connect(path)
        db.executescript("""
          CREATE TABLE campaigns(campaign_id TEXT,name TEXT,product TEXT,status TEXT,goal TEXT,updated_at TEXT,private_email TEXT);
          INSERT INTO campaigns VALUES('c1','Launch','p1','draft','Test','2026-10-07','secret@example.com');
          CREATE TABLE outcomes(ts TEXT,impressions REAL,signups REAL);
          INSERT INTO outcomes VALUES('2026-10-07',NULL,NULL);
          CREATE TABLE leads(email TEXT);
          INSERT INTO leads VALUES('another-secret@example.com');
          CREATE TABLE tasks(task_id TEXT,status TEXT);
          INSERT INTO tasks VALUES('t1','queued');
        """)
        db.commit()
        db.close()
        before=path.read_bytes()
        result=company.marketing_summary(str(path),self.root)
        self.assertEqual(result['status'],'read_only_snapshot')
        self.assertIsNone(result['outcomes']['signups']['sum_of_recorded_values'])
        self.assertEqual(result['outcomes']['signups']['recorded_values'],0)
        self.assertEqual(result['queue_statuses']['tasks']['queued'],1)
        self.assertNotIn('secret@example.com',json.dumps(result))
        self.assertEqual(before,path.read_bytes())

    def test_init_preserves_live_context_and_products(self):
        self.engine.update_context({'metrics':{'visitors':{'value':17,'source':'fixture','period':'week','observed_at':company.now()}},'biggest_bottleneck':'Live finding'})
        self.engine.update_products({'product_id':'p1','maturity':'PRODUCTION'})
        before=self.engine.refresh()
        self.engine.init()
        after=self.engine.refresh()
        self.assertEqual(after['context'],before['context'])
        self.assertEqual(after['products'],before['products'])
        self.assertEqual(after['sources_loaded_at'],before['sources_loaded_at'])
    def test_product_validation_is_atomic(self):
        before=self.engine.refresh()['products']
        events=self.engine.db.execute('SELECT COUNT(*) FROM events').fetchone()[0]
        for bad in ({'product_id':'p2','kind':'other'}, {'product_id':'p2','kind':'module','maturity':'PERFECT'}, {'product_id':'p2','kind':'module','parent_product_id':'missing'}):
            with self.assertRaises(ValueError):
                self.engine.update_products([{'product_id':'p1','maturity':'PRODUCTION'},bad])
            self.assertEqual(self.engine.refresh()['products'],before)
            self.assertEqual(self.engine.db.execute('SELECT COUNT(*) FROM events').fetchone()[0],events)
        with self.assertRaisesRegex(ValueError,'cycle'):
            self.engine.update_products([{'product_id':'p1','parent_product_id':'p2'},{'product_id':'p2','kind':'module','parent_product_id':'p1'}])
        self.engine.update_products([{'product_id':'p2','kind':'module','parent_product_id':'p1'},{'product_id':'p1','maturity':None}])
        self.assertEqual(len(self.engine.refresh()['products']),2)
    def test_quality_and_user_metrics_require_evidence(self):
        for bad in ({'quality_score':9},{'quality_scores':{'design':8}},{'quality_score':0},{'quality_scores':{'design':True}},{'active_users':12},{'active_users':-1}):
            with self.assertRaises(ValueError):
                self.engine.update_products(dict(product_id='p1',**bad))
        self.engine.update_products({'product_id':'p1','quality_score':8,'quality_scores':{'design':7,'ux':None},'evidence_sources':['benchmark.md'],'observed_at':company.now(),'quality_evidence':{'source':'benchmark.md','rubric':'review rubric'},'active_users':0,'user_metrics_evidence':{'source':'analytics','period':'week','observed_at':company.now()}})
        product=self.engine.refresh()['products'][0]
        self.assertEqual(product['quality_score'],8)
        self.assertEqual(product['active_users'],0)
    def test_updates_audit_before_and_after_values(self):
        self.engine.update_context({'biggest_bottleneck':'Recorded finding'})
        event=json.loads(self.engine.db.execute("SELECT body FROM events WHERE type='CONTEXT_UPDATED' ORDER BY id DESC LIMIT 1").fetchone()[0])
        self.assertNotIn('biggest_bottleneck',event['before'])
        self.assertEqual(event['after']['biggest_bottleneck'],'Recorded finding')
        self.assertEqual(event['patch']['biggest_bottleneck'],'Recorded finding')
        self.engine.update_products({'product_id':'p1','maturity':'PRODUCTION'})
        event=json.loads(self.engine.db.execute("SELECT body FROM events WHERE type='PRODUCT_UPDATED' ORDER BY id DESC LIMIT 1").fetchone()[0])
        self.assertEqual(event['before']['maturity'],'BETA')
        self.assertEqual(event['after']['maturity'],'PRODUCTION')
    def test_health_provenance_and_old_results_survive_updates(self):
        with self.assertRaisesRegex(ValueError,'Health score requires'):
            self.engine.update_context({'health':{'score':7.4}})
        self.engine.update_context({'health':{'score':7.4,'source':'evidence.md','observed_at':company.now(),'rubric':'weighted measured rubric','coverage':'1 of 1 fixture'}})
        self.assertIn('7.4/10',company.render(self.engine.refresh()))
        claim=self.engine.claim('w')
        proof=self.root/'proof.txt'
        proof.write_text('Completed verification')
        self.engine.finish('one','w',claim['lease_token'],'COMPLETE','Durable result',evidence=str(proof))
        for i in range(15):
            self.engine.update_context({'next_strategic_move':f'Step {i}'})
        self.assertIn('Durable result',company.render(self.engine.refresh()))

if __name__=='__main__':
    unittest.main()
