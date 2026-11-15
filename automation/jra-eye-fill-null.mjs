// Bounded integration into existing preview/save. No DB, scoring or model I/O.
import {reviewClaimContext} from './jra-eye-additional-audit.mjs';
export const EYE_FILL_VERSION='JRA_TURF_SHORT_FILL_NULL_20261115';
const text=x=>typeof x==='string'&&x.trim().length>=8;
const fail=code=>{throw Error('JRA_EYE_FILL_'+code)};
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const setSame=(a,b)=>a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x));
const outside=p=>p.runners.filter(r=>r.rank>5).sort((a,b)=>a.rank-b.rank);
export function eyeFillInstructions(){return {version:EYE_FILL_VERSION,mode:'FILL_NULL_ONLY',scope:'TURF_LE_1800',preserve_existing_eye:true,rank_effect:false,top5_effect:false,
 request_path:'audit.eye_fill_review',automatic_audit_completion:false,
 required:['race: {race_date,track,race_no,post_time}','protocol_version','evaluated_at: pre-race ISO time','baseline_eye:null',
 'all_runners:[{horse_no,horse_name,rank,reason}] — actual independent full-field review',
 'outside_top5:[{horse_no,horse_name,rank,positive_factors:[{kind,source_ref?,reason,independence_reason}],risks:[string],missing:[string],decision_reason,concrete_upside_reason}]',
 'comparisons:[{a,b,preferred_horse_no:number|null,reason}] — every outside-TOP5 pair',
 'selected_horse_no:number|null','selection_reason'],
 positive_kinds:{RELATIVE_EARLY_POSITION:'whole ACTIVE field dense early rank <=3 and at least two verified positions',NEAR_DISTANCE_PERFORMANCE:'source_ref of a verified same-turf distance +/-200m win or <=0.6s loss; distinct performance observations from early-position evidence'},
 warning:'Do not mark audits complete automatically. Explain why two factors are independent and current; the same fact cannot be relabeled twice. Record negatives, unknown pace/geometry/trouble and all rivals. No odds. Null remains valid. No audit request means no new EYE.'};}
