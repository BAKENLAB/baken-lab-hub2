// Work10 NORMAL material adapter. Consumes only Codex08 issued graph capability.
// No raw source loading, authority override, grading, network, persistence or V48 mutation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readIssuedGraph,validateGraphClosure} from '../reborn2-pilot/native-graph-issuance.mjs';
import {ENGINE,sha} from '../reborn2-pilot/adapter.mjs';
const bytes=readFileSync(new URL('./normal-material-115.json',import.meta.url));
assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),'4a98a25b8ac6772ee78480a65d4aca22de4b1a20');
const map=JSON.parse(bytes);
assert.equal(map.items.length,115);
const eventFields=['surfaceLiteral','directionLiteral','distanceM','goingLiteral','classLiteral','courseVersion','declaredCount','leaderLapSlots','cornerGroupSlots'];
const horseFields=['displayName','gate','weightG','bodyWeightKg','bodyWeightDeltaKg','sexAge','equipmentLiteral','status','finish','finishClockLiteral','officialMarginLiteral','final600Ms','cornerPositionsLiteral'];
const resultFields=new Set(['finish','finishClockLiteral','officialMarginLiteral','final600Ms','cornerPositionsLiteral','leaderLapSlots','cornerGroupSlots']);
const key=(...a)=>JSON.stringify(a);
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const y of Object.values(x))freeze(y);Object.freeze(x);}return x;};
const observed=f=>f?.state==='OBSERVED'?f.value:null;
const identity=(e,h)=>[e.nativeRaceIdentity.issuer,e.nativeRaceIdentity.nativeId,h.nativeId];
export function prepareNormalSupply(capability){
 const g=readIssuedGraph(capability); // WeakMap-issued capability; no plain JSON fallback
 const {packet:p,receipt:r,facts,roster}=g;
 assert.equal(p.scope,'NATIVE_PARTIAL_GRAPH_VERIFIED','NORMAL_NATIVE_GRAPH_REQUIRED');
 assert.equal(r.engineCommit,ENGINE);assert.equal(r.sourceGraphDigest,sha(p));assert.equal(r.factsDigest,sha(facts));
 validateGraphClosure(p);
 const roots=new Map(p.roots.map(n=>[n.id,n])), factMap=new Map(facts.map(f=>[f.key,f]));
 assert.equal(factMap.size,facts.length,'DUPLICATE_FACT');
 const used=new Set();
 const root=id=>{assert.ok(roots.has(id),'NORMAL_ROOT_MISSING');used.add(id);return id;};
 const read=(e,h,field)=>{
  const f=factMap.get(key(e.eventId,h,field));
  if(!f)return {state:'ABSENT',value:null,reason:'NOT_IN_ISSUED_GRAPH',refs:[]};
  assert.ok(['OBSERVED','MISSING','HELD','CONFLICT'].includes(f.state));
  const refs=[root(f.factId),...f.sourceRefs.map(root)];
  if(f.state==='OBSERVED'){assert.ok(f.chosenRefs.length);f.chosenRefs.forEach(root);}
  else assert.equal(f.value,null);
  return {state:f.state,value:f.value,reason:f.reason,refs:[...new Set(refs)],selectedRefs:[...f.chosenRefs]};
 };
 const card=p.events.find(e=>e.role==='TARGET_CARD');
 assert.ok(card&&p.events.filter(e=>e.role==='TARGET_CARD').length===1&&card.eventId===p.target.eventId);
 const hist=p.events.filter(e=>e.role==='HISTORICAL_RESULT');
 const currentIds=new Set(roster.map(h=>h.horseId));
 assert.equal(currentIds.size,roster.length);
 const asEvent=e=>{
  const ri=e.nativeRaceIdentity;
  assert.ok(ri.issuer===card.nativeRaceIdentity.issuer&&typeof ri.nativeId==='string'&&!ri.nativeId.startsWith('TEST:'));
  const target=e.eventId===card.eventId;
  assert.equal(target?e.role:'HISTORICAL_RESULT',e.role);
  if(!target)assert.ok(ri.dateJst<card.nativeRaceIdentity.dateJst,'NORMAL_HISTORY_CUTOFF');
  const fields=Object.fromEntries(eventFields.filter(f=>!target||!resultFields.has(f)).map(f=>[f,read(e,null,f)]));
  const rows=e.rows.map(h=>{
   assert.ok(typeof h.nativeId==='string'&&!h.nativeId.startsWith('TEST:'));
   const no=h.observations.no;assert.equal(no.state,'OBSERVED_NATIVE_VERIFIED');assert.ok(Number.isInteger(no.value));
   const f=Object.fromEntries(horseFields.filter(k=>!target||!resultFields.has(k)).map(k=>[k,read(e,h.nativeId,k)]));
   return {horseId:h.nativeId,horseNo:no.value,identity:identity(e,h),identityRef:root(no.evidenceId),currentEntrant:currentIds.has(h.nativeId),fields:f};
  });
  assert.equal(new Set(rows.map(h=>h.horseId)).size,rows.length);
  assert.equal(new Set(rows.map(h=>h.horseNo)).size,rows.length);
  const declared=observed(fields.declaredCount);
  // Full identity row coverage is distinct from certified historical starter classification.
  return {eventId:e.eventId,identity:ri,eventRef:root(e.eventRoot),fields,rows,declaredCount:declared,identityRowCoverage:declared===null?'UNKNOWN':declared===rows.length?'COUNT_MATCH_ONLY':'COUNT_MISMATCH',starterClassificationCertified:false};
 };
 const target=asEvent(card),history=hist.map(asEvent);
 assert.equal(target.rows.length,roster.length);
 const byHorse=new Map(target.rows.map(h=>[h.horseId,h]));
 const field=roster.map(h=>{
  const row=byHorse.get(h.horseId);assert.ok(row&&row.horseNo===h.horseNo);
  const status=observed(row.fields.status);
  assert.ok(h.status==='UNKNOWN'||status===h.status,'NORMAL_STATUS_BINDING');
  return {...row,status:status===null?'UNKNOWN':status,rosterDeclaredStatus:h.status,
    historyEventIds:history.filter(e=>e.rows.some(q=>q.horseId===h.horseId)).map(e=>e.eventId)};
 });
 const direct=[],common=[],opponents=[];
 // Index all past row identities without inferring rank or class equivalence.
 const pastByHorse=new Map();
 for(const e of history)for(const h of e.rows){const list=pastByHorse.get(h.horseId)??[];list.push({eventId:e.eventId,horseId:h.horseId,horseNo:h.horseNo,identityRef:h.identityRef});pastByHorse.set(h.horseId,list);}
 for(const e of history){
  const entrants=e.rows.filter(h=>h.currentEntrant);
  for(let i=0;i<entrants.length;i++)for(let j=i+1;j<entrants.length;j++){
   const a=entrants[i],b=entrants[j];
   direct.push({eventId:e.eventId,a:a.horseId,b:b.horseId,rowRefs:[a.identityRef,b.identityRef],finishAvailable:observed(a.fields.finish)!==null&&observed(b.fields.finish)!==null,scope:'SAME_EVENT_REPORTED_FACTS_ONLY'});
  }
  for(const a of entrants)for(const b of e.rows.filter(h=>h.horseId!==a.horseId)){
   const followups=(pastByHorse.get(b.horseId)??[]).filter(x=>history.find(z=>z.eventId===x.eventId).identity.dateJst>e.identity.dateJst);
   opponents.push({eventId:e.eventId,subject:a.horseId,opponent:b.horseId,rowRefs:[a.identityRef,b.identityRef],laterObservedRows:followups,scope:'OBSERVED_OPPONENT_HISTORY_NOT_STRENGTH'});
  }
 }
 // One relation per ordered current-pair/shared-opponent; retain actual event
 // pairs, never convert a comparison chain to a transitive rank.
 const relation=new Map();
 for(const o of opponents){const by=relation.get(o.subject)??new Map(),xs=by.get(o.opponent)??[];xs.push(o);by.set(o.opponent,xs);relation.set(o.subject,by);}
 for(let i=0;i<field.length;i++)for(let j=i+1;j<field.length;j++){
  const a=field[i].horseId,b=field[j].horseId,ra=relation.get(a)??new Map(),rb=relation.get(b)??new Map();
  for(const [op,ax] of ra){if(op===a||op===b||!rb.has(op))continue;const pairs=[];
   for(const x of ax)for(const y of rb.get(op))if(x.eventId!==y.eventId)pairs.push({eventA:x.eventId,eventB:y.eventId,rowRefs:[...new Set([...x.rowRefs,...y.rowRefs])]});
   if(pairs.length)common.push({a,b,opponent:op,pairs,scope:'COMMON_ID_DIFFERENT_EVENTS_NOT_TRANSITIVE_ORDER'});
  }
 }
 // Explicitly preserve the entire field even when a runner has no history or
 // unknown status. Pace solver must not treat UNKNOWN as inactive/non-leading.
 const paceInputs=field.map(h=>({horseId:h.horseId,horseNo:h.horseNo,status:h.status,gate:h.fields.gate,
  history:h.historyEventIds.map(id=>{const e=history.find(x=>x.eventId===id),r=e.rows.find(q=>q.horseId===h.horseId);return {eventId:id,identityRef:r.identityRef,cornerPositions:r.fields.cornerPositionsLiteral,cornerGroups:e.fields.cornerGroupSlots,declaredCount:e.fields.declaredCount,leaderLaps:e.fields.leaderLapSlots,finish:r.fields.finish,final600:r.fields.final600Ms,distance:e.fields.distanceM,surface:e.fields.surfaceLiteral,going:e.fields.goingLiteral,direction:e.fields.directionLiteral,gate:r.fields.gate};})}));
 // Collect actual source dependencies of each referenced node. Missing facts
 // retain evidence references; absence is never a synthetic zero.
 function visit(id,seen){if(seen.has(id))return;const n=roots.get(id);assert.ok(n);seen.add(id);n.depends.forEach(x=>visit(x,seen));}
 const allRefs=new Set();used.forEach(id=>visit(id,allRefs));
 const body={schema:'REBORN2_NORMAL_SUPPLY_1',scope:'ISSUED_NATIVE_MATERIAL_ONLY_NOT_GRADE',engineCommit:ENGINE,sourceGraphDigest:r.sourceGraphDigest,sourceFactsDigest:r.factsDigest,cutoff:p.cutoff,scheduledPost:r.scheduledPost,startLower:r.startLower,target,field,history,direct,common,opponents,paceInputs,roots:[...allRefs].sort().map(id=>roots.get(id)),
  itemMap:map.items.map(i=>({id:i.id,name:i.name,category:i.category,requiredMaterial:i.normalMaterial,limit:i.limit})),
  limitations:['NO_INDIVIDUAL_CHECKPOINT_CLOCKS','NO_EXACT_DISTANCE_RANKS','NO_PHYSICAL_LOAD_INFERENCE','HISTORICAL_STARTER_CLASSIFICATION_NOT_CERTIFIED','EXTERNAL_CLASS_COURSE_RATING_INCIDENT_SOURCES_NOT_CONNECTED','CURRENT_EXCLUSION_HELD_IN_FIXED_CONTRACT'],analysisExecuted:false,gradeAuthority:false,persistenceAllowed:false};
 return freeze({...body,supplyDigest:sha(body)});
}
