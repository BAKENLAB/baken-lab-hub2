import{POLICY}from'../v4/scoring.mjs';import{reviewHorse}from'../v5/eye.mjs';
export function auditEye(r,f,h){
 const lookup=new Map(f.scoring_priors.map(p=>[p.archive.run_id,p])),accepted=[],traces=[];
 for(const p of h.eye_review.positive_candidates){const id=p.atom.slice(0,p.atom.indexOf(':')),prior=lookup.get(id),reasons=[];if(!prior||!prior.evaluation_eligible||!prior.flat)reasons.push('VERIFIED_FLAT_RUN_MISSING');const b=prior?.baseline,a=prior?.archive,age=b?(Date.parse(r.race_date)-Date.parse(b.race_date))/86400000:null;
 if(b&&(!(age>=0&&age<=POLICY.max_history_age_days)||b.race_date>=r.race_date))reasons.push('CURRENT_RELEVANCE_TIME');if(b&&(b.surface!==r.conditions.surface||Math.abs(b.distance-r.conditions.distance)>POLICY.near_distance_metres))reasons.push('CURRENT_CONDITION_MISMATCH');
 if(p.fact_ids.some(id=>!h.score.facts.some(x=>x.id===id)))reasons.push('PRIMITIVE_FACT_MISSING');
 if(p.mechanism==='distance_performance'&&b&&!(b.finish<=3||Number.isFinite(b.margin_to_winner)&&b.margin_to_winner<=.6))reasons.push('GOOD_PERFORMANCE_NOT_CONFIRMED');
 if(p.mechanism==='relative_finishing_speed'&&!(prior?.relative3f_verified&&a?.final3f_rank<=3))reasons.push('RELATIVE_LAST3F_UNVERIFIED');
 if(p.mechanism==='positional_progress'&&!(prior?.positions_verified&&b?.corner_positions.length>=3&&b.early_pos-b.final_turn_pos>=2))reasons.push('PROGRESS_UNVERIFIED');
 traces.push({id:p.id,mechanism:p.mechanism,run_id:id,race_id:p.root,age_days:age,distance_difference:b?b.distance-r.conditions.distance:null,surface:b?.surface??null,fact_ids:p.fact_ids,accepted:reasons.length===0,reasons,strict_frozen_input_proven:false});if(!reasons.length)accepted.push(p);
 }
 const review=reviewHorse(h.eye_review,accepted,h.score.facts,r.post_time,[]);return {review,positive_relevance_checks:traces,same_race_proof_supplied:false,same_race_proof_status:'UNVERIFIED_NO_DOCUMENTED_CONDITIONAL_JOINT_INDEPENDENCE',linear_equivalence_alone_accepted:false,strict_formal_eye:null};
}
export function formalSameRaceProof(certificate){return{accepted:false,reason:certificate?.content?.method==='STRATIFIED_FISHER_Z_EQUIVALENCE_V1'?'LINEAR_EQUIVALENCE_DOES_NOT_PROVE_GENERAL_CONDITIONAL_INDEPENDENCE':'REVIEWED_GENERAL_CONDITIONAL_INDEPENDENCE_PROOF_NOT_SUPPLIED_OR_IMPLEMENTED',proof_not_fabricated:true};}
