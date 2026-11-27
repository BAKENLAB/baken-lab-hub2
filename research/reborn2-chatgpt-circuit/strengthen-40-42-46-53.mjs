import {common} from './common-evidence.mjs';
export function strengthen40to42and46and53({target,roster,evidence=[],opposition,conditions,pace,fieldComparisons=[],classHistories=[],crosswalks=[],courseStudies=[],drawHistories=[]}){
 const c=common(target,roster,evidence),{ts,unique,bound,identities}=c;
 const str=x=>typeof x==="string"&&x.length>0;
 const exact=(a,b,keys)=>keys.every(k=>a?.[k]!=null&&a[k]===b?.[k]);
 const courseKeys=["circuit","surface","distance","going","class_key","layout","course_version","eligibility"];
 const finite=x=>typeof x==="number"&&Number.isFinite(x);
 const finish=(r,n)=>Number.isInteger(r.finish)&&r.finish>=1&&r.finish<=n;
 const eligibleRun=r=>r.circuit===target.circuit&&r.race_id!==target.race_id&&str(r.horse_id)&&str(r.race_id)&&bound(r,r.horse_id,r.race_id)&&ts(r.started_at)<c.cutoff&&ts(c.byId.get(r.evidence_id).published_at_or_null)>ts(r.started_at)&&r.conditions_verified===true&&Number.isInteger(r.field_size)&&r.field_size>0&&finish(r,r.field_size);
 const describe=r=>({race_id:r.race_id,finish:r.finish,field_size:r.field_size,class_key:r.class_key??null,evidence_id:r.evidence_id});
 const records=unique(courseStudies.filter(s=>str(s.study_id)&&str(s.source_course)&&str(s.target_course)&&s.source_course!==s.target_course&&ts(s.training_end)<ts(s.holdout_start)&&ts(s.holdout_start)<ts(s.holdout_end)&&ts(s.holdout_end)<=c.cutoff),s=>s.study_id);
 const studies=[];
 for(const s of records){
  // One explicitly witnessed observation per horse; train and holdout cannot share horses.
  const eligible=(s.observations??[]).filter(o=>{
   const b=o.target_run,a=o.source_run;
   if(!b||!eligibleRun(b)||b.course_id!==s.target_course||!exact(b,s.target_condition,courseKeys)||!["SOURCE_WIN","SOURCE_OTHER","NO_SOURCE_EXPERIENCE"].includes(o.exposure))return false;
   const w=c.byId.get(o.history_evidence_id);
   if(!w||w.horse_id!==b.horse_id||w.race_id!==b.race_id||o.complete_pre_run_history_verified!==true||ts(w.observed_at)>=ts(b.started_at))return false;
   if(o.exposure==="NO_SOURCE_EXPERIENCE")return a==null&&o.no_source_experience_verified===true;
   return a&&eligibleRun(a)&&a.horse_id===b.horse_id&&a.course_id===s.source_course&&exact(a,s.source_condition,courseKeys)&&ts(a.started_at)<ts(b.started_at)&&ts(c.byId.get(a.evidence_id).observed_at)<ts(b.started_at)&&(o.exposure==="SOURCE_WIN"?a.finish===1:a.finish>1);
  });
  const clean=unique(eligible,o=>o.target_run.horse_id);
  const train=clean.filter(o=>ts(o.target_run.started_at)<ts(s.training_end)&&ts(c.byId.get(o.target_run.evidence_id).observed_at)<ts(s.training_end));
  const holdout=clean.filter(o=>ts(o.target_run.started_at)>=ts(s.holdout_start)&&ts(o.target_run.started_at)<ts(s.holdout_end));
  // Wilson interval is descriptive sampling uncertainty, not calibrated win probability.
  const interval=(wins,n)=>{if(!n)return null;const z=1.959963984540054,p=wins/n,d=1+z*z/n,mid=(p+z*z/(2*n))/d,rad=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,mid-rad),Math.min(1,mid+rad)]};
  const group=xs=>Object.fromEntries(["SOURCE_WIN","SOURCE_OTHER","NO_SOURCE_EXPERIENCE"].map(g=>{const rows=xs.filter(o=>o.exposure===g),n=rows.length,wins=rows.filter(o=>o.target_run.finish===1).length;return [g,{n,wins,win_fraction:n?wins/n:null,win_fraction_wilson95:interval(wins,n),top3:rows.filter(o=>o.target_run.finish<=3).length}]}));
  const t=group(train),v=group(holdout);
  const difference=g=>g.SOURCE_WIN.win_fraction===null||g.NO_SOURCE_EXPERIENCE.win_fraction===null?null:g.SOURCE_WIN.win_fraction-g.NO_SOURCE_EXPERIENCE.win_fraction;
  studies.push({study_id:s.study_id,source_course:s.source_course,target_course:s.target_course,train:t,holdout:v,train_difference:difference(t),holdout_difference:difference(v),duplicate_horses_excluded:eligible.length-clean.length,cohort_assessment:"DESCRIPTIVE_UNCALIBRATED",effect:null,evidence_ids:[...new Set([...train,...holdout].flatMap(o=>[o.history_evidence_id,o.target_run.evidence_id,o.source_run?.evidence_id].filter(Boolean)))]});
 }
 const runners=roster.map(entry=>{
  const h=identities.find(x=>x.horse_no===entry.horse_no),items=Object.fromEntries(["40","41","42","46","53"].map(n=>[n,{facts:[],hypotheses:[],counterevidence:[],unknowns:[],effect:"NO_RECORDED_USE"}]));
  const put=(n,value,refs,kind="facts")=>c.add(items,n,kind,value,refs);
  if(!h){for(const x of Object.values(items))x.unknowns.push("IDENTITY_UNVERIFIED");return {horse_no:entry.horse_no,horse_id:null,items};}
  const id=h.horse_id;
  for(const f of unique(fieldComparisons.filter(f=>f.horse_id===id&&bound(f,id,target.race_id)&&f.comparable_conditions_verified===true&&Array.isArray(f.current)&&Array.isArray(f.prior)&&f.current.length===target.field_size-1&&Number.isInteger(f.prior_field_size)&&f.prior.length===f.prior_field_size-1&&unique(f.current,x=>x.horse_id).length===f.current.length&&unique(f.prior,x=>x.horse_id).length===f.prior.length&&f.current.every(x=>x.horse_id!==id&&identities.some(y=>y.horse_id===x.horse_id))&&[...f.current,...f.prior].every(x=>x.horse_id!==id&&bound(x,x.horse_id,x.race_id)&&finite(x.residual_seconds)&&x.baseline_verified===true&&x.baseline_id===f.baseline_id)),f=>f.prior_race_id)){
   const median=xs=>{const a=xs.map(x=>x.residual_seconds).sort((a,b)=>a-b);return a.length?(a[Math.floor(a.length/2)]+a[Math.floor((a.length-1)/2)])/2:null};
   const now=median(f.current),prev=median(f.prior),diff=now===null||prev===null?null:now-prev;
   put("40",{prior_race_id:f.prior_race_id,current_n:f.current.length,prior_n:f.prior.length,current_median_residual:now,prior_median_residual:prev,difference_seconds:diff,observed_direction:diff===null?"UNKNOWN":diff<0?"FASTER_COMPARABLE_PROFILE":diff>0?"SLOWER_COMPARABLE_PROFILE":"EQUAL_MEDIAN",strength_conclusion:null},[f.evidence_id,...f.current.map(x=>x.evidence_id),...f.prior.map(x=>x.evidence_id)]);
  }
  for(const x of unique(classHistories.filter(x=>x.horse_id===id&&bound(x,id,x.race_id)&&x.rule_verified===true&&x.class_relation==="HIGHER_THAN_TARGET"&&eligibleRun(x)&&x.target_class_key===target.class_key&&x.rule_ref),x=>x.race_id))put("41",{higher_class_performance:describe(x),rule_ref:x.rule_ref,gap_winner:finite(x.gap_winner)?x.gap_winner:null,condition_match:exact(x,target,["course_id","surface","distance","going"]),transferability:null},[x.evidence_id]);
  for(const x of unique(crosswalks.filter(x=>x.horse_id===id&&bound(x,id,target.race_id)&&x.crosswalk_verified===true&&str(x.previous_horse_id)&&x.previous_horse_id.split(":")[0]!==id.split(":")[0]&&ts(x.effective_at)<c.cutoff&&Array.isArray(x.before)&&Array.isArray(x.after)),x=>x.effective_at)){
   const good=(r,h)=>r.horse_id===h&&bound(r,h,r.race_id)&&r.conditions_verified===true&&r.class_verified===true&&ts(r.started_at)<c.cutoff&&ts(c.byId.get(r.evidence_id).published_at_or_null)>ts(r.started_at)&&finish(r,r.field_size);
   const before=unique(x.before.filter(r=>good(r,x.previous_horse_id)&&ts(r.started_at)<ts(x.effective_at)),r=>r.race_id),after=unique(x.after.filter(r=>good(r,id)&&ts(r.started_at)>ts(x.effective_at)),r=>r.race_id);
   put("42",{crosswalk_verified:true,direction:x.previous_horse_id.split(":")[0]+"_TO_"+target.circuit,before:before.map(describe),after:after.map(describe),first_start_candidate:after.length===0&&x.post_transfer_history_complete_verified===true,conversion:null},[x.evidence_id,...before.map(r=>r.evidence_id),...after.map(r=>r.evidence_id)]);
  }
  for(const s of studies.filter(s=>s.target_course===target.course_id))put("46",s,s.evidence_ids,"hypotheses");
  const gate=pace?.runners?.find(x=>x.horse_no===entry.horse_no)?.items?.["64"]?.facts?.[0]?.value?.gate_order?.find(x=>x.horse_id===id);
  const hist=unique(drawHistories.filter(r=>r.horse_id===id&&eligibleRun(r)&&exact(r,target,courseKeys)&&r.course_id===target.course_id&&r.actual_gate_verified===true&&Number.isInteger(r.gate)&&r.gate>=1&&r.gate<=r.field_size&&r.field_size>1&&Number.isInteger(r.early_rank)&&r.early_rank>=1&&r.early_rank<=r.field_size),r=>r.race_id);
  const gateRef=pace?.runners?.find(x=>x.horse_no===entry.horse_no)?.items?.["64"]?.facts?.[0]?.evidence_ids??[];
  if(gate&&hist.length&&target.field_size>1)put("53",{current_normalized_gate:(gate.gate-1)/(target.field_size-1),observations:hist.map(r=>({race_id:r.race_id,normalized_gate:(r.gate-1)/(r.field_size-1),normalized_early_position:(r.early_rank-1)/(r.field_size-1),finish:r.finish,field_size:r.field_size})),interaction_effect:null},[...gateRef,...hist.map(r=>r.evidence_id)]);
  for(const x of Object.values(items))if(!x.facts.length&&!x.hypotheses.length)x.unknowns.push("REQUIRED_COMPARABLE_EVIDENCE_UNAVAILABLE");
  return {horse_no:entry.horse_no,horse_id:id,items};
 });
 return {runners,studies,scoring_authorized:false};
}
