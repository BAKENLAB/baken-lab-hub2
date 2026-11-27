import {assertFictionalTarget,fictionalTime,fixtureHorse,localAdmission,historyKnown,gateKnown} from './fictional-research-context.mjs';
// Research-only descriptive condition circuit. No external I/O or grade.
export function analyzeConditions43to57(args){return analyzeConditions43to57Core(args,false);}
export function analyzeConditions43to57Fixture(args){return analyzeConditions43to57Core(args,true);}
function analyzeConditions43to57Core({target,roster,runs=[],historyWitnesses=[],geometry=[],exposures=[],draws=[],benchmarks=[],researchReturn=[],traceRead=()=>{}},fictional){
 if(fictional)assertFictionalTarget(target,roster);
 const ts=x=>fictional?fictionalTime(x):typeof x==="string"&&/(Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
 const cutoff=ts(target.cutoff),start=ts(target.started_at);
 const str=x=>typeof x==="string"&&x.trim().length>0;
 const num=x=>typeof x==="number"&&Number.isFinite(x);
 const positive=x=>num(x)&&x>0;
 const horse=x=>fictional?fixtureHorse(x):typeof x==="string"&&/^(JRA|LOCAL):\d+$/.test(x);
 const scoped=(x,c)=>horse(x)&&(fictional?c==="FIXTURE":x.startsWith(c+":"));
 const unique=(arr,k)=>{const n=new Map();for(const x of arr)n.set(k(x),(n.get(k(x))||0)+1);return arr.filter(x=>n.get(k(x))===1);};
 const admitted=e=>fictional?localAdmission(target,e):e?.source_verified===true&&e?.identity_status==="VERIFIED"&&str(e.evidence_id)&&str(e.source_ref)&&str(e.source_version)&&ts(e.published_at)<=ts(e.observed_at)&&ts(e.observed_at)<=cutoff;
 if(!(fictional?target.circuit==="FIXTURE":["JRA","LOCAL"].includes(target.circuit))||!str(target.race_id)||!Number.isFinite(cutoff)||!Number.isFinite(start)||cutoff>=start)throw Error("TARGET_INVALID");
 if(!Number.isInteger(target.field_size)||target.field_size<1||roster.length!==target.field_size||roster.some(h=>!Number.isInteger(h.horse_no)||h.horse_no<1)||unique(roster,h=>h.horse_no).length!==roster.length)throw Error("ROSTER_CONFLICT");
 const ids=unique(roster.filter(h=>admitted(h)&&scoped(h.horse_id,target.circuit)&&h.race_id===target.race_id),h=>h.horse_id);
 const allowed=r=>admitted(r)&&scoped(r.horse_id,target.circuit)&&r.circuit===target.circuit&&str(r.race_id)&&r.race_id!==target.race_id&&ts(r.started_at)<ts(r.published_at)&&ts(r.started_at)<start&&Number.isInteger(r.field_size)&&r.field_size>0&&((r.status==="FINISHED"&&Number.isInteger(r.finish)&&r.finish>=1&&r.finish<=r.field_size)||(["DNF","DQ","DNS"].includes(r.status)&&r.finish===null))&&(fictional?r.conditions_observed===true:r.conditions_verified===true);
 const accepted=unique(runs.filter(allowed),r=>r.horse_id+"|"+r.race_id);
 const conditionKeys=["track","course_id","surface","distance","going","turn","class_key","layout","rule_version","eligibility"];
 const known=x=>x!==undefined&&x!==null&&x!=="";
 const differences=(a,b,exclude=[])=>conditionKeys.filter(k=>!exclude.includes(k)).filter(k=>!known(a[k])||!known(b[k])||a[k]!==b[k]);
 const geometryFor=r=>unique(geometry.filter(g=>admitted(g)&&g.circuit===r.circuit&&g.course_id===r.course_id&&str(g.course_version)&&g.course_version===r.course_version&&ts(g.effective_from)<=ts(r.started_at)&&ts(r.started_at)<ts(g.effective_until)),g=>g.course_id+"|"+g.course_version)[0];
 const residualFor=r=>unique(benchmarks.filter(b=>admitted(b)&&b.horse_id===r.horse_id&&b.race_id===r.race_id&&b.formally_admitted===true&&ts(b.baseline_available_at)<ts(r.started_at)&&num(b.elapsed_residual_seconds)),b=>b.horse_id+"|"+b.race_id)[0];
 const record=r=>({race_id:r.race_id,started_at:r.started_at,finish:r.finish,status:r.status,field_size:r.field_size,gap_winner:num(r.gap_winner)?r.gap_winner:null,final3f:positive(r.final3f)?r.final3f:null,conditions:Object.fromEntries(conditionKeys.map(k=>[k,r[k]??null])),evidence_id:r.evidence_id});
 const profile=(list,k)=>{const groups=new Map();for(const r of list){if(!known(r[k]))continue;const v=r[k];if(!groups.has(v))groups.set(v,[]);groups.get(v).push(record(r));}return [...groups].map(([value,observations])=>({value,n:observations.length,wins:observations.filter(x=>x.finish===1).length,nonwins:observations.filter(x=>x.finish!==1).length,observations}));};
 const direction=d=>d>0?"EXTEND":d<0?"SHORTEN":"SAME";
 const runners=roster.map(entry=>{
  const items=Object.fromEntries(Array.from({length:15},(_,i)=>[String(i+43),{facts:[],hypotheses:[],counterevidence:[],unknowns:[],effect:"NO_RECORDED_USE"}]));
  const put=(n,value,refs)=>items[n].facts.push({value,evidence_ids:[...new Set(refs)]});
  const unknown=(n,s)=>items[n].unknowns.push(s);
  const h=ids.find(x=>x.horse_no===entry.horse_no)?.horse_id;
  if(!h){for(const n in items)unknown(n,"IDENTITY_UNVERIFIED_OR_CONFLICT");return {horse_no:entry.horse_no,horse_id:null,items};}
  const own=accepted.filter(r=>r.horse_id===h).sort((a,b)=>ts(a.started_at)-ts(b.started_at));
  const current=(fictional?target.conditions_observed===true:target.conditions_verified===true)?target:{};
  for(const [id,k] of [["43","distance"],["45","track"],["47","surface"],["48","going"],["49","turn"]]){
   const material=own.filter(r=>k==="distance"?positive(r[k]):str(r[k]));
   if(material.length)put(id,{profiles:profile(material,k),current_value:current[k]??null,exact_condition_races:material.filter(r=>differences(r,current).length===0).map(r=>r.race_id),missing:own.length-material.length},material.map(r=>r.evidence_id));
  }
  for(const r of own){
   const b=residualFor(r);if(b)for(const id of ["43","48"])put(id,{race_id:r.race_id,admitted_residual_seconds:b.elapsed_residual_seconds},[r.evidence_id,b.evidence_id]);
   const g=geometryFor(r);
   if(g&&positive(g.straight_length_m))put("50",{race_id:r.race_id,straight_length_m:g.straight_length_m,finish:r.finish,final3f:positive(r.final3f)?r.final3f:null,last_corner_to_finish_rank_change:Number.isInteger(r.last_corner)&&Number.isInteger(r.finish)?r.last_corner-r.finish:null,individual_straight_split_measured:false},[r.evidence_id,g.evidence_id]);
   if(g&&(num(g.elevation_m)||Array.isArray(g.verified_slopes)&&g.verified_slopes.length))put("51",{race_id:r.race_id,elevation_m:g.elevation_m??null,slopes:g.verified_slopes??[],proxy_status:g.verified_slopes?.length?"DOCUMENTED_GEOMETRY":"ELEVATION_ONLY",finish:r.finish,individual_slope_deceleration_measured:false},[r.evidence_id,g.evidence_id]);
   if(g&&Array.isArray(g.corners)&&g.corners.length&&Array.isArray(r.labeled_corners)&&r.labeled_corners.every(c=>Number.isInteger(c.corner)&&Number.isInteger(c.position)&&c.position>0&&c.position<=r.field_size)){
     const pos=unique(r.labeled_corners,c=>c.corner).sort((a,b)=>a.corner-b.corner);
     const observations=pos.slice(1).flatMap((c,i)=>c.corner===pos[i].corner+1&&g.corners.some(x=>x.corner===c.corner)&&g.corners.some(x=>x.corner===pos[i].corner)?[{from:pos[i].corner,to:c.corner,rank_gain:pos[i].position-c.position}]:[]);
     if(observations.length)put("52",{race_id:r.race_id,geometry:g.corners,observations,distance_traveled_measured:false},[r.evidence_id,g.evidence_id]);
   }
   if(positive(r.weight_kg))put("54",{race_id:r.race_id,weight_kg:r.weight_kg,finish:r.finish,conditions:record(r).conditions},[r.evidence_id]);
  }
  // EYE07 requests a scoped re-review, not a new raw fact. Rebind to
  // accepted history and current condition; return association and counter.
  if(fictional)for(const m of researchReturn.filter(x=>x.kind==='CONDITION_RETURN'&&x.horse_id===h)){
   const r=own.find(x=>x.race_id===m.race_id),last=own.at(-1);
   if(!r||!last||r===last||differences(r,current).length||!differences(last,current).length||r.course_version!==current.course_version)continue;
   const value={research_return:'EYE-07',race_id:r.race_id,previous_race_id:last.race_id,restored_fields:differences(last,current),historical_finish:r.finish,historical_field:r.field_size,previous_finish:last.finish,previous_field:last.field_size,relative_finish:r.field_size>1?(r.field_size-r.finish)/(r.field_size-1):null,previous_relative_finish:last.field_size>1?(last.field_size-last.finish)/(last.field_size-1):null,cause:null,scope:'OBSERVED_RETURN_NOT_CAUSAL'};
   for(const k of ['43','48'])if(k==='43'||value.restored_fields.includes('going')){put(k,value,[r.evidence_id,last.evidence_id,entry.evidence_id]);traceRead({consumer:'analyzeConditions43to57Fixture.conditionReturn',consumer_item_id:k,horse_no:entry.horse_no,item_id:'EYE-07',value,reason:'Rebound matched prior condition and mismatched latest result, not a causal advantage'});}
  }
  const witness=unique(historyWitnesses.filter(w=>admitted(w)&&w.horse_id===h&&w.target_race_id===target.race_id&&historyKnown(target,w)&&Array.isArray(w.ordered_race_ids)&&w.ordered_race_ids.length===own.length&&w.ordered_race_ids.every((v,i)=>v===own[i].race_id)),w=>w.horse_id)[0];
  if(witness){
   for(let i=1;i<own.length;i++){
    const a=own[i-1],b=own[i],ref=[a.evidence_id,b.evidence_id,witness.evidence_id];
    if(positive(a.distance)&&positive(b.distance))put("44",{from:a.race_id,to:b.race_id,delta_m:b.distance-a.distance,ratio:b.distance/a.distance,direction:direction(b.distance-a.distance),from_finish:a.finish,to_finish:b.finish,confounders:differences(a,b,["distance"])},ref);
    if(str(a.course_id)&&str(b.course_id)&&a.course_id!==b.course_id)put("46",{source_course:a.course_id,target_course:b.course_id,from_race:a.race_id,to_race:b.race_id,observed_finishes:[a.finish,b.finish],confounders:differences(a,b,["course_id"]),cohort_validation:null},ref);
    if(str(a.surface)&&str(b.surface)&&a.surface!==b.surface)put("47",{surface_transition:[a.surface,b.surface],races:[a.race_id,b.race_id],finishes:[a.finish,b.finish],confounders:differences(a,b,["surface"])},ref);
    if(positive(a.weight_kg)&&positive(b.weight_kg))put("54",{races:[a.race_id,b.race_id],delta_kg:b.weight_kg-a.weight_kg,finishes:[a.finish,b.finish],confounders:differences(a,b),weight_effect:null},ref);
   }
   const last=own.at(-1);
   if(last&&positive(last.distance)&&positive(current.distance))put("44",{current_transition:true,delta_m:current.distance-last.distance,direction:direction(current.distance-last.distance),confounders:differences(last,current,["distance"])},[last.evidence_id,witness.evidence_id]);
  }else for(const n of ["44","46","54"])unknown(n,"CONTIGUOUS_HISTORY_NOT_ATTESTED");
  const d=unique(draws.filter(x=>admitted(x)&&x.horse_id===h&&x.race_id===target.race_id&&x.field_size===target.field_size&&Number.isInteger(x.gate_position)&&x.gate_position>0&&x.gate_position<=target.field_size&&gateKnown(target,x)),x=>x.horse_id)[0];
  if(d&&draws.filter(x=>admitted(x)&&x.race_id===target.race_id&&gateKnown(target,x)&&x.gate_position===d.gate_position).length===1)put("53",{gate_position:d.gate_position,normalized_draw:target.field_size===1?null:(d.gate_position-1)/(target.field_size-1),style_profile:null,draw_interaction:null},[d.evidence_id]);
  for(const e of unique(exposures.filter(e=>admitted(e)&&e.horse_id===h&&own.some(r=>r.race_id===e.race_id)&&["OFFICIAL_REPORT","AUTHORIZED_VIDEO"].includes(e.source_scope)&&["SAND","TRAFFIC"].includes(e.type)&&["EXPOSED","NOT_EXPOSED"].includes(e.exposure_status)&&str(e.response_observation)),e=>e.evidence_id)){
   const r=own.find(r=>r.race_id===e.race_id);if(!(ts(e.published_at)>ts(r.started_at)))continue;if(e.type==="SAND"&&r.surface!=="DIRT")continue;
   put(e.type==="SAND"?"55":"56",{race_id:e.race_id,exposure_status:e.exposure_status,response_observation:e.response_observation,source_scope:e.source_scope},[r.evidence_id,e.evidence_id]);
  }
  const months=own.map(r=>({race_id:r.race_id,date:r.local_date,finish:r.finish,conditions:record(r).conditions,evidence_id:r.evidence_id})).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date??"")&&Number(r.date.slice(5,7))>=1&&Number(r.date.slice(5,7))<=12);
  if(months.length)put("57",{months,years_observed:[...new Set(months.map(r=>r.date.slice(0,4)))],season_effect:null},months.map(r=>r.evidence_id));
  unknown("46","DIRECTIONAL_COHORT_AND_HOLDOUT_NOT_VALIDATED");unknown("53","STYLE_AND_DRAW_INTERACTION_NOT_CONNECTED");
  for(const n in items)if(!items[n].facts.length)unknown(n,"NO_ADMITTED_ANALYSIS_FACT");
  return {horse_no:entry.horse_no,horse_id:h,items};
 });
 const coverage=Object.fromEntries(Array.from({length:15},(_,i)=>{const n=String(i+43);return [n,{target:roster.length,with_output:runners.filter(h=>h.items[n].facts.length).length,observations:runners.reduce((s,h)=>s+h.items[n].facts.length,0),consumed:0}];}));
 return {runners,coverage,accepted_runs:accepted.length,excluded_runs:runs.length-accepted.length,scoring_authorized:false,final_grade:null};
}
