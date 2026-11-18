"""Development-only descriptive analysis. No scoring or evaluator invocation."""
import json,csv,hashlib,gzip,base64
from pathlib import Path
from statistics import mean
root=Path(__file__).resolve().parent
src=root.parent/'v8/analysis/focal51.json';horses=json.loads(src.read_text());out=root/'development-analysis';out.mkdir(exist_ok=False)
def dump(p,d):
 with p.open('x') as f:json.dump(d,f,ensure_ascii=False,indent=2);f.write('\n')
rows=[]
for h in horses:
 a=h['allocation'];b=h['boundary'];rows.append(dict(group=h['group'],race_id=h['race_id'],horse_no=h['horse_no'],horse_name=h['horse_name'],supported=h['supported'],legacy_common_rank=h['legacy_rank_common'],v7_diagnostic_rank=h['v7_diagnostic_rank'],rank_change_common=h['rank_change_common'],conditional_pattern=h['conditional_pattern'],requested_micro=sum(x['requested_micro'] for x in a),after_shared_atom_micro=sum(x['after_shared_atom_micro'] for x in a),credited_micro=sum(x['credited_micro'] for x in a),shared_atom_reduction_micro=sum(x['requested_micro']-x['after_shared_atom_micro'] for x in a),later_cap_reduction_micro=sum(x['after_shared_atom_micro']-x['credited_micro'] for x in a),unknown_budget=sum(x['width'] for x in h['unknown_axes']),boundary_gap_micro=b['gap_micro'] if b else None,within_v7_boundary_axes=b['axes'] if b else [],eye_status=h['v7_eye_status'],original_allocation=a,causal_identification=False,development_only=True))
 assert not b or sum(x['cutoff_advantage_micro'] for x in b['axes'])==b['gap_micro']
 assert all(x['requested_micro']>=x['after_shared_atom_micro']>=x['credited_micro']>=0 for x in a)
for n in range(1,11):
 p=root.parent/f'v8/batches/batch-{n:02d}.lock.payload.json';packet=json.loads(p.read_text());raw=gzip.decompress(base64.b64decode(packet['data']));assert hashlib.sha256(raw).hexdigest()==packet['sha256'];lock=json.loads(raw);ids=[r['race_id'] for r in lock['races']];assert len(ids)<=5
 dump(out/f'batch-{n:02d}.json',dict(batch=n,race_ids=ids,v8_lock_sha256=packet['sha256'],rows=[h for h in rows if h['race_id'] in ids],production_allowed=False,independent_future_validation=False))
dump(out/'horse51.json',rows)
cols=[k for k in rows[0] if k not in ['within_v7_boundary_axes','original_allocation']]
with (out/'horse51.csv').open('x') as f:
 w=csv.DictWriter(f,fieldnames=cols,extrasaction='ignore');w.writeheader();w.writerows(rows)
summary={'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'horses':len(rows),'groups':{},'changes_to_scoring':False,'allocation_loss_is_not_recoverable_ability':True,'cannot_identify_legacy_to_v7_causal_axis_effect':True,'independent_future_validation':False}
for group in ['LOST30','NEW21']:
 hs=[h for h in rows if h['group']==group];rated=[h for h in hs if h['supported']];axes=[]
 for axis in [x['axis'] for x in rated[0]['original_allocation']]:
  aa=[next(x for x in h['original_allocation'] if x['axis']==axis) for h in rated];bb=[next(x for x in h['within_v7_boundary_axes'] if x['axis']==axis) for h in rated]
  axes.append(dict(axis=axis,requested_micro=sum(x['requested_micro'] for x in aa),credited_micro=sum(x['credited_micro'] for x in aa),shared_atom_reduction_micro=sum(x['requested_micro']-x['after_shared_atom_micro'] for x in aa),later_cap_reduction_micro=sum(x['after_shared_atom_micro']-x['credited_micro'] for x in aa),mean_boundary_advantage_micro=mean(x['cutoff_advantage_micro'] for x in bb),unknown_horses=sum(x['unknown_budget']>0 for x in bb)))
 summary['groups'][group]=dict(horses=len(hs),rated=len(rated),unrated=len(hs)-len(rated),mean_rank_change_common=mean(h['rank_change_common'] for h in rated),mean_requested_points=mean(h['requested_micro']/1e6 for h in rated),mean_credited_points=mean(h['credited_micro']/1e6 for h in rated),mean_shared_atom_reduction_points=mean(h['shared_atom_reduction_micro']/1e6 for h in rated),mean_later_cap_reduction_points=mean(h['later_cap_reduction_micro']/1e6 for h in rated),mean_unknown_budget=mean(h['unknown_budget'] for h in rated),axes=axes)
dump(out/'summary.json',summary)
print(json.dumps({k:{a:b for a,b in v.items() if a!='axes'} for k,v in summary['groups'].items()},ensure_ascii=False))
