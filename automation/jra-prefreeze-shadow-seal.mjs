import {createHash} from 'node:crypto';
/** JRA0.4 pre-FROZEN full-field draft vs evidence-based shadow pair, read-only.
 * Never creates claims, saves predictions, updates a FROZEN or reads results.
 * An offline result audit only proceeds if the actual official FROZEN agrees
 * exactly with the SHA256-sealed pre-race draft ranking.
 */
const iso=s=>typeof s==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').trim();
const goodNo=n=>Number.isInteger(n)&&n>=1&&n<=24;
const badInput=x=>x&&typeof x==='object'&&Object.keys(x).some(k=>/(?:odds|popularity|market|result|finishers|payout|payoff|target_finish)/i.test(k));
const fail=status=>({status,production_rank_changed:false,frozen_modified:false,target_result_used:false,market_used:false});
const digest=obj=>createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function exactOrder(rows,field,{needsRank=false}={}){
 if(!Array.isArray(rows)||rows.length!==field.length||rows.some(badInput))return null;
 const names=new Map(field.map(x=>[x.horse_no,norm(x.horse_name)]));
 const seenNos=new Set(),seenRanks=new Set();
 for(const r of rows){
  if(!goodNo(r?.horse_no)||!names.has(r.horse_no)||norm(r.horse_name)!==names.get(r.horse_no)||seenNos.has(r.horse_no))return null;
  seenNos.add(r.horse_no);
  if(needsRank){
   if(!Number.isInteger(r.rank)||r.rank<1||r.rank>field.length||seenRanks.has(r.rank))return null;
   seenRanks.add(r.rank);
  }
 }
 return (needsRank?rows.slice().sort((a,b)=>a.rank-b.rank):rows).map(x=>x.horse_no);
}
export function sealJraPreFreezeShadowPair({race,field,baseline,preview,observedAt}={}){
 if(!race||race.circuit!=='JRA'||!/^\d{4}-\d{2}-\d{2}$/.test(race.race_date)||
   !norm(race.track)||!Number.isInteger(race.race_no)||race.race_no<1||race.race_no>12||
   !iso(race.post_time)||!iso(observedAt)||observedAt.slice(0,10)!==race.race_date||
   Date.parse(observedAt)>=Date.parse(race.post_time)-3*60_000)return fail('PRE_RACE_TIME_OR_RACE_INVALID');
 if(!Array.isArray(field)||field.length<6||field.length>20||field.some(badInput)||
   field.some(x=>x.status!=='ACTIVE'||!goodNo(x.horse_no)||!norm(x.horse_name))||
   new Set(field.map(x=>x.horse_no)).size!==field.length)return fail('OFFICIAL_ACTIVE_FIELD_INVALID');
 const old=exactOrder(baseline,field,{needsRank:true});
 if(!old)return fail('WHOLE_FIELD_DRAFT_INVALID');
 if(!preview||!['REORDERED','UNCHANGED'].includes(preview.status)||
   preview.baseline_kind!=='EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT'||
   preview.official_saved!==false||preview.save_authorized!==false||
   preview.production_rank_effect!==false||preview.market_used!==false||
   preview.target_result_used!==false||preview.draft_runners_verified!==true||
   preview.base_core_reference_only!==true)return fail('SHADOW_PREVIEW_NOT_VERIFIED');
 if(!same(preview.baseline_top5,old.slice(0,5)))return fail('DRAFT_BASELINE_MISMATCH');
 if(!Array.isArray(preview.candidate_order)||preview.candidate_order.length!==field.length||
   preview.candidate_order.some(n=>!goodNo(n))||
   !same([...preview.candidate_order].sort((a,b)=>a-b),[...old].sort((a,b)=>a-b))||
   !same(preview.top5,preview.candidate_order.slice(0,5)))return fail('PROPOSAL_FIELD_OR_TOP5_MISMATCH');
 if(preview.status==='UNCHANGED'&&!same(preview.candidate_order,old))return fail('UNCHANGED_STATUS_CONFLICT');
 if(preview.status==='REORDERED'&&same(preview.candidate_order,old))return fail('REORDERED_STATUS_CONFLICT');
 const record={schema_version:'JRA_PREFREEZE_RANK_PAIR_V1',circuit:'JRA',model_version:'JRA_REBUILD_0.4',
  race:{race_date:race.race_date,track:race.track,race_no:race.race_no,post_time:race.post_time},
  observed_at:observedAt,baseline_kind:'EXPLICIT_WHOLE_FIELD_PRE_FREEZE_DRAFT',
  official_active_field:field.map(x=>({horse_no:x.horse_no,horse_name:norm(x.horse_name)})).sort((a,b)=>a.horse_no-b.horse_no),
  draft_order:old,shadow_order:[...preview.candidate_order],shadow_status:preview.status,
  shadow_model:preview.model_version,production_rank_changed:false,frozen_modified:false,
  market_used:false,target_result_used:false};
 return {...record,status:'SEALED_PRE_FREEZE_NOT_OFFICIAL_FROZEN',capture_sha256:digest(record)};
}
export function auditSealedJraShadowAgainstFrozen({capture,officialFrozenRunners,officialFrozenAt,resultFinisherNos,resultVerified}={}){
 if(!capture||capture.status!=='SEALED_PRE_FREEZE_NOT_OFFICIAL_FROZEN'||
   typeof capture.capture_sha256!=='string')return fail('CAPTURE_NOT_SEALED');
 const {capture_sha256,status,...record}=capture;
 if(digest(record)!==capture_sha256)return fail('CAPTURE_TAMPERED');
 const post=record.race?.post_time;
 if(!iso(post)||!iso(record.observed_at)||!iso(officialFrozenAt)||
   Date.parse(record.observed_at)>Date.parse(officialFrozenAt)||
   Date.parse(officialFrozenAt)>=Date.parse(post)-3*60_000)return fail('NOT_A_VALID_AS_OF_FROZEN_PAIR');
 const frozen=exactOrder(officialFrozenRunners,record.official_active_field,{needsRank:true});
 if(!frozen||!same(frozen,record.draft_order))return fail('OFFICIAL_FROZEN_DIFFERS_FROM_DRAFT');
 if(resultVerified!==true||!Array.isArray(resultFinisherNos)||resultFinisherNos.length!==3||
   new Set(resultFinisherNos).size!==3||resultFinisherNos.some(n=>!frozen.includes(n)))return fail('OFFICIAL_RESULT_NOT_VERIFIED');
 const old=new Set(record.draft_order.slice(0,5)),now=new Set(record.shadow_order.slice(0,5));
 const before=resultFinisherNos.filter(n=>old.has(n)),after=resultFinisherNos.filter(n=>now.has(n));
 return {status:'OFFLINE_PAIRED_AUDIT_COMPLETE',capture_sha256,race:record.race,official_frozen_at:officialFrozenAt,
  baseline_top5:record.draft_order.slice(0,5),shadow_top5:record.shadow_order.slice(0,5),
  newly_selected:record.shadow_order.slice(0,5).filter(n=>!old.has(n)),
  displaced:record.draft_order.slice(0,5).filter(n=>!now.has(n)),
  baseline_top3_captured:before.length,shadow_top3_captured:after.length,
  newly_captured_finishers:after.filter(n=>!before.includes(n)),
  lost_captured_finishers:before.filter(n=>!after.includes(n)),
  winning_horse_baseline_top5:old.has(resultFinisherNos[0]),
  winning_horse_shadow_top5:now.has(resultFinisherNos[0]),
  production_rank_changed:false,frozen_modified:false,target_result_used_only_postrace:true,market_used:false};
}