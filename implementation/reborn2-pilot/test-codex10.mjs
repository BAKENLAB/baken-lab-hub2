import assert from 'node:assert/strict';
import {sha,ENGINE,assertFrozenEngine} from './adapter.mjs';
import {computeNormal} from './normal-engine.mjs';
import {exerciseExistingGraph,readIssuedGraph,runNormalReview} from './native-graph-issuance.mjs';
import {loadVerifiedFixtureGraph} from './derived-graph/graph-context.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const c=exerciseExistingGraph('08'),x=readIssuedGraph(c),p=runNormalReview(c);
assert.equal(p.schema,'REBORN2_NORMAL_CANDIDATE_0.2');
assert.ok(p.runners.every(h=>h.candidateGrade==='UNASSESSED'&&h.items.length===115));
assert.equal(p.field.unresolved.length,2);
// Reuse the fixed, verified FK34 originals. Project ONLY already recorded
// fields. Actual distance checkpoint ranks remain explicitly fixture
// distance observations, never relabeled as real or corner positions.
function project(g){
 const roots=[];function add(kind,payload,depends=[]){const body={kind:'FIXTURE_'+kind,payload,depends:[...new Set(depends)].sort()},id=sha([body.kind,body.payload,body.depends]);roots.push({id,...body});return id;}
 const events=g.docs.map(d=>{
  const target=d.kind==='TARGET_CARD',eventId=d.eventId,identity={id:eventId,issuer:d.issuer,nativeId:eventId,venueId:d.conditions?.venue??'TEST:UNKNOWN',dateJst:new Date((target?d.scheduledPost:d.eventAt)*1000).toISOString().slice(0,10),role:d.kind};
  const er=add('EVENT_IDENTITY',identity),source=g.validated.roots.find(n=>n.eventId===eventId&&n.pointer==='/');assert.ok(source);
  const dr=add('SOURCE_DOCUMENT',{eventId,sha256:source.rawSha256,pointer:'/'},[er]);
  function obs(subject,field,value,pointer,identityRef,extra={}){
   if(value==null)return undefined;
   const sr=add('SOURCE_FIELD',{eventId,horseId:subject,field,root:{documentId:dr,rowPointer:JSON.stringify({pointer,...extra}),field}},[dr,identityRef]);
   return {state:'OBSERVED_TEST_FORMAT',value,evidenceId:add('OBSERVATION',{eventId,horseId:subject,field,state:'OBSERVED',value},[identityRef,sr])};
  }
  const o={};for(const [k,val,ptr] of [['surfaceLiteral',d.conditions?.surface,'/conditions/surface'],['distanceM',d.conditions?.distance_m,'/conditions/distance_m'],['goingLiteral',d.conditions?.going,'/conditions/going'],['classLiteral',d.conditions?.class_label,'/conditions/class_label'],['directionLiteral',d.geometry?.direction,'/geometry/direction'],['declaredCount',target?d.rows.length:d.registeredCount,target?'/rows:length':'/registeredCount']]){const f=obs(null,k,val,ptr,er);if(f)o[k]=f;}
  const rows=d.rows.map((q,i)=>{const ri=add(target?'TARGET_ROSTER_ROW':'HISTORICAL_ROW_IDENTITY',{eventId,horseId:q.nativeId,horseNo:q.no},[er,dr]);const os={no:{state:'OBSERVED_TEST_FORMAT',value:q.no,evidenceId:ri}};for(const [k,value,sourceKey] of [['status',q.status,'status'],['gate',q.gate,'gate'],['weightG',q.weightG,'weightG'],['finish',q.finish,'finish'],['final600Ms',q.final600Ms,'final600Ms'],['officialMarginLiteral',q.officialMargin,'officialMargin']]){const f=obs(q.nativeId,k,value,'/rows/'+i+'/'+sourceKey,ri);if(f)os[k]=f;}
   if(!target&&q.checkpointRanks&&d.geometry?.checkpoints_m){os.fixtureCheckpointRanks=obs(q.nativeId,'fixtureCheckpointRanks',q.checkpointRanks,'/rows/'+i+'/checkpointRanks',ri,{fixtureCheckpointDistancesM:d.geometry.checkpoints_m});}
   return {nativeId:q.nativeId,observations:os};});
  return {eventId,role:d.kind,nativeRaceIdentity:identity,eventRoot:er,observations:o,rows};
 });
 const roster=g.docs[0].rows.map(q=>({horseId:q.nativeId,horseNo:q.no,status:q.status}));
 return {packet:{scope:'FIXED_FIXTURE_GRAPH_ONLY',target:{eventId:events[0].eventId},cutoff:g.request.cutoff??null,events,roots},roster};
}
for(const name of ['FK34_FULL','FK34_UNKNOWN']){
 const g=await loadVerifiedFixtureGraph(name),{packet,roster}=project(g),on=computeNormal(packet,roster,{fixture:true}),off=computeNormal(packet,roster,{fixture:true,eyeEnabled:false});
 assert.equal(on.runners.length,5);assert.ok(on.runners.every(h=>h.items.length===115&&h.formalGrade===null));
 assert.ok(on.runners.some(h=>h.placePaths.length>0),'EXISTING_ORDINAL_PLACE_PATH');
 assert.ok(on.runners.some(h=>h.candidateGrade==='B'),'EXISTING_ORDINAL_B');
 const recovery=on.runners.find(h=>h.horse==='TEST:H4'),prior=off.runners.find(h=>h.horse==='TEST:H4');
 assert.ok(recovery.feedback.some(f=>f.eye==='EYE03'),'EYE_RECOVERY');
 assert.ok(recovery.counterPaths.some(p=>p.mode==='LATE_ORDINAL_RECOVERY'),'EYE_MIXED_OR_COUNTER_PATH');
 assert.ok(!prior.counterPaths.some(p=>p.mode==='LATE_ORDINAL_RECOVERY'),'EYE_OFF_REMOVES_MODE');
 if(name==='FK34_UNKNOWN'){assert.equal(on.runners.find(h=>h.horse==='TEST:H5').candidateGrade,'UNASSESSED');assert.ok(on.runners.some(h=>h.candidateGrade==='B'),'UNKNOWN_RIVAL_NOT_GLOBAL_HOLD');}
 console.log('CODEX10_EXISTING_ORDINAL_PIPELINE PASS '+JSON.stringify({name,grades:on.runners.map(h=>h.candidateGrade),place:on.runners.map(h=>h.placePaths.length),counter:on.runners.map(h=>h.counterPaths.length),eyeOn:recovery.feedback.length,eyeOff:prior.feedback.length,unknown:on.field.unresolved,formal:false}));
}
const tampered=structuredClone(x.packet);tampered.events[1].rows[0].observations.finish.value=9;assert.throws(()=>computeNormal(tampered,x.roster,{fixture:true}));
console.log('CODEX10_ROOT_BINDING_AND_PARTIAL PASS');
