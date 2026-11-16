import {CONDITIONS,VERSION} from './catalog.mjs';
import {validateInput,sourceOK,digest,fail,finite,meaningful,setEqual,verifyRecord} from './input.mjs';
const keys=CONDITIONS.map(c=>c.id);
const matched=(runs,p)=>runs.filter(p);
const close=(r,margin)=>r.finish===1||(finite(r.margin_to_winner)&&r.margin_to_winner>=0&&r.margin_to_winner<=margin);
export function collectConditionFacts(input,v){
 const out=new Map();const early=[];
 for(const horse of v.active){const runs=v.byHorse.get(horse.horse_id),pos=runs.filter(r=>r.early_pos!==null);early.push({id:horse.horse_id,n:pos.length,sum:pos.reduce((a,r)=>a+r.early_pos,0)});}
 const eligible=early.filter(r=>r.n>=2).sort((a,b)=>a.sum*b.n-b.sum*a.n);let dense=0,prev=null;const denseById=new Map();
 for(const h of eligible){if(!prev||h.sum*prev.n!==prev.sum*h.n)dense++;denseById.set(h.id,dense);prev=h;}
 for(const horse of v.active){
  const runs=v.byHorse.get(horse.horse_id),near=r=>r.surface===input.race.surface&&Math.abs(r.distance-input.race.distance)<=200;
  const facts={};const add=(id,selected,status=null)=>{facts[id]={status:status??(runs.length?'AVAILABLE':'MISSING'),matched:selected.length>0,
   evidence:selected.map(r=>({id:r.evidence_id,dependency:r.dependency,source_ref:r.source.ref,prior_key:r.key})),details:selected.map(r=>({date:r.race_date,track:r.track,distance:r.distance,finish:r.finish,margin:r.margin_to_winner??null,early_pos:r.early_pos,final_turn_pos:r.final_turn_pos}))};};
  add('recent_form',matched(runs,r=>r.finish<=3||close(r,.6)));
  add('same_class',matched(runs,r=>r.class_level===input.race.class_level&&Number.isInteger(r.class_level)&&close(r,1)),!Number.isInteger(input.race.class_level)||runs.some(r=>!Number.isInteger(r.class_level))?'MISSING_CLASS_MAPPING':null);
  add('near_distance',matched(runs,r=>near(r)&&close(r,1)));
  add('same_track',matched(runs,r=>r.track===input.race.track&&r.surface===input.race.surface&&close(r,1)));
  add('relative_early',denseById.get(horse.horse_id)<=3?runs.filter(r=>r.early_pos!==null):[],early.find(r=>r.id===horse.horse_id).n<2?'MISSING_TWO_VALID_POSITIONS':null);
  facts.relative_early.dense_rank=denseById.get(horse.horse_id)??null;
  add('front_hold',input.race.surface==='芝'&&input.race.distance<=1800?matched(runs,r=>near(r)&&r.early_pos!==null&&r.early_pos<=3&&close(r,.6)):[]);
  add('long_turf',input.race.surface==='芝'&&input.race.distance>1800?matched(runs,r=>r.surface==='芝'&&r.distance>=input.race.distance&&(r.finish<=3||close(r,.6))):[]);
  add('position_gain',matched(runs,r=>r.early_pos!==null&&r.final_turn_pos!==null&&r.early_pos-r.final_turn_pos>=3));
  for(const [id,kind] of [['eval_course','EVAL_COURSE'],['incident','OFFICIAL_INCIDENT'],['rival_followup','OFFICIAL_RIVAL_FOLLOWUP']]){
   const supplements=(input.supplemental??[]).filter(s=>s.horse_id===horse.horse_id&&s.kind===kind);const usable=supplements.filter(s=>{
    if(id==='eval_course')return s.full_normal_rows===1942&&s.own_training_n>=120&&['HIGH','MEDIUM'].includes(s.own_reliability)&&s.direction_corrobated===true&&['S','A'].includes(s.tier)&&s.target_key===[input.race.track,input.race.surface,input.race.distance].join('/')&&typeof s.trained_until==='string'&&s.trained_until<input.race.race_date;
    if(id==='incident')return s.official_incident_verified===true&&meaningful(s.description);
    return s.official_followup_count>=3&&s.identity_verified===true&&typeof s.latest_followup_date==='string'&&s.latest_followup_date<input.race.race_date;
   });
   facts[id]={status:supplements.length?'AVAILABLE':'UNCONNECTED_SOURCE',matched:usable.length>0,evidence:usable.map(s=>({id:'supp:'+digest(s).slice(0,24),dependency:s.prior_key,source_ref:s.source.ref,prior_key:s.prior_key})),details:usable.map(s=>({kind,description:s.description??null,causal_claim:'NOT_PROVEN'}))};
  }
  for(const {id} of CONDITIONS.filter(c=>!facts[c.id]))facts[id]={status:'UNCONNECTED',matched:null,evidence:[],details:[]};
  out.set(horse.horse_id,facts);
 }
 return out;
}
function rubricStatus(input,v){
 const r=input.rubric;if(!r)return 'MISSING_VERIFIED_100_POINT_RUBRIC';
 if(!r.version||!verifyRecord(r,Date.parse(input.input_frozen_at))||!Array.isArray(r.criteria)||!r.criteria.length)return 'UNVERIFIED_RUBRIC';
 if(new Set(r.criteria.map(c=>c.id)).size!==r.criteria.length||r.criteria.some(c=>!keys.includes(c.id)||!finite(c.max_points)||c.max_points<=0)||Math.abs(r.criteria.reduce((n,c)=>n+c.max_points,0)-100)>1e-8)return 'RUBRIC_MUST_DECLARE_DISTINCT_100_POINT_ITEMS';
 return 'READY';
}
function rank(scores,baseline){
 const sorted=scores.slice().sort((a,b)=>b.score-a.score);for(let i=1;i<sorted.length;i++)if(sorted[i].score===sorted[i-1].score&&!baseline)return null;
 const prior=new Map(baseline?.runners.map(h=>[h.horse_id,h.rank])??[]);
 sorted.sort((a,b)=>b.score-a.score||(prior.get(a.horse_id)??0)-(prior.get(b.horse_id)??0));
 return sorted.map((h,i)=>({...h,rank:i+1}));
}
function selectEye(input,rows,facts){
 const outside=rows.filter(r=>r.rank>5),outsideIds=outside.map(r=>r.horse_id),review=input.eye_review;
 const old=input.baseline?.eye;
 if(old&&!outsideIds.includes(old))return {status:'EXISTING_EYE_ENTERED_TOP5_REAUDIT_REQUIRED',horse_id:null,audits:outside.map(h=>({horse_id:h.horse_id,status:'NOT_PERFORMED'}))};
 if(!review)return {status:'FORMAL_AUDIT_REQUIRED',horse_id:old??null,audits:outside.map(h=>({horse_id:h.horse_id,status:'NOT_PERFORMED'}))};
 if(!Array.isArray(review.runners)||!setEqual(review.runners.map(r=>r.horse_id),outsideIds)||!Array.isArray(review.comparisons)||review.comparisons.length!==outside.length*(outside.length-1)/2)return {status:'INCOMPLETE_EYE_FIELD_OR_COMPARISONS',horse_id:null,audits:review.runners??[]};
 const pairs=new Set();for(const p of review.comparisons){if(p.a===p.b||!outsideIds.includes(p.a)||!outsideIds.includes(p.b)||!meaningful(p.reason))return {status:'INVALID_EYE_COMPARISON',horse_id:null,audits:review.runners};pairs.add([p.a,p.b].sort().join('|'));}
 if(pairs.size!==review.comparisons.length)return {status:'DUPLICATE_EYE_COMPARISON',horse_id:null,audits:review.runners};
 const positives=new Map();
 for(const a of review.runners){
  if(!meaningful(a.reason)||!Array.isArray(a.risks)||!a.risks.length||a.risks.some(x=>!meaningful(x))||!Array.isArray(a.positives)||!Array.isArray(a.missing))return {status:'INCOMPLETE_INDIVIDUAL_EYE_AUDIT',horse_id:null,audits:review.runners};
  const used=new Set(),criteria=new Set();const accepted=[];
  for(const p of a.positives){const f=facts.get(a.horse_id)[p.criterion];if(!f||f.status!=='AVAILABLE'||!f.matched||!meaningful(p.reason)||!meaningful(p.independence_reason)||criteria.has(p.criterion)||!Array.isArray(p.evidence_ids)||!p.evidence_ids.length)continue;
   const ev=p.evidence_ids.map(id=>f.evidence.find(e=>e.id===id));if(ev.some(x=>!x)||ev.some(e=>used.has(e.dependency)))continue;
   for(const e of ev)used.add(e.dependency);criteria.add(p.criterion);accepted.push(p);
  }
  positives.set(a.horse_id,accepted);
 }
 if(old)return {status:(positives.get(old)?.length??0)>=2?'EXISTING_EYE_PRESERVED_AUDIT_COMPLETE':'EXISTING_EYE_PRESERVED_REQUALIFICATION_UNCONFIRMED',horse_id:old,audits:review.runners,comparisons:review.comparisons};
 if(review.selected_horse_id===null){if(!meaningful(review.reason))return {status:'NULL_REASON_REQUIRED',horse_id:null,audits:review.runners};return {status:'AUDITED_NO_SELECTION',horse_id:null,audits:review.runners};}
 const id=review.selected_horse_id;
 if(!outsideIds.includes(id)||(positives.get(id)?.length??0)<2||!meaningful(review.reason))return {status:'TWO_INDEPENDENT_SUPPORTED_POSITIVES_REQUIRED',horse_id:null,audits:review.runners};
 if(input.race.surface!=='芝'||input.race.distance>1800)return {status:'OUT_OF_FILL_SCOPE_UNCHANGED',horse_id:null,audits:review.runners};
 const f=facts.get(id);if(!f.relative_early.matched||!f.front_hold.matched)return {status:'RESEARCH_CANDIDATE_NOT_ELIGIBLE',horse_id:null,audits:review.runners};
 return {status:'FORMALLY_REVIEWED_FILL',horse_id:id,audits:review.runners,accepted_positives:positives.get(id),comparisons:review.comparisons,reason:review.reason};
}
export function evaluateRace(input){
 const v=validateInput(input),facts=collectConditionFacts(input,v),rubric_status=rubricStatus(input,v);const audit=[],scores=[];let scoringReady=rubric_status==='READY';
 const reviews=Array.isArray(input.reviews)?input.reviews:[];
 if(rubric_status==='READY'&&!setEqual(reviews.map(r=>r.horse_id),v.active.map(r=>r.horse_id)))scoringReady=false;
 for(const horse of v.active){
  const fs=facts.get(horse.horse_id),review=reviews.find(r=>r.horse_id===horse.horse_id),ledger=new Map();let total=0,complete=rubric_status==='READY';const itemRows=[];
  // Order is declared by the pre-race rubric, NEVER by outcome or requested points.
  const ordered=[...new Set([...(input.rubric?.criteria??[]).map(c=>c.id),...keys])];
  for(const id of ordered){const f=fs[id],spec=input.rubric?.criteria?.find(c=>c.id===id);if(!f)continue;const assessment=review?.items?.filter(x=>x.criterion===id)??[];
   const definition=CONDITIONS.find(c=>c.id===id);
   const item={horse_id:horse.horse_id,criterion:id,source_family:definition.family,rule_source:definition.source,max_points:spec?.max_points??null,inspected_history_count:v.byHorse.get(horse.horse_id).length,inspected_history_refs:v.byHorse.get(horse.horse_id).map(h=>({evidence_id:h.evidence_id,prior_key:h.key,source_ref:h.source.ref})),condition_status:f.status,matched:f.matched,details:f.details,evidence:f.evidence,requested_points:null,applied_points:null,decision:'FACTS_ONLY',reason:null};
   if(spec&&rubric_status==='READY'){
    if(assessment.length!==1||!finite(assessment[0].points)||assessment[0].points<0||assessment[0].points>spec.max_points||!meaningful(assessment[0].reason)||!Array.isArray(assessment[0].evidence_ids)||f.status!=='AVAILABLE'){
     item.decision='BLOCKED_INCOMPLETE_ITEM';complete=false;
    }else{const a=assessment[0],ev=a.evidence_ids.map(e=>f.evidence.find(x=>x.id===e));item.reason=a.reason;item.requested_points=a.points;
     if(ev.some(e=>!e)||(a.points>0&&(!f.matched||!ev.length))){item.decision='BLOCKED_UNSUPPORTED_POINTS';complete=false;}
     else if(a.points>0&&ev.some(e=>ledger.has(e.dependency))){item.decision='DUPLICATE_EVIDENCE_SUPPRESSED';item.applied_points=0;item.overlap_with=[...new Set(ev.filter(e=>ledger.has(e.dependency)).map(e=>ledger.get(e.dependency)))];}
     else{item.decision='SCORED';item.applied_points=a.points;total+=a.points;for(const e of ev)if(a.points>0)ledger.set(e.dependency,id);}
    }
   }
   itemRows.push(item);audit.push(item);
  }
  if(!Array.isArray(review?.items)||review.items.some(i=>!input.rubric?.criteria?.some(c=>c.id===i.criterion)))complete=false;
  if(!['S','A','B','C','D','E','F'].includes(review?.grade)||!meaningful(review?.independent_reason))complete=false;
  if(!complete)scoringReady=false;
  scores.push({horse_id:horse.horse_id,horse_no:horse.horse_no,horse_name:horse.horse_name,score:complete?Math.round(total*1e8)/1e8:null,grade:complete?review.grade:null,reason:review?.independent_reason??null,score_status:complete?'COMPLETE':'BLOCKED',items:itemRows});
 }
 const ranked=scoringReady?rank(scores,input.baseline):null;
 const eye=ranked?selectEye(input,ranked,facts):{status:'RANK_NOT_FINAL_NO_EYE',horse_id:null,audits:[]};
 return {version:VERSION,research_only:true,save_authorized:false,mode:input.mode??'RESEARCH',race:input.race,input_sha256:v.input_sha256,
  captured_at:input.captured_at,input_frozen_at:input.input_frozen_at,market_used:false,target_results_used:false,
  completion:{all_scores_complete:!!ranked,all_eye_audits_complete:['FORMALLY_REVIEWED_FILL','AUDITED_NO_SELECTION','EXISTING_EYE_PRESERVED_AUDIT_COMPLETE'].includes(eye.status)},
  status:ranked?'EVALUATED_RESEARCH_ONLY':scoringReady?'UNRESOLVED_SCORE_TIE':'BLOCKED_SCORING',rubric_status,
  runners:ranked??scores,top5:ranked?.slice(0,5).map(h=>h.horse_id)??null,eye,audit,
  excluded_history:v.excluded,condition_matches:audit.filter(r=>r.matched===true).length,
  duplicate_suppression_count:audit.filter(r=>r.decision==='DUPLICATE_EVIDENCE_SUPPRESSED').length,
  unconnected_conditions:CONDITIONS.filter(c=>v.active.some(h=>facts.get(h.horse_id)[c.id].status.startsWith('UNCONNECTED'))).map(c=>c.id),
  baseline:input.baseline??null};
}
