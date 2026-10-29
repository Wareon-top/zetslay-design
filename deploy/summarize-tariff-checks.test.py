import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('summary',Path(__file__).with_name('summarize-tariff-checks.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class SummaryTest(unittest.TestCase):
 def test_failure_after_totals_includes_name_and_location_without_large_actual_css(self):
  text='TAP version 13\n# Subtest: pricing\nnot ok 11 - matching pricing styles\n  ---\n  location: /work/app/billing.test.mjs:165:1\n  error: |-\n    Shared tariff comparison styles differ\n  code: ERR_ASSERTION\n  actual: '+('a'*40000)+'\n  ...\n1..24\n# pass 23\n# fail 1\n'
  result=m.summary(text);self.assertIn('not ok 11 - matching pricing styles',result);self.assertIn('billing.test.mjs',result);self.assertIn('Shared tariff comparison styles differ',result);self.assertIn('ERR_ASSERTION',result);self.assertLess(len(result),1800);self.assertNotIn('a'*1000,result)
 def test_non_tap_failure_keeps_bounded_tail(self):
  result=m.summary('node --check\nSyntaxError: Unexpected token\n'+'x'*3000);self.assertIn('SyntaxError',result);self.assertLess(len(result),2000)
 def test_only_first_three_failures_are_shown(self):
  result=m.summary('\n'.join('not ok '+str(i)+' - failure\n  code: CHECK_FAILED' for i in range(1,8)));self.assertIn('Остальные ошибки',result);self.assertEqual(result.count('not ok '),3)
if __name__=='__main__':unittest.main()
