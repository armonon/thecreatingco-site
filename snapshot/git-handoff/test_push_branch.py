import pathlib
import subprocess
import tempfile
import unittest
from unittest import mock
import json

from push_branch import handoff, mirror_company


def run(*args, cwd=None):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=True).stdout.strip()


class PushBranchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = pathlib.Path(self.temp.name)
        self.remote = root / "remote.git"
        self.repo = root / "work"
        self.receipts = root / "receipts.jsonl"
        run("git", "init", "--bare", str(self.remote))
        run("git", "init", str(self.repo))
        run("git", "config", "user.name", "Agent", cwd=self.repo)
        run("git", "config", "user.email", "agent@example.test", cwd=self.repo)
        run("git", "remote", "add", "origin", str(self.remote), cwd=self.repo)
        (self.repo / "readme.txt").write_text("initial\n")
        run("git", "add", "readme.txt", cwd=self.repo)
        run("git", "commit", "-m", "initial", cwd=self.repo)
        run("git", "branch", "-M", "main", cwd=self.repo)

    def test_pushes_exact_review_branch_and_records_receipt(self):
        run("git", "switch", "-c", "feat/agent-work", cwd=self.repo)
        sha = run("git", "rev-parse", "HEAD", cwd=self.repo)
        first = handoff(self.repo, sha, self.receipts)
        self.assertEqual(first["result"], "pushed")
        self.assertEqual(run("git", "--git-dir", str(self.remote), "rev-parse", "refs/heads/feat/agent-work"), sha)
        self.assertEqual(handoff(self.repo, sha, self.receipts)["result"], "already-current")
        self.assertEqual(len(self.receipts.read_text().splitlines()), 2)

    def test_refuses_protected_dirty_and_changed_head(self):
        with self.assertRaisesRegex(RuntimeError, "Protected branch"):
            handoff(self.repo, receipt_path=self.receipts)
        run("git", "switch", "-c", "fix/agent-work", cwd=self.repo)
        with self.assertRaisesRegex(RuntimeError, "HEAD changed"):
            handoff(self.repo, "0" * 40, self.receipts)
        (self.repo / "readme.txt").write_text("dirty\n")
        with self.assertRaisesRegex(RuntimeError, "dirty"):
            handoff(self.repo, receipt_path=self.receipts)
        self.assertFalse(self.receipts.exists())

    def test_company_mirror_failure_preserves_verified_source_receipt(self):
        run('git','switch','-c','feat/company-code',cwd=self.repo)
        sha=run('git','rev-parse','HEAD',cwd=self.repo)
        with mock.patch('push_branch.mirror_company',return_value={'status':'blocked','reason':'fixture failure'}):
            result=handoff(self.repo,sha,self.receipts)
        self.assertEqual(result['result'],'pushed')
        self.assertEqual(result['company_operations']['status'],'blocked')
        self.assertEqual(run('git','--git-dir',str(self.remote),'rev-parse','refs/heads/feat/company-code'),sha)
        self.assertEqual(json.loads(self.receipts.read_text())['company_operations']['status'],'blocked')

    def test_only_company_scopes_mirror_and_operations_never_recurses(self):
        config=pathlib.Path(self.temp.name)/'company.json'
        config.write_text(json.dumps({'additional_company_repos':['https://github.com/fixture/company'],
            'product_registry':str(pathlib.Path(self.temp.name)/'missing.json'),
            'publisher':'fixture-publisher.py','destination':'fixture-operations'}))
        reply=subprocess.CompletedProcess([],0,json.dumps({'branch':'company/operations','sha':'a'*40,'result':'pushed'})+'\n','')
        with mock.patch('push_branch.COMPANY_CONFIG',config),mock.patch('push_branch.subprocess.run',return_value=reply) as call:
            self.assertIsNone(mirror_company('https://github.com/fixture/unrelated.git','feat/test'))
            self.assertIsNone(mirror_company('https://github.com/fixture/company.git','company/operations'))
            call.assert_not_called()
            self.assertEqual(mirror_company('https://github.com/fixture/company.git','feat/test')['sha'],'a'*40)
            call.assert_called_once()

    def test_company_mirror_requires_verified_destination_sha(self):
        config=pathlib.Path(self.temp.name)/'company.json'
        config.write_text(json.dumps({'additional_company_repos':['https://github.com/fixture/company'],
            'product_registry':str(pathlib.Path(self.temp.name)/'missing.json'),
            'publisher':'fixture-publisher.py','destination':'fixture-operations'}))
        reply=subprocess.CompletedProcess([],0,'snapshot queued but not verified\n','')
        with mock.patch('push_branch.COMPANY_CONFIG',config),mock.patch('push_branch.subprocess.run',return_value=reply):
            self.assertEqual(mirror_company('https://github.com/fixture/company.git','feat/test')['status'],'blocked')


if __name__ == "__main__":
    unittest.main()
