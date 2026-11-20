// Independent legacy replay. No results argument, I/O, model or save operation.
import {forbidMarketsOrTargetResults,digest} from '../input.mjs';
const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const positive=x=>/^[1-9][0-9]*$/.test(String(x??''));
const gcd=(a,b)=>b?gcd(b,a%b):a;
const frac=(n,d)=>{const g=gcd(n,d);return {n:n/g,d:d/g}};
const add=(a,b)=>frac(a.n*b.d+b.n*a.d,a.d*b.d);
const cmp=(a,b)=>{const d=a.n*b.d-b.n*a.d;return d<0n?-1:d>0n?1:0};
const featureColumns=new Set(['race_date','track','race_no','horse_no','horse_name','frozen_horse_name','rank_before','score_before','eye_before','conditions','post_time','frozen_at','source_checked_at','legacy_mean_ratio','legacy_known','legacy_keep','lastkeep','legacy_dense_rank','legacy_eligible','sql_rank_after','sql_score_after','sql_selected','combined','horse_ref','history_updated_at','past_runs']);
const raceKey=r=>[r.race_date,r.track,r.race_no].join('/');
export function features(row){
 const past=row.past_runs.filter(h=>typeof h.race_date==='string'&&h.race_date<row.race_date);
 const valid=past.filter(h=>positive(h.early_pos)&&positive(h.field_size));
 const sum=valid.reduce((s,h)=>add(s,frac(BigInt(h.early_pos),BigInt(h.field_size))),{n:0n,d:1n});
 const mean=valid.length?frac(sum.n,sum.d*BigInt(valid.length)):null;
 const keep=past.filter(h=>/^[123]$/.test(String(h.early_pos??''))&&h.surface===row.conditions.surface&&Math.abs(num(h.distance)-row.conditions.distance)<=200&&(num(h.finish)===1||(num(h.margin_to_winner)!==null&&num(h.margin_to_winner)<=.6)));
 return {known:valid.length,mean,keep:keep.length,lastkeep:keep.length?keep.map(h=>h.race_date).sort().at(-1):null};
}
export function replayRows(rows){
 forbidMarketsOrTargetResults(rows);
 const seen=new Set(),races=new Map();for(const row of rows){if(Object.keys(row).some(k=>!featureColumns.has(k)))throw Error('UNEXPECTED_FEATURE_COLUMN');const key=raceKey(row),id=key+'/'+row.horse_no;if(seen.has(id))throw Error('DUPLICATE_FEATURE_ROW');seen.add(id);
  if(row.horse_name!==row.frozen_horse_name)throw Error('FROZEN_LIVE_NAME_MISMATCH');
  if(!(Date.parse(row.source_checked_at)<Date.parse(row.post_time))||!(Date.parse(row.history_updated_at)<Date.parse(row.post_time)))throw Error('AFTER_POST_RECONSTRUCTION_SOURCE');
  if(num(row.score_before)===null||!Number.isInteger(row.rank_before))throw Error('MISSING_SAVED_SCORE_RANK');
  const f=features(row);if(f.known<2||!f.mean)throw Error('INSUFFICIENT_FIELD_COVERAGE');
  races.set(key,(races.get(key)||[]).concat({...row,score_before:num(row.score_before),feature:f}));
 }
 const output=[];
 for(const [key,rs] of races){
  const ordered=rs.slice().sort((a,b)=>cmp(a.feature.mean,b.feature.mean));let dense=0,prev=null;
  for(const r of ordered){if(!prev||cmp(r.feature.mean,prev)!==0)dense++;r.dense=dense;prev=r.feature.mean;}
  for(const r of rs){const age=r.feature.lastkeep?(Date.parse(r.race_date)-Date.parse(r.feature.lastkeep))/86400000:Infinity;
   r.eligible=r.dense<=3&&r.feature.keep>=1&&age<=180;
   r.addend=r.eligible&&r.combined!==''&&!/先行|逃げ|番手|ハナ|持続/.test(r.combined)?5:0;
   r.after_score=r.score_before+r.addend;
  }
  const ranked=rs.slice().sort((a,b)=>b.after_score-a.after_score||a.rank_before-b.rank_before||a.horse_no-b.horse_no);ranked.forEach((r,i)=>r.after_rank=i+1);
  const priorEye=rs[0].eye_before??null;
  if(rs.some(r=>(r.eye_before??null)!==priorEye))throw Error('INCONSISTENT_EXISTING_EYE');
  const retained=ranked.find(r=>r.horse_no===priorEye&&r.after_rank>5);
  const candidates=rs.filter(r=>r.after_rank>5&&r.eligible).sort((a,b)=>b.feature.keep-a.feature.keep||cmp(a.feature.mean,b.feature.mean)||a.rank_before-b.rank_before||a.horse_no-b.horse_no);
  const newEye=retained?.horse_no??(priorEye===null?candidates[0]?.horse_no??null:null);
  for(const r of rs)output.push({race_id:key,horse_no:r.horse_no,horse_name:r.horse_name,rank_before:r.rank_before,score_before:r.score_before,eye_before:priorEye,
   rank_after:r.after_rank,score_after:r.after_score,score_delta:r.addend,eye_after:newEye,
   old_selected:r.rank_before<=5||r.horse_no===priorEye,selected:r.after_rank<=5||r.horse_no===newEye,
   early_ratio:Number(r.feature.mean.n)/Number(r.feature.mean.d),known:r.feature.known,keep:r.feature.keep,early_dense_rank:r.dense,eligible:r.eligible,
   formal_eye_audit:'NOT_PERFORMED_LEGACY_SIMPLIFIED_RULE',input_row_sha256:digest(r.past_runs)});
 }
 return output.sort((a,b)=>a.race_id.localeCompare(b.race_id)||a.horse_no-b.horse_no);
}
export function measureReplay(predictions,labels){
 const labelMap=new Map();for(const r of labels){const k=raceKey(r)+'/'+r.horse_no;if(labelMap.has(k))throw Error('DUPLICATE_LABEL');labelMap.set(k,r);}
 if(labelMap.size!==predictions.length)throw Error('LABEL_FIELD_COUNT_MISMATCH');
 const newCaptures=[],lostCaptures=[],detail=[],races=new Map();let old=0,after=0,aceWin=0,acePod=0;
 for(const p of predictions){const l=labelMap.get(p.race_id+'/'+p.horse_no);if(!l)throw Error('MISSING_LABEL');if(l.finish!==null&&l.result_horse_name!==p.horse_name)throw Error('RESULT_IDENTITY_MISMATCH');
  const good=Number.isInteger(l.finish)&&l.finish>=1&&l.finish<=3;
  const x={...p,finish:l.finish,old_captured:p.old_selected&&good,captured:p.selected&&good};detail.push(x);if(x.old_captured)old++;if(x.captured)after++;
  if(x.captured&&!x.old_captured)newCaptures.push({race_id:p.race_id,horse_no:p.horse_no,horse_name:p.horse_name,finish:l.finish});
  if(!x.captured&&x.old_captured)lostCaptures.push({race_id:p.race_id,horse_no:p.horse_no,horse_name:p.horse_name,finish:l.finish});
  if(p.rank_after===1&&l.finish===1)aceWin++;if(p.rank_after===1&&good)acePod++;
  races.set(p.race_id,(races.get(p.race_id)||[]).concat(x));
 }
 const perRace=[...races].map(([id,rs])=>({race_id:id,horses:rs.length,eye_before:rs[0].eye_before,eye_after:rs[0].eye_after,
  eye_changed:rs[0].eye_before!==rs[0].eye_after,old_captures:rs.filter(r=>r.old_captured).length,new_captures:rs.filter(r=>r.captured).length,
  race_hit_lost:rs.some(r=>r.old_captured)&&!rs.some(r=>r.captured)}));
 return {method:'USER_LEGACY_FRONT_RESEARCH_RECONSTRUCTION_NOT_FORMAL_EYE',races:races.size,horses:predictions.length,
  old_captures:old,captures:after,new_captures:newCaptures.length,lost_captures:lostCaptures.length,leader_wins:aceWin,leader_top3:acePod,
  condition_eligible_horses:predictions.filter(r=>r.eligible).length,score_changed_horses:predictions.filter(r=>r.score_delta!==0).length,
  rank_changed_horses:predictions.filter(r=>r.rank_before!==r.rank_after).length,eye_changed_races:perRace.filter(r=>r.eye_changed).length,
  new_capture_horses:newCaptures,lost_capture_horses:lostCaptures,per_race:perRace,rows:detail};
}
