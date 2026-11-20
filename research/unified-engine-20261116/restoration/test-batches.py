import importlib.util,json,tempfile,unittest,subprocess,sys
from pathlib import Path
r=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('restore_batches',r/'restore-batches.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class BatchTests(unittest.TestCase):
 def test_full_restore_integrity_and_completeness(self):
  with tempfile.TemporaryDirectory() as d:
   result=m.restore(r/'batches',d)
   self.assertEqual(result,{'races':46,'horses':623,'audit_items':15575,'batches':10,'checksums':'PASS'})
 def test_all_batches_have_at_most_five_races(self):
  index=json.loads((r/'batches/index.json').read_text());self.assertEqual([b['races'] for b in index['batches']],[5]*9+[1]);self.assertEqual(sum(b['horses'] for b in index['batches']),623)
 def test_fresh_split_is_restorable_and_does_not_overwrite_checkpoints(self):
  with tempfile.TemporaryDirectory() as d:
   target=Path(d)/'new-batches'
   subprocess.run([sys.executable,str(r/'split-batches.py'),'--output',str(target)],check=True,capture_output=True)
   self.assertEqual(m.restore(target,Path(d)/'restored')['horses'],623)
   duplicate=subprocess.run([sys.executable,str(r/'split-batches.py'),'--output',str(target)],capture_output=True)
   self.assertNotEqual(duplicate.returncode,0)
 def test_every_batch_has_a_git_checkpoint(self):
  c=json.loads((r/'batches/checkpoints.json').read_text());self.assertEqual(len([x for x in c if 'batch' in x]),10)
if __name__=='__main__':unittest.main()
