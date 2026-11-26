import {personIdentity} from './person-identity.mjs';
import {common} from './common-evidence.mjs';
export function analyzeState78to92({target,roster,evidence=[],runs=[],history=[],current=[],workouts=[],riderResults=[],trainerResults=[],pedigrees=[],offspringResults=[],travel=[],personAttestations=[]}){
 const c=common(target,roster,evidence),{ts,unique,bound,identities,prior,add,close}=c;
 const past=unique(runs.filter(prior),r=>r.horse_id+"|"+r.race_id);
 const pos=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
 const key=x=>typeof x==="string"&&x.length>0;
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(Date.parse(x)).toISOString().slice(0,10)===x?Date.parse(x):NaN;
 const interval=(a,b)=>(date(b)-date(a))/86400000;
 const count=r=>Number.isInteger(r.finish)&&r.finish>0&&r.finish<=r.field_size;
 const cond=["course_id","course_version","distance","surface","going","class_key"];
 const exact=(a,b)=>cond.every(k=>a[k]!=null&&a[k]===b[k]);
 const aggregate=rs=>({n:rs.length,wins:rs.filter(r=>r.finish===1).length,other_finishes:rs.filter(r=>count(r)&&r.finish>1).length,observations:rs.map(r=>({race_id:r.race_id,horse_id:r.horse_id,finish:count(r)?r.finish:null,course_id:r.course_id??null}))});
 const external=r=>r.circuit===target.circuit&&r.race_id!==target.race_id&&key(r.race_id)&&key(r.horse_id)&&bound(r,r.horse_id,r.race_id)&&ts(r.started_at)<c.cutoff&&ts(c.byId.get(r.evidence_id).published_at_or_null)>ts(r.started_at)&&r.conditions_verified===true&&count(r);
 const person=(row,kind)=>personIdentity({row,kind,target,context:c,attestations:personAttestations});
 const riders=unique(riderResults.filter(r=>external(r)&&person(r,'jockey').id!==null),r=>r.race_id+"|"+r.horse_id);
 const trainers=unique(trainerResults.filter(r=>external(r)&&person(r,'trainer').id!==null),r=>r.race_id+"|"+r.horse_id);
 const children=unique(offspringResults.filter(external),r=>r.race_id+"|"+r.horse_id);
 const runners=roster.map(entry=>{
  const h=identities.find(x=>x.horse_no===entry.horse_no),I=c.items(78,92),put=(n,v,refs,kind="facts")=>add(I,n,kind,v,refs);
  if(!h){for(const x of Object.values(I))x.unknowns.push("IDENTITY_UNVERIFIED");return {horse_no:entry.horse_no,horse_id:null,items:I};}
  const id=h.horse_id;
  const own=past.filter(r=>r.horse_id===id).sort((a,b)=>ts(b.started_at)-ts(a.started_at));
  const w=unique(history.filter(x=>x.horse_id===id&&bound(x,id,target.race_id)&&x.chronology_verified===true&&Array.isArray(x.ordered_race_ids)&&new Set(x.ordered_race_ids).size===x.ordered_race_ids.length),x=>x.horse_id)[0];
  const last=w&&own.find(r=>r.race_id===w.ordered_race_ids[0]);
  const curr=unique(current.filter(x=>x.horse_id===id&&bound(x,id,target.race_id)),x=>x.horse_id)[0];
  const refs=[h.evidence_id,curr?.evidence_id,w?.evidence_id,last?.evidence_id];
  if(last&&Number.isFinite(interval(last.local_date,target.local_date))&&interval(last.local_date,target.local_date)>=0){
   const days=interval(last.local_date,target.local_date);
   put("78",{days_since_last_start:days,last_race_id:last.race_id,rest_classification:null},refs);
   const intervals=[];
   for(let i=0;i<w.ordered_race_ids.length-1;i++){
    const a=own.find(r=>r.race_id===w.ordered_race_ids[i+1]),b=own.find(r=>r.race_id===w.ordered_race_ids[i]);
    if(a&&b&&interval(a.local_date,b.local_date)>=0)intervals.push({races:[a.race_id,b.race_id],days:interval(a.local_date,b.local_date),finish:b.finish??null,refs:[a.evidence_id,b.evidence_id]});
   }
   put("79",{interval_days:days,interval_history:intervals,consecutive_start_flag:null},[...refs,...intervals.flatMap(x=>x.refs)]);
   put("80",{historical_intervals:intervals,starts_since_break:null,break_threshold:null},[...refs,...intervals.flatMap(x=>x.refs)],"hypotheses");
  }
  if(curr&&pos(curr.body_weight_kg)){
   const previous=pos(last?.body_weight_kg)?last.body_weight_kg:null;
   const delta=previous===null?null:curr.body_weight_kg-previous;
   const conflict=Number.isFinite(curr.reported_weight_delta)&&delta!==null&&delta!==curr.reported_weight_delta;
   put("81",{body_weight_kg:curr.body_weight_kg,delta_kg:conflict?null:delta,relative_change:conflict||delta===null?null:delta/previous,reported_delta_conflict:conflict,version:c.byId.get(curr.evidence_id).source_version},refs);
  }
  const weights=own.filter(r=>pos(r.body_weight_kg)&&count(r));
  if(weights.length)put("82",{observations:weights.map(r=>({race_id:r.race_id,weight_kg:r.body_weight_kg,finish:r.finish,conditions_match:exact(r,target),current_delta_kg:pos(curr?.body_weight_kg)?curr.body_weight_kg-r.body_weight_kg:null})),success_definition:null},[...refs,...weights.map(r=>r.evidence_id)]);
  const ws=unique(workouts.filter(x=>x.horse_id===id&&bound(x,id,target.race_id)&&key(x.session_id)&&ts(x.session_at)<c.cutoff&&ts(c.byId.get(x.evidence_id).published_at_or_null)>=ts(x.session_at)&&key(x.facility)&&key(x.measurement_method)),x=>x.session_id);
  if(ws.length)put("83",{workout_sessions:ws.map(x=>({session_id:x.session_id,session_at:x.session_at,facility:x.facility,measurement_method:x.measurement_method,splits:Array.isArray(x.splits)?x.splits.filter(pos):[],load:x.load??null})),fitness_conclusion:null},ws.map(x=>x.evidence_id));
  if(curr?.equipment_verified===true&&Array.isArray(curr.equipment)&&curr.equipment.every(key)){
   const prev=last?.equipment_verified===true&&Array.isArray(last.equipment)?last.equipment:null;
   put("84",{equipment_current:curr.equipment,added:prev?curr.equipment.filter(x=>!prev.includes(x)):null,removed:prev?prev.filter(x=>!curr.equipment.includes(x)):null,first_use:null},refs);
  }
  const currentPerson=curr?person({...curr,race_id:target.race_id},'jockey'):{id:null,refs:[]};
  const jockey=currentPerson.id;
  if(!jockey)for(const n of ['85','86','87','88'])I[n].unknowns.push('PERSON_ID_NOT_VERIFIED');
  if(key(jockey)){
   const rr=riders.filter(r=>r.jockey_id===jockey),course=rr.filter(r=>exact(r,target));
   if(rr.length)put("85",{jockey_id:jockey,raw_profile:aggregate(rr),adjusted_ability:null},[...refs,...currentPerson.refs,...rr.flatMap(r=>[r.evidence_id,...person(r,'jockey').refs])]);
   if(course.length)put("86",{jockey_id:jockey,course_profile:aggregate(course),other_profile:aggregate(rr.filter(r=>!exact(r,target))),adjusted_ability:null},[...refs,...currentPerson.refs,...rr.flatMap(r=>[r.evidence_id,...person(r,'jockey').refs])]);
   const pair=own.filter(r=>person(r,'jockey').id===jockey),other=own.filter(r=>person(r,'jockey').id!==null&&person(r,'jockey').id!==jockey);
   if(pair.length||other.length)put("87",{pair_history:aggregate(pair),alternative_rider_history:aggregate(other),matched_pair:aggregate(pair.filter(r=>exact(r,target))),matched_other:aggregate(other.filter(r=>exact(r,target))),pair_effect:null},[...refs,...currentPerson.refs,...[...pair,...other].flatMap(r=>[r.evidence_id,...person(r,'jockey').refs])]);
   if(last&&person(last,'jockey').id!==null)put("88",{rider_transition:last.jockey_id===jockey?"CONTINUED":pair.length?"RETURNING":"CHANGED_PRIOR_PAIR_UNKNOWN",previous_rider:last.jockey_id,current_rider:jockey,improvement:null},[...refs,...currentPerson.refs,...person(last,'jockey').refs]);
  }
  const trainer=curr?person({...curr,race_id:target.race_id},'trainer'):{id:null,refs:[]};
  if(!trainer.id)I['89'].unknowns.push('PERSON_ID_NOT_VERIFIED');
  if(trainer.id){
   const tr=trainers.filter(r=>r.trainer_id===curr.trainer_id);
   if(tr.length)put("89",{trainer_id:curr.trainer_id,profile:aggregate(tr),matched:aggregate(tr.filter(r=>exact(r,target))),adjusted_effect:null},[...refs,...trainer.refs,...tr.flatMap(r=>[r.evidence_id,...person(r,'trainer').refs])]);
  }
  const ped=unique(pedigrees.filter(x=>x.horse_id===id&&bound(x,id,target.race_id)&&key(x.sire_id)&&key(x.dam_id)),x=>x.horse_id)[0];
  if(ped){
   const related=children.filter(x=>x.horse_id!==id&&x.sire_id===ped.sire_id);
   put("90",{sire_id:ped.sire_id,dam_id:ped.dam_id,damsire_id:ped.damsire_id??null,offspring_cohort:aggregate(related),unique_offspring:new Set(related.map(x=>x.horse_id)).size,condition_effect:null},[ped.evidence_id,...related.map(r=>r.evidence_id)]);
  }
  if(curr&&Number.isFinite(date(curr.birth_date))&&date(curr.birth_date)<=date(target.local_date)&&key(curr.sex_status)){
   put("91",{birth_date:curr.birth_date,calendar_year_age:Number(target.local_date.slice(0,4))-Number(curr.birth_date.slice(0,4)),sex_status:curr.sex_status,age_stage_effect:null},refs);
  }
  const trip=unique(travel.filter(x=>x.horse_id===id&&bound(x,id,target.race_id)&&key(x.origin)&&key(x.destination)),x=>x.horse_id)[0];
  if(trip)put("92",{origin:trip.origin,destination:trip.destination,travel_observed_or_proxy:trip.actual_transport_verified===true?"OBSERVED":"LOCATION_PROXY",duration_minutes:trip.actual_transport_verified===true&&pos(trip.duration_minutes)?trip.duration_minutes:null,fatigue:null},[trip.evidence_id]);
  return {horse_no:entry.horse_no,horse_id:id,items:close(I)};
 });
 return c.finish(runners,78,92);
}
