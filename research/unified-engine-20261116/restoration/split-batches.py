# Splits the already-frozen export, never re-fetches or changes source rows.
import json,csv,hashlib,io,zipfile,base64,argparse
from pathlib import Path
r=Path(__file__).resolve().parent
a=argparse.ArgumentParser();a.add_argument('--output',type=Path,required=True);args=a.parse_args();outdir=args.output;outdir.mkdir(parents=True,exist_ok=True)
if any(outdir.iterdir()):raise ValueError('Refusing to overwrite an existing checkpoint directory')
rows=json.loads((r/'cohort-input.json').read_text())['rows']
labels=json.loads((r/'official-results.json').read_text())['rows']
comparison=json.loads((r/'horse-comparison.json').read_text())
import gzip
packed=json.loads(gzip.decompress((r/'all-horse-25-item-audit.json.gz').read_bytes()))
logs=[dict(packed['constants'],**{k:packed['pool'][line[i]] for i,k in enumerate(packed['fields'])}) for line in packed['records']]
def key(x):return '/'.join(str(x[k]) for k in ['race_date','track','race_no'])
races=sorted({key(x) for x in rows})
def encoded(x):return (json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n').encode()
def sha(x):return hashlib.sha256(x).hexdigest()
index=[]
for offset in range(0,len(races),5):
 ids=races[offset:offset+5];s=set(ids);no=offset//5+1;prefix=f'batch-{no:02d}'
 feature=[x for x in rows if key(x) in s];result=[x for x in labels if key(x) in s];comp=[x for x in comparison if x['race_id'] in s];aud=[x for x in logs if x['race_id'] in s]
 assert len(feature)==len(result)==len(comp) and len(aud)==len(feature)*25
 cols=['race_id','horse_no','horse_name','rank_before','score_before','rank_after','score_after','score_delta','eye_before','eye_after','old_selected','selected','finish','old_captured','captured','formal_eye_audit']
 out=io.StringIO(newline='');w=csv.DictWriter(out,fieldnames=cols,extrasaction='ignore');w.writeheader();w.writerows(comp)
 contents={'features.json':encoded({'classification':'PREPOST_RECONSTRUCTION_NOT_FROZEN_INPUT','rows':feature}),'official-results.json':encoded({'purpose':'LABELS_ONLY','rows':result}),'comparison.csv':out.getvalue().encode(),'all-25-item-audit.json':encoded({'formal_audit_performed':False,'logs':aud})}
 manifest={'batch':no,'race_ids':ids,'races':len(ids),'horses':len(feature),'audit_items':len(aud),'snapshot_origin':'previously_extracted_46R623_readonly_export','source_input_sha256':sha((r/'cohort-input.json').read_bytes()),'source_results_sha256':sha((r/'official-results.json').read_bytes()),'capture_classification':'PREPOST_RECONSTRUCTION_NOT_FROZEN_INPUT','formal_100_point_scoring':'BLOCKED_NO_APPROVED_RUBRIC','formal_two_factor_audit':'NOT_PERFORMED','files':[{'path':p,'bytes':len(b),'sha256':sha(b)} for p,b in contents.items()]}
 contents['manifest.json']=encoded(manifest)
 archive=outdir/f'{prefix}.zip'
 with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for name,b in contents.items():
   meta=zipfile.ZipInfo(name,date_time=(2026,11,16,0,0,0));meta.compress_type=zipfile.ZIP_DEFLATED;z.writestr(meta,b)
 # ZIP timestamp is a deterministic container value, not an evidence capture time.
 manifest['container_timestamp_is_not_evidence_time']=True
 blob=archive.read_bytes();manifest.update(archive=archive.name,archive_bytes=len(blob),archive_sha256=sha(blob),archive_git_blob_sha1=hashlib.sha1(b'blob '+str(len(blob)).encode()+b'\0'+blob).hexdigest())
 (outdir/f'{prefix}.payload.json').write_bytes(encoded({'format':'BAKEN_RESEARCH_BATCH_ZIP_BASE64_V1','races':len(ids),'horses':len(feature),'archive_sha256':sha(blob),'archive_base64':base64.b64encode(blob).decode()}));(outdir/f'{prefix}.json').write_bytes(encoded(manifest));(outdir/f'{prefix}.csv').write_bytes(contents['comparison.csv'])
 with zipfile.ZipFile(archive) as z:
  for f in manifest['files']:assert sha(z.read(f['path']))==f['sha256']
 index.append({'batch':no,'races':len(ids),'horses':len(feature),'audit_items':len(aud),'archive':archive.name,'sha256':sha(blob),'race_ids':ids})
assert sum(x['races'] for x in index)==46 and sum(x['horses'] for x in index)==623
assert len({rid for b in index for rid in b['race_ids']})==46
inp=json.loads((r/'cohort-input.json').read_text());res=json.loads((r/'official-results.json').read_text())
canonical=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
(outdir/'index.json').write_bytes(encoded({'status':'LOCAL_BATCHES_CREATED_NOT_ALL_COMMITTED_YET','races':46,'horses':623,'audit_items':15575,'batches':index,'source_input_header':{k:v for k,v in inp.items() if k!='rows'},'source_results_header':{k:v for k,v in res.items() if k!='rows'},'source_input_semantic_sha256':sha(canonical(inp)),'source_results_semantic_sha256':sha(canonical(res))}))
print(json.dumps([{'batch':x['batch'],'races':x['races'],'horses':x['horses'],'zip_bytes':(outdir/x['archive']).stat().st_size} for x in index]))