function validateField(context,payload){
 if(!Array.isArray(payload.runners)||!Array.isArray(payload.top5))fail('FIELD');
 const official=context.race.field_payload.runners.filter(x=>x.status==='ACTIVE');
 if(!setSame(payload.runners.map(x=>x.horse_no),official.map(x=>x.horse_no)))fail('FULL_FIELD');
 if(!setSame(payload.runners.map(x=>x.rank),official.map((_,i)=>i+1)))fail('RANK_SET');
 for(const r of payload.runners){if(!official.some(x=>x.horse_no===r.horse_no&&x.horse_name===r.horse_name)||!['S','A','B','C','D','E','F'].includes(r.grade)||!text(r.reason??r.comment??r.concrete_upside_reason))fail('RUNNER_IDENTITY_GRADE_REASON');}
 const expected=payload.runners.filter(r=>r.rank<=5).sort((a,b)=>a.rank-b.rank);
 if(!exact(payload.top5.map(r=>[r.horse_no,r.horse_name,r.rank,r.grade]),expected.map(r=>[r.horse_no,r.horse_name,r.rank,r.grade])))fail('TOP5');
}
function verifyFactor(f,row){
 if(!text(f?.reason)||!text(f?.independence_reason))fail('FACTOR_REASON');
 if(f.kind==='RELATIVE_EARLY_POSITION'){
  if(row.valid_early_count<2||row.dense_early_rank>3||row.dense_early_rank===null)fail('EARLY_FACTOR');
  return {kind:f.kind,observations:row.all_verified_runs.filter(r=>r.early_pos!==null).map(r=>({source_ref:r.source_ref,early_pos:r.early_pos})),relative_rank:row.dense_early_rank,reason:f.reason,independence_reason:f.independence_reason};
 }
 if(f.kind==='NEAR_DISTANCE_PERFORMANCE'){
  const r=row.front_good_runs.find(r=>r.source_ref===f.source_ref);if(!r)fail('PERFORMANCE_SOURCE');
  // Performance factor uses finish/gap, not the same early-position observation.
  return {kind:f.kind,observations:[{source_ref:r.source_ref,surface:r.surface,distance:r.distance,finish:r.finish,margin_to_winner:r.margin_to_winner}],reason:f.reason,independence_reason:f.independence_reason};
 }
 fail('UNSUPPORTED_FACTOR');
}
export function applyEyeFillNull({context,payload,observedAt}){
 const surface=context?.race?.field_payload?.race?.surface,distance=context?.race?.field_payload?.race?.distance;
 if(!['芝','turf','TURF'].includes(surface)||!Number.isInteger(distance)||distance>1800)return {status:'OUT_OF_SCOPE_UNCHANGED',payload};
 const stamped=payload?.audit?.eye_fill_applied?.version===EYE_FILL_VERSION;
 if(payload.eye!==null&&!stamped)return {status:'EXISTING_EYE_PRESERVED',payload};
 const req=payload?.audit?.eye_fill_review;
 if(!req){if(stamped)fail('MISSING_REPLAY_REVIEW');return {status:'NO_FORMAL_REVIEW_NO_FILL',payload};}
 validateField(context,payload);
 const rows=outside(payload),ranking=payload.runners.map(({horse_no,horse_name,rank})=>({horse_no,horse_name,rank}));
 const packet=reviewClaimContext(context,observedAt,ranking);
 const race=context.race;
 if(req.version!==EYE_FILL_VERSION||req.baseline_eye!==null||req.protocol_version!==payload.audit.protocol_version||req.protocol_version!==(context.protocol?.version??context.protocol_version))fail('VERSION_PROTOCOL');
 if(!req.race||['race_date','track','race_no'].some(k=>req.race[k]!==race[k])||Date.parse(req.race.post_time)!==Date.parse(race.post_time))fail('RACE');
 if(!Number.isFinite(Date.parse(req.evaluated_at))||Date.parse(req.evaluated_at)>Date.parse(observedAt)||Date.parse(req.evaluated_at)>=Date.parse(race.post_time))fail('AUDIT_TIME');
 if(Date.parse(observedAt)>=Date.parse(race.post_time)-180000)fail('SAVE_CUTOFF');
 const matchReview=(audit,runner)=>audit?.horse_no===runner.horse_no&&audit.horse_name===runner.horse_name&&audit.rank===runner.rank;
 if(!Array.isArray(req.all_runners)||req.all_runners.length!==payload.runners.length||payload.runners.some(r=>req.all_runners.filter(a=>matchReview(a,r)&&text(a.reason)).length!==1))fail('ALL_RUNNER_AUDIT');
 if(!Array.isArray(req.outside_top5)||req.outside_top5.length!==rows.length)fail('OUTSIDE_AUDIT');
 const verified=new Map();
 for(const r of rows){const matches=req.outside_top5.filter(a=>matchReview(a,r));if(matches.length!==1)fail('OUTSIDE_IDENTITY');const a=matches[0];
  if(!text(a.decision_reason)||!text(a.concrete_upside_reason)||!Array.isArray(a.risks)||!a.risks.length||a.risks.some(x=>!text(x))||!Array.isArray(a.missing)||a.missing.some(x=>!text(x))||!Array.isArray(a.positive_factors))fail('INDIVIDUAL_AUDIT');
  if(new Set(a.positive_factors.map(f=>f.kind)).size!==a.positive_factors.length)fail('DUPLICATE_FACTOR');
  const feature=packet.runners.find(x=>x.horse_no===r.horse_no);
  verified.set(r.horse_no,a.positive_factors.map(f=>verifyFactor(f,feature)));
 }
 if(!Array.isArray(req.comparisons)||req.comparisons.length!==rows.length*(rows.length-1)/2)fail('PAIR_COVERAGE');
 const pairs=new Set();for(const p of req.comparisons){if(!rows.some(r=>r.horse_no===p.a)||!rows.some(r=>r.horse_no===p.b)||p.a===p.b||!text(p.reason)||!(p.preferred_horse_no===null||p.preferred_horse_no===p.a||p.preferred_horse_no===p.b))fail('PAIR');const key=[p.a,p.b].sort((a,b)=>a-b).join(':');if(pairs.has(key))fail('DUPLICATE_PAIR');pairs.add(key);}
 if(payload.audit.all_runners_checked!==true||payload.audit.outside_top5_reaudited!==true||payload.audit.market_used_for_ranking!==false||payload.audit.market_used_for_eye!==false||payload.audit.rank6_auto_selected!==false||payload.audit.target_result_used!==false||!Array.isArray(payload.audit.eye_pool_checked)||!setSame(payload.audit.eye_pool_checked,rows.map(r=>r.horse_no)))fail('CORE_AUDIT');
 if(!text(req.selection_reason))fail('SELECTION_REASON');
 if(req.selected_horse_no===null){if(stamped)fail('REPLAY_DECISION');return {status:'AUDITED_NO_SELECTION',payload};}
 const selected=packet.candidates.find(r=>r.horse_no===req.selected_horse_no);if(!selected)fail('NOT_RESEARCH_CANDIDATE');
 if((verified.get(selected.horse_no)?.length??0)<2)fail('TWO_INDEPENDENT_FACTORS');
 // Analyst compares the extraction order (count, mean early, current rank) with all rivals.
 const proposed=payload.runners.find(r=>r.horse_no===selected.horse_no);
 const a=req.outside_top5.find(r=>r.horse_no===selected.horse_no);
 const eye={...proposed,concrete_upside_reason:a.concrete_upside_reason};
 const stamp={version:EYE_FILL_VERSION,mode:'FILL_NULL_ONLY',baseline_eye:null,horse_no:eye.horse_no,observed_at:observedAt,
  candidate_order:packet.candidates.map(r=>r.horse_no),verified_factors:verified.get(eye.horse_no),
  independent_factors_reviewed_by:'CALLER_EXPLICIT_FORMAL_AUDIT',all_outside_compared:true,rank_effect:false,top5_effect:false};
 if(stamped){const old=payload.audit.eye_fill_applied;if(old.horse_no!==eye.horse_no||!exact(payload.eye,eye))fail('REPLAY_EYE_CHANGED');return {status:'VERIFIED_ALREADY_FILLED',payload};}
 if(payload.eye!==null)fail('BASELINE_NOT_NULL');
 return {status:'FORMALLY_AUDITED_FILL_APPLIED',payload:{...payload,eye,audit:{...payload.audit,eye_fill_applied:stamp}}};
}
