import unittest
from unittest.mock import patch
from mktg import prompts

class CompanyContext(unittest.TestCase):
    def test_reads_bounded_current_company_context(self):
        with patch.object(prompts, '_read', return_value='TOP PRIORITY: verify product claims') as read:
            text = prompts.dynamic_block({'task_type':'next_actions','title':'Plan'}, {}, [], [])
        self.assertIn('COMPANY DIRECTOR CONTEXT', text)
        self.assertIn('not new publishing permission', text)
        self.assertIn('Marketing is the growth department', text)
        self.assertEqual(read.call_args.args[1], 6000)

    def test_missing_company_file_preserves_standalone_worker(self):
        with patch.object(prompts, '_read', return_value=''):
            text = prompts.dynamic_block({'task_type':'next_actions','title':'Plan'}, {}, [], [])
        self.assertNotIn('COMPANY DIRECTOR CONTEXT', text)
        self.assertIn('TASK: Plan', text)
