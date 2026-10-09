import unittest
from lab import ranked

def task(id, product='luma', **kw):
    return dict(task_id=id, product=product, status=kw.get('status','QUEUED'),
                severity=kw.get('severity','P1'), priority=kw.get('priority',10),
                dependencies=kw.get('dependencies',[]), execution_hold=kw.get('execution_hold'))

class SelectionTests(unittest.TestCase):
    def test_data_loss_beats_cosmetic_roi(self):
        self.assertEqual(ranked([task('polish',severity='P5',priority=999),task('loss',severity='P0',priority=1)])[0]['task_id'],'loss')
    def test_dependencies_and_explicit_holds(self):
        self.assertEqual(ranked([task('held',execution_hold='approval'),task('missing',dependencies=['absent']),task('done',status='COMPLETE'),task('ready',dependencies=['done'])])[0]['task_id'],'ready')
    def test_no_concurrent_product_ownership_or_unrelated_apps(self):
        self.assertEqual(ranked([task('owner',status='RUNNING'),task('other-luma'),task('new-app',product='idea')]),[])
    def test_unknown_priority_not_fake_zero(self):
        self.assertEqual([t['task_id'] for t in ranked([task('unknown',priority=None),task('measured-estimate',priority=0)])],['measured-estimate','unknown'])
    def test_completed_and_backlog_never_reselected(self):
        self.assertEqual(ranked([task('a',status='COMPLETE'),task('b',status='WAITING'),task('c',status='BLOCKED')]),[])
    def test_product_level_hold_is_authoritative(self):
        self.assertEqual(ranked([task('a')],[{'product_id':'luma','execution_hold':'release/source reconciliation'}]),[])

if __name__ == '__main__': unittest.main()
