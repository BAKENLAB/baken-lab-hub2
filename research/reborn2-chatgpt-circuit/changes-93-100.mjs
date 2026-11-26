import {common} from './common-evidence.mjs';
export function analyzeChanges93to100({target,roster,evidence=[],runs=[],history=[],currentConditions=[],mechanisms=[],upstream=[]}){
 const c=common(target,roster,evidence),{ts,unique,bound,identities,prior,add,close}=c;
 const past=unique(runs.filter(prior),r=>r.horse_id+"|"+r.race_id);
 const keys=["course_id","course_version","distance","surface","going","turn","class_key","weight_kg","actual_gate","jockey_id","equipment_version"];
 const known=v=>v!=null&&v!=="";
 const same=(a,b,ks)=>ks.every(k=>known(a[k])&&known(b[k])&&a[k]===b[k]);
 const count=r=>Number.isInteger(r.finish)&&r.finish>=1&&r.finish<=r.field_size;
 const runners=roster.map(entry=>{
  const h=identities.find(x=>x.horse_no===entry.horse_no),I=c.items(93,100),put=(n,v,refs,kind="facts")=>add(I,n,kind,v,refs);
  if(!h){for(const x of Object.values(I))x.unknowns.push("IDENTITY_UNVERIFIED");return {horse_no:entry.horse_no,horse_id:null,items:I}}
  const id=h.horse_id,own=past.filter(r=>r.horse_id===id).sort((a,b)=>ts(b.started_at)-ts(a.started_at));
  const w=unique(history.filter(x=>x.horse_id===id&&bound(x,id,target.race_id)&&x.chronology_verified===true&&Array.isArray(x.ordered_race_ids)),x=>x.horse_id)[0];
  const last=w&&own.find(r=>r.race_id===w.ordered_race_ids[0]);
  const curr=unique(currentConditions.filter(x=>x.horse_id===id&&bound(x,id,target.race_id)&&x.conditions_verified===true),x=>x.horse_id)[0];
  const delta=last&&curr?keys.filter(k=>known(last[k])&&known(curr[k])&&last[k]!==curr[k]).map(k=>({field:k,prior:last[k],current:curr[k]})):[];
  const refs=[h.evidence_id,w?.evidence_id,last?.evidence_id,curr?.evidence_id];
  const u=unique(upstream.filter(x=>x.horse_id===id&&x.source_cutoff===target.cutoff&&/^(0[1-9]|[1-8]\d|9[0-2])$/.test(x.item_id)&&Array.isArray(x.evidence_ids)&&x.evidence_ids.length&&x.evidence_ids.every(e=>c.byId.has(e))),x=>x.item_id);
  const validMechanisms=unique(mechanisms.filter(m=>m.horse_id===id&&m.race_id===target.race_id&&m.source_cutoff===target.cutoff&&typeof m.mechanism_id==="string"&&["SUPPORT","COUNTER","MIXED"].includes(m.direction)&&Array.isArray(m.upstream_item_ids)&&m.upstream_item_ids.length&&m.upstream_item_ids.every(i=>u.some(q=>q.item_id===i))&&Array.isArray(m.evidence_ids)&&m.evidence_ids.length&&m.evidence_ids.every(e=>u.some(q=>m.upstream_item_ids.includes(q.item_id)&&q.evidence_ids.includes(e)))&&typeof m.scenario_id==="string"&&m.current_relevance_verified===true),m=>m.mechanism_id);
  if(last&&curr){
   for(const [n,d] of [["93","SUPPORT"],["94","COUNTER"]]){
    put(n,{condition_delta:delta,direction_candidates:validMechanisms.filter(m=>m.direction===d||m.direction==="MIXED"),confirmed_effect:null},[...refs,...validMechanisms.flatMap(m=>m.evidence_ids)],"hypotheses");
   }
   const compareKeys=["course_id","course_version","distance","surface","going","class_key"];
   const restored=own.filter(r=>r!==last&&count(r)&&same(r,curr,compareKeys)&&!same(r,last,compareKeys));
   if(restored.length)put("95",{restored_conditions:delta,matched_observations:restored.map(r=>({race_id:r.race_id,finish:r.finish,started_at:r.started_at})),success_threshold:null},[...refs,...restored.map(r=>r.evidence_id)]);
   const causes=validMechanisms.filter(m=>m.upstream_item_ids.some(i=>["24","25","26","27","31"].includes(i)));
   if(causes.length)put("96",{prior_cause_candidates:causes,resolved_evidence:null,recurrence_risk:"UNRESOLVED"},[...refs,...causes.flatMap(m=>m.evidence_ids)],"hypotheses");
  }
  if(validMechanisms.length){
   // Connected components by shared evidence or an explicitly shared mechanism family, never a count bonus.
   const groups=[];
   for(const m of validMechanisms){let g={mechanisms:[m.mechanism_id],families:[m.family].filter(Boolean),evidence_ids:[...m.evidence_ids],directions:[m.direction],scenarios:[m.scenario_id]};for(let i=groups.length-1;i>=0;i--){const z=groups[i];if(z.evidence_ids.some(e=>g.evidence_ids.includes(e))||z.families.some(f=>g.families.includes(f))){for(const k of Object.keys(g))g[k]=[...new Set([...g[k],...z[k]])];groups.splice(i,1);i=groups.length;}}groups.push(g);}
   put("97",{linked_mechanism_groups:groups,independence_confirmed:false,joint_scenario:null},validMechanisms.flatMap(m=>m.evidence_ids),"hypotheses");
   const latent=validMechanisms.filter(m=>m.upstream_item_ids.some(i=>["15","29","30","31","32"].includes(i)));
   if(latent.length)put("98",{latent_candidates:latent,activation_verified:false},latent.flatMap(m=>m.evidence_ids),"hypotheses");
  }
  if(curr){const match=own.filter(r=>count(r)&&same(r,curr,["course_id","course_version","distance","surface","going","class_key"]));if(match.length)put("99",{matched_runs:match.map(r=>({race_id:r.race_id,finish:r.finish,started_at:r.started_at})),repeated_win_observations:match.filter(r=>r.finish===1).length,repeatability_conclusion:null},[...refs,...match.map(r=>r.evidence_id)]);}
  const traces=u.map(x=>({item_id:x.item_id,evidence_ids:x.evidence_ids,analysis_status:x.analysis_status??"UNKNOWN"}));
  put("100",{winning_paths:validMechanisms.filter(x=>x.direction==="SUPPORT"),counterevidence:validMechanisms.filter(x=>x.direction!=="SUPPORT"),upstream_trace:traces,conditional_requirements:"INDEPENDENT_VALIDATION_REQUIRED",comparative_evidence:null,decision_status:"UNAPPROVED_RESEARCH",rank_candidate:null},[...refs,...traces.flatMap(x=>x.evidence_ids)],"hypotheses");
  return {horse_no:entry.horse_no,horse_id:id,items:close(I)};
 });
 return c.finish(runners,93,100);
}
