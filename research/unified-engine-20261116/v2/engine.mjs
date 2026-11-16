import {CONDITIONS} from '../catalog.mjs';
import {validateInput,digest,verifyRecord,meaningful,setEqual} from '../input.mjs';
import {collectConditionFacts} from '../engine.mjs';
import {MINETA,VERSION} from './conditions.mjs';import {buildMinetaFacts,rejectOutcomeFields,validateCorners,atomicFact} from './features.mjs';import {allocateClaims} from './ledger.mjs';import {selectResearchEye} from './eye.mjs';
const fieldMap={recent_form:['finish','margin_to_winner'],same_class:['race_class','finish','margin_to_winner'],near_distance:['surface','distance','finish','margin_to_winner'],same_track:['track','surface','finish','margin_to_winner'],relative_early:['early_pos'],front_hold:['early_pos','finish','margin_to_winner'],long_turf:['distance','surface','finish','margin_to_winner'],position_gain:['early_pos','final_turn_pos']};
export function enrichFacts(input,v,core,mineta){
 const byHorse=new Map();for(const horse of v.active){const map=new Map();for(const [criterion,c] of Object.entries(core.get(horse.horse_id))){const fields=fieldMap[criterion];if(!fields)continue;
  for(const e of c.evidence){const run=v.byHorse.get(horse.horse_id).find(h=>h.evidence_id===e.id);if(!run)continue;for(const field of fields){if(run[field]===undefined||run[field]===null)continue;const cs=validateCorners(run.corner_positions,run.field_size);const name=field==='early_pos'&&cs?.[0]===run[field]?'corner[0]':field==='final_turn_pos'&&cs?.at(-1)===run[field]?'corner['+(cs.length-1)+']':field;const atom=atomicFact(horse.horse_id,run,name,run[field],true);const old=map.get(atom.id);map.set(atom.id,{...atom,criteria:[...new Set([...(old?.criteria??[]),criterion])]});}}
 }
 for(const [criterion,c] of Object.entries(mineta.facts.get(horse.horse_id)))for(const e of c.evidence){const old=map.get(e.id);map.set(e.id,{...e,criteria:[...new Set([...(old?.criteria??[]),criterion])]});}
 byHorse.set(horse.horse_id,map);}
 return byHorse;
}
export function evaluateRaceV2(input){
 rejectOutcomeFields(input);
 const {geometry,complete_history,pattern_transition,...base}=input;const v=validateInput(base),core=collectConditionFacts(base,v),mineta=buildMinetaFacts(input),atoms=enrichFacts(input,v,core,mineta);
 const definitions=[...CONDITIONS.filter(c=>c.id!=='mineta'),...MINETA],keys=new Set(definitions.map(c=>c.id));
 const rubric=input.rubric;let policyReady=!!rubric?.version&&rubric.approved===true&&Number.isFinite(rubric.shared_prior_race_cap)&&rubric.shared_prior_race_cap>0&&rubric.shared_prior_race_cap<=100&&verifyRecord(rubric,Date.parse(input.input_frozen_at))&&Number.isFinite(Date.parse(rubric.frozen_at))&&Date.parse(rubric.source.known_at)>=Date.parse(rubric.frozen_at)&&Date.parse(rubric.source.known_at)<=Date.parse(input.captured_at)&&new Date(Date.parse(rubric.frozen_at)+9*3600000).toISOString().slice(0,10)<rubric.holdout_from&&rubric.development_end<=new Date(Date.parse(rubric.frozen_at)+9*3600000).toISOString().slice(0,10)&&rubric.holdout_from<=input.race.race_date&&rubric.development_end<rubric.holdout_from&&['STRICT_PRIOR_RACE','ATOMIC_MECHANISM'].includes(rubric.dependency_mode)&&Array.isArray(rubric.criteria)&&new Set(rubric.criteria.map(c=>c.id)).size===rubric.criteria.length&&rubric.criteria.every(c=>keys.has(c.id)&&Number.isFinite(c.max_points)&&c.max_points>0)&&Math.abs(rubric.criteria.reduce((a,c)=>a+c.max_points,0)-100)<1e-8;
 const reviews=input.reviews??[];if(policyReady&&!setEqual(reviews.map(r=>r.horse_id),v.active.map(r=>r.horse_id)))policyReady=false;
 const audit=[],runners=[],ablation=[];
 for(const h of v.active){const theory=mineta.facts.get(h.horse_id),facts={...core.get(h.horse_id),...theory},review=reviews.find(r=>r.horse_id===h.horse_id);let complete=policyReady,allocation=null;
  if(policyReady){if(!review||!Array.isArray(review.items)||!setEqual(review.items.map(r=>r.criterion),rubric.criteria.map(c=>c.id))||!['S','A','B','C','D','E','F'].includes(review.grade)||!meaningful(review.independent_reason))complete=false;
   else{const claims=rubric.criteria.map(c=>({...review.items.find(i=>i.criterion===c.id),max_points:c.max_points}));if(claims.some(c=>c.points>c.max_points||!Array.isArray(c.fact_ids)||c.fact_ids.some(id=>!atoms.get(h.horse_id).get(id)?.criteria?.includes(c.criterion))||['mineta_T10','mineta_T11','mineta_T12','mineta_T13','mineta_T14'].includes(c.criterion)))complete=false;
    else{allocation=allocateClaims(claims,atoms.get(h.horse_id),rubric);complete=allocation.complete;const strict=allocateClaims(claims,atoms.get(h.horse_id),{...rubric,dependency_mode:'STRICT_PRIOR_RACE'});ablation.push({horse_id:h.horse_id,atomic_score:allocation.complete?allocation.total:null,strict_score:strict.complete?strict.total:null,atomic_ledger:allocation.ledger,strict_ledger:strict.ledger});}
   }
  }
  for(const c of definitions){const f=facts[c.id];audit.push({horse_id:h.horse_id,horse_no:h.horse_no,criterion:c.id,condition_status:f.status,matched:f.matched,evidence:f.evidence,details:f.value??f.details??null,missing:f.missing??[],scoring:allocation?.ledger.find(r=>r.criterion===c.id)??{status:policyReady?'NOT_IN_RUBRIC':'BLOCKED_APPROVED_RUBRIC_ABSENT',applied_points:null}});}
  runners.push({horse_id:h.horse_id,horse_no:h.horse_no,horse_name:h.horse_name,score:complete?allocation.total:null,grade:complete?review.grade:null,reason:review?.independent_reason??null});
 }
 let ranked=null;if(runners.every(r=>r.score!==null)){ranked=runners.slice().sort((a,b)=>b.score-a.score||(input.baseline?.runners.find(r=>r.horse_id===a.horse_id)?.rank??0)-(input.baseline?.runners.find(r=>r.horse_id===b.horse_id)?.rank??0));if(!input.baseline&&ranked.some((h,i)=>i&&h.score===ranked[i-1].score))ranked=null;else ranked.forEach((h,i)=>h.rank=i+1);}
 const eye=ranked?selectResearchEye({race:input.race,ranked,factsByHorse:atoms,review:input.eye_review,cutoff:input.input_frozen_at}):{status:'RANK_NOT_FINAL',horse_id:null,formal_audit_complete:false};
 return {version:VERSION,research_only:true,save_authorized:false,status:ranked?'RANK_READY_RESEARCH_ONLY':'BLOCKED_SCORING',rubric_status:policyReady?'APPROVED_POLICY_VALIDATED':'BLOCKED_APPROVED_RUBRIC_ABSENT',race:input.race,input_sha256:digest(input),runners:ranked??runners,top5:ranked?.slice(0,5).map(r=>r.horse_id)??null,eye,audit,mineta_coverage:{active:mineta.active_count,verified_styles:mineta.style_coverage,front_share:mineta.share},ablation,market_used:false,target_result_used:false};
}
