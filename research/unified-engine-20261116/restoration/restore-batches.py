"""Restore checkpointed UTF-8 batch containers; no network or production access."""
import argparse,base64,hashlib,io,json,zipfile
from pathlib import Path

def canonical(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
def restore(source,output):
 source=Path(source);output=Path(output);index=json.loads((source/'index.json').read_text())
 rows=[];labels=[];logs=[];race_ids=[]
 for batch in index['batches']:
  stem=f"batch-{batch['batch']:02d}";meta=json.loads((source/(stem+'.json')).read_text());payload=json.loads((source/(stem+'.payload.json')).read_text())
  if payload['format']!='BAKEN_RESEARCH_BATCH_ZIP_BASE64_V1':raise ValueError('Container format')
  raw=base64.b64decode(payload['archive_base64'],validate=True)
  if sha(raw)!=payload['archive_sha256'] or sha(raw)!=meta['archive_sha256']:raise ValueError('Archive checksum')
  with zipfile.ZipFile(io.BytesIO(raw)) as z:
   expected={'features.json','official-results.json','comparison.csv','all-25-item-audit.json','manifest.json'}
   if set(z.namelist())!=expected:raise ValueError('Unsafe or unexpected archive members')
   for f in meta['files']:
    b=z.read(f['path'])
    if len(b)!=f['bytes'] or sha(b)!=f['sha256']:raise ValueError('Member checksum')
   rr=json.loads(z.read('features.json'))['rows'];ll=json.loads(z.read('official-results.json'))['rows'];aa=json.loads(z.read('all-25-item-audit.json'))['logs']
   if len(rr)!=meta['horses'] or len(ll)!=len(rr) or len(aa)!=25*len(rr):raise ValueError('Batch counts')
   keys={'/'.join(str(r[k]) for k in ['race_date','track','race_no']) for r in rr}
   if keys!=set(meta['race_ids']) or len(keys)>5:raise ValueError('Batch race membership')
   race_ids.extend(keys);rows.extend(rr);labels.extend(ll);logs.extend(aa)
 if len(race_ids)!=46 or len(set(race_ids))!=46 or len(rows)!=623 or len(logs)!=15575:raise ValueError('Cohort gaps or overlaps')
 key=lambda r:(r['race_date'],r['track'],r['race_no'],r['horse_no'])
 rows.sort(key=key);labels.sort(key=key)
 original={**index['source_input_header'],'rows':rows};result={**index['source_results_header'],'rows':labels}
 if sha(canonical(original))!=index['source_input_semantic_sha256'] or sha(canonical(result))!=index['source_results_semantic_sha256']:raise ValueError('Restored semantic checksum')
 output.mkdir(parents=True,exist_ok=True)
 for name,data in [('cohort-input.json',original),('official-results.json',result),('all-25-item-audit.restored.json',{'logs':logs})]:
  path=output/name
  if path.exists() and canonical(json.loads(path.read_text()))!=canonical(data):raise ValueError('Refusing to overwrite different existing research data: '+str(path))
  if not path.exists():path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
 return {'races':46,'horses':623,'audit_items':len(logs),'batches':len(index['batches']),'checksums':'PASS'}
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--source',type=Path,default=Path(__file__).resolve().parent/'batches');a.add_argument('--output',type=Path,required=True);v=a.parse_args();print(json.dumps(restore(v.source,v.output)))
