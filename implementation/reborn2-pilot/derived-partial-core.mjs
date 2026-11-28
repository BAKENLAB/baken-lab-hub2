// Derived computation only from frozen Work44 partial consumer blob
// c6b1bfd83f7b86f228dd7ec509689e8d9119e66c. Do not call directly with untrusted data.
import assert from 'node:assert/strict';
const uniq=a=>[...new Set(a)].sort(),num=Number.isFinite;
const key=(e,k)=>e?.observations?.[k];
const horse=(e,h)=>e.rows.find(r=>r.nativeId===h);
const contextFields=['surfaceLiteral','directionLiteral','distanceM','goingLiteral','classLiteral'];

export function computePartial(p,{native=false}={}){
 const observedState=native?'OBSERVED_NATIVE_VERIFIED':'OBSERVED_TEST_FORMAT';
 const findingScope=native?'DOCUMENTED_NATIVE_OBSERVATION_NOT_CURRENT_ABILITY_PROOF':'DOCUMENTED_SYNTHETIC_OBSERVATION_NOT_CURRENT_ABILITY_PROOF';
 const eligibility=native?'PARTIAL_NATIVE_ONLY_CURRENT_ABILITY_UNCERTIFIED':'PARTIAL_RESEARCH_ONLY_CURRENT_STATUS_UNCERTIFIED';
 const value=(o,k)=>o?.[k]?.state===observedState?o[k].value:null;
 const context=e=>Object.fromEntries(contextFields.map(k=>[k,value(e.observations,k)]));
 const byId=new Map(p.roots.map(r=>[r.id,r]));
 const source=obs=>{
  const direct=uniq(obs.filter(o=>o?.state===observedState).map(o=>o.evidenceId)),seen=new Set();
  function visit(k){if(seen.has(k))return;const r=byId.get(k);assert.ok(r,'PARTIAL_NATIVE_ROOT');seen.add(k);r.depends.forEach(visit);}
  direct.forEach(visit);return {directRefs:direct,refs:uniq([...seen])};
 };
 const card=p.events.find(e=>e.role==='TARGET_CARD'),history=p.events.filter(e=>e.role==='HISTORICAL_RESULT');
 assert.ok(card&&card.eventId===p.target.eventId);
 const all=p.items.map(h=>{
  const target=horse(card,h.horseId);assert.ok(target);
  const observed=[],items=new Map(h.items.map(i=>[i.item,{...i,sourceState:i.state,sourceReason:i.reason,partialFindings:[],formal:false}]));
  const emit=(item,type,event,v,obs,limits=[])=>{
   const proof=source(obs);assert.ok(proof.directRefs.length,'PARTIAL_OBSERVATION_WITHOUT_SOURCE');
   const finding={item,type,event,value:v,...proof,limits,scope:findingScope,independent_vote:false};
   const base=items.get(item);assert.ok(base);base.partialFindings.push(finding);base.state='PARTIAL_ANALYZED';base.reason='OBSERVATION_COMPUTED_FULL_ITEM_JUDGMENT_HELD';
   observed.push(finding);return finding;
  };
  const byType=t=>observed.filter(f=>f.type===t);
  for(const e of history){
   const r=horse(e,h.horseId);if(!r)continue;
   const ro=r.observations,co=card.observations,eo=e.observations,finish=value(ro,'finish'),final=value(ro,'final600Ms');
   const count=value(eo,'declaredCount');
   if(num(finish))emit('RANK02','REPORTED_FINISH',e.eventId,{finish,declaredCount:count},[ro.finish,eo.declaredCount],['ACTUAL_STARTER_STATUS_UNCERTIFIED']);
   if(num(final))emit('RANK06','REPORTED_INDIVIDUAL_FINAL600',e.eventId,{ms:final},[ro.final600Ms],['NOT_INDIVIDUAL_CROSSING_CLOCK']);
   if(value(ro,'officialMarginLiteral')!==null)emit('RANK03','LITERAL_MARGIN',e.eventId,{literal:value(ro,'officialMarginLiteral')},[ro.officialMarginLiteral],['NO_MARGIN_TO_TIME_CONVERSION']);
   const a=context(card),b=context(e),changes=contextFields.filter(k=>a[k]!=null&&b[k]!=null&&a[k]!==b[k]),unknown=contextFields.filter(k=>a[k]==null||b[k]==null);
   const cstate=unknown.length?'REPORTED_CONTEXT_INCOMPLETE':changes.length?'REPORTED_CONTEXT_DIFFERS':'REPORTED_CONTEXT_MATCH';
   for(const [item,k] of [['RANK43','distanceM'],['RANK47','surfaceLiteral'],['RANK48','goingLiteral'],['RANK49','directionLiteral']]){
    if(a[k]!=null&&b[k]!=null)emit(item,'REPORTED_CONDITION_COMPARISON',e.eventId,{field:k,current:a[k],historical:b[k],state:a[k]===b[k]?'MATCHED_LITERAL':'DIFFERENT_LITERAL'},[co[k],eo[k]],['NO_APTITUDE_OR_CLASS_CONVERSION']);
   }
   const venueMatch=card.nativeRaceIdentity.venueId===e.nativeRaceIdentity.venueId;
   if(!native||contextFields.some(k=>value(co,k)!==null||value(eo,k)!==null))emit('RANK45','REPORTED_CONTEXT',e.eventId,{current:a,historical:b,changes,unknown,venueMatch,state:cstate},contextFields.flatMap(k=>[co[k],eo[k]]),['GEOMETRY_AND_CLASS_EQUIVALENCE_UNCERTIFIED']);
   const w=value(ro,'weightG'),tw=value(target.observations,'weightG');
   if(num(w)&&num(tw))emit('RANK54','REPORTED_WEIGHT_CHANGE',e.eventId,{pastG:w,currentG:tw,deltaG:tw-w},[ro.weightG,target.observations.weightG],['WEIGHT_EFFECT_NOT_ESTABLISHED']);
   // Direct same-event comparisons of reported finishing positions and
   // individual final600; no conversion from race leader laps.
   for(const rival of e.rows.filter(q=>q.nativeId!==r.nativeId&&horse(card,q.nativeId))){
    const rr=rival.observations,rf=value(rr,'finish'),rf600=value(rr,'final600Ms');
    if(!num(finish)||!num(rf))continue;
    emit('RANK35','DIRECT_REPORTED_COMPARISON',e.eventId,{rival:rival.nativeId,finish,rivalFinish:rf,order:finish<rf?'AHEAD':finish>rf?'BEHIND':'UNRESOLVED_TIE',final600DifferenceMs:num(final)&&num(rf600)?final-rf600:null,context:cstate},[ro.finish,rr.finish,ro.final600Ms,rr.final600Ms,target.observations.no,horse(card,rival.nativeId).observations.no,...contextFields.flatMap(k=>[co[k],eo[k]])],['HISTORICAL_ONLY','NO_CURRENT_ORDER_INFERENCE']);
   }
   if(num(final)&&num(finish)&&(!native||num(count)&&count===e.rows.length)){
    const rivals=e.rows.filter(q=>q.nativeId!==r.nativeId),measured=rivals.filter(q=>num(value(q.observations,'final600Ms')));
    const lo=1+measured.filter(q=>value(q.observations,'final600Ms')<final).length;
    const hi=1+measured.filter(q=>value(q.observations,'final600Ms')<=final).length+(rivals.length-measured.length);
    const state=hi<finish?'REPORTED_SECTION_RANK_BETTER_THAN_FINISH':lo>finish?'REPORTED_SECTION_RANK_WORSE_THAN_FINISH':'REPORTED_SECTION_RANK_OVERLAPS_FINISH';
    const evidence=[ro.finish,ro.final600Ms,eo.declaredCount,...rivals.flatMap(q=>[q.observations.no,q.observations.final600Ms])];
    const v={finish,reportedFinal600Rank:[lo,hi],state,unmeasured:rivals.filter(q=>!num(value(q.observations,'final600Ms'))).map(q=>q.nativeId)};
    emit('RANK25','REPORTED_SECTION_VS_FINISH',e.eventId,v,evidence,['NO_PHYSICAL_RESERVE_OR_INDIVIDUAL_CROSSING_CLOCK']);
    emit('EYE02','SECTION_FINISH_REVIEW',e.eventId,v,evidence,['NO_CURRENT_BENEFIT_ASSERTION']);
   }
  }
  const body=value(target.observations,'bodyWeightKg'),delta=value(target.observations,'bodyWeightDeltaKg');
  if(num(body))emit('RANK81','REPORTED_CURRENT_BODY_WEIGHT',card.eventId,{kg:body,deltaKg:delta},[target.observations.bodyWeightKg,target.observations.bodyWeightDeltaKg],['NO_FORM_INFERENCE']);
  const axis=(axis,observations,held)=>({axis,state:observations.length?'PARTIAL_OBSERVATION':'HELD',observations,held});
  const axes=[axis('A',[...byType('REPORTED_FINISH'),...byType('REPORTED_INDIVIDUAL_FINAL600')],['CURRENT_ABILITY_NOT_ESTABLISHED']),axis('B',[...byType('REPORTED_CONTEXT'),...byType('REPORTED_WEIGHT_CHANGE')],['COURSE_VERSION_AND_STATUS_UNCERTIFIED']),axis('C',byType('DIRECT_REPORTED_COMPARISON'),['NO_CURRENT_FULL_FIELD_ORDER']),axis('D',byType('REPORTED_SECTION_VS_FINISH'),['NO_INDIVIDUAL_CROSSING_CLOCK_OR_CAUSAL_LOAD']),axis('E',byType('SECTION_FINISH_REVIEW'),['NO_CURRENT_POSITIVE_DISCOVERY_PROVEN'])];
  return {horse:h.horseId,grade:'UNASSESSED',formalGrade:null,currentStatus:null,eligibility,analysisItems:[...items.values()],ability:{scope:'REPORTED_HISTORICAL_OBSERVATIONS',axes},deployment:{state:'HELD',reason:'CURRENT_STATUS_AND_INDIVIDUAL_CROSSING_CLOCK_UNCERTIFIED'},winPaths:[],placePaths:[],counterPaths:[],rankBoundsAcrossReviewedScenarios:null,missingness:{decisive:['CURRENT_STATUS_UNCERTIFIED','INDIVIDUAL_CROSSING_CLOCK_UNAVAILABLE','COURSE_VERSION_UNCERTIFIED'],source:target.unavailable},eye:[...items.values()].filter(i=>i.item.startsWith('EYE')).map(i=>({category:i.item,state:i.state,reason:i.reason,findings:i.partialFindings})),formal:false};
 });
 assert.ok(all.every(h=>h.analysisItems.length===115&&h.eye.length===15));

 return all;
}
