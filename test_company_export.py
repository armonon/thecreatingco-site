import json
from pathlib import Path
import subprocess,tempfile,unittest
from archive_product_work import export_commit
from screening import path_reason,content_reason
from sync_snapshot import build


def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args],text=True).strip()

class ExportTests(unittest.TestCase):
    def test_sensitive_paths_content_and_test_fixtures(self):
        self.assertIsNotNone(path_reason('engine/auth-profiles.json'))
        self.assertIsNotNone(path_reason('reports/run-lease.private.json'))
        self.assertIsNone(path_reason('release-program/RELEASE_MATRIX.md'))
        self.assertIsNone(content_reason(b'unit fixture: alice@example.com'))
        self.assertIsNone(content_reason(b'git'+b'@github.com:company/repo.git'))
        self.assertIsNotNone(content_reason(b'person'+b'@github.com'))
        self.assertIsNotNone(content_reason(b'person'+b'@'+b'customer.invalid'))
        self.assertIsNotNone(content_reason(b'sk-'+b'a'*32))
    def test_code_checkpoint_matches_exact_bytes_not_dirty_flags(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);source=root/'thecreateco-company/engine/source.py';source.parent.mkdir(parents=True);source.write_text('answer = 42\n')
            out=root/'out';result=build(out,root,{'files':{}},products=False)
            self.assertTrue(any(x['reason']=='code-checkpoint-not-recorded-or-source-changed' for x in result['skipped']))
            import hashlib
            marker={'files':{'thecreateco-company/engine/source.py':{'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}}}
            out2=root/'out2';result=build(out2,root,marker,products=False)
            self.assertEqual((out2/'thecreateco-company/engine/source.py').read_bytes(),source.read_bytes())
            source.write_text('changed_after_test = True\n');result=build(root/'out3',root,marker,products=False)
            self.assertFalse((root/'out3/thecreateco-company/engine/source.py').exists())
    def test_product_export_uses_commit_not_dirty_files_and_skips_secrets(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);repo=root/'repo';repo.mkdir();git(repo,'init');git(repo,'config','user.name','Fixture');git(repo,'config','user.email','fixture@example.test')
            (repo/'app.js').write_text('export const answer = 1;\n');git(repo,'add','app.js');git(repo,'commit','-m','base');base=git(repo,'rev-parse','HEAD');git(repo,'update-ref','refs/remotes/origin/main',base)
            (repo/'app.js').write_text('export const answer = 2;\n');(repo/'.env').write_text('secret=private\n');(repo/'private.json').write_text(json.dumps({'email':'person'+'@'+'customer.invalid'}));(repo/'link.js').symlink_to('/etc/hosts')
            git(repo,'add','app.js','.env','private.json','link.js');git(repo,'commit','-m','review changes');sha=git(repo,'rev-parse','HEAD')
            (repo/'app.js').write_text('UNVERIFIED DIRTY WORK\n');out=root/'archive';record=export_commit(repo,sha,out)
            self.assertEqual((out/'files/app.js').read_text(),'export const answer = 2;\n')
            self.assertNotIn('UNVERIFIED',(out/'changes.patch').read_text());self.assertEqual(len(record['omitted']),3)
            self.assertFalse((out/'files/.env').exists());self.assertFalse((out/'files/private.json').exists());self.assertFalse((out/'files/link.js').exists())
            self.assertNotIn('customer.invalid',(out/'changes.patch').read_text())

if __name__=='__main__':unittest.main()
