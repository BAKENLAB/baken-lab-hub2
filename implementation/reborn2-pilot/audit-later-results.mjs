import assert from 'node:assert/strict';
import {sha} from './adapter.mjs';
// Verify the actual RANK37/EYE05 emitted logical relations against their graph.
// No new race data; no grade or authority effect.
export function auditLaterResultBindings(packet,out,{eyeEnabled=true}={}){
 const roots=new Map(packet.roots.map(n=>[n.id,n])),events=new Map(packet.events.map(e=>[e.eventId,e]));
 const uniq=a=>[...new Set(a)].sort();
 const close=ids=>{const seen=new Set(),stack=new Set();function visit(id){assert.ok(!stack.has(id),'LATER_CYCLE');if(seen.has(id))return;const n=roots.get(id);assert.ok(n,'LATER_ROOT_MISSING');assert.equal(id,sha([n.kind,n.payload,n.depends]));stack.add(id);n.depends.forEach(visit);stack.delete(id);seen.add(id);}ids.forEach(visit);return uniq([...seen]);};
 const types=['OPPONENT_LATER_REPORTED_RESULT','OPPONENT_LATER_RESULT_DISCOVERY','EYE05_OPPONENT_RESULT_REVIEW'];
 const counts=Object.fromEntries(types.map(t=>[t,0]));let logical=0,overlap=0,peerWitnesses=0;
 for(const h of out.runners){
  const findings=h.items.flatMap(i=>i.findings).filter(f=>types.includes(f.type)),byKey=new Map();
  const key=v=>JSON.stringify([h.horse,v.prior,v.later,v.opponent,v.priorFinish,v.laterFinish]);
  for(const f of findings){
   const v=f.value,a=events.get(v.prior),b=events.get(v.later);assert.ok(a&&b&&a.role==='HISTORICAL_RESULT'&&b.role==='HISTORICAL_RESULT'&&a.nativeRaceIdentity.dateJst<b.nativeRaceIdentity.dateJst,'LATER_EVENT_BINDING');
   const subject=a.rows.find(x=>x.nativeId===h.horse),peer=a.rows.find(x=>x.nativeId===v.opponent),later=b.rows.find(x=>x.nativeId===v.opponent);
   assert.ok(subject&&peer&&later&&h.horse!==v.opponent,'LATER_HORSE_BINDING');
   assert.equal(peer.observations.finish.value,v.priorFinish);assert.equal(later.observations.finish.value,v.laterFinish);
   const expected=uniq([subject.observations.finish.evidenceId,peer.observations.finish.evidenceId,later.observations.finish.evidenceId,peer.observations.no.evidenceId,later.observations.no.evidenceId,a.eventRoot,b.eventRoot]);
   assert.deepEqual(f.directRefs,expected,'LATER_DIRECT_REFS');assert.deepEqual(f.refs,close(expected),'LATER_CLOSURE');
   assert.equal(f.id,sha(['REBORN2_NORMAL_CANDIDATE_0.1',h.horse,f.item,f.type,v,expected]),'LATER_FINDING_ID');
   assert.equal(JSON.parse(JSON.stringify(f)).value.later,b.eventId,'LATER_SERIALIZATION');
   const k=key(v),group=byKey.get(k)??new Map();assert.ok(!group.has(f.type),'LATER_DUPLICATE_LOGICAL_TYPE');group.set(f.type,f);byKey.set(k,group);counts[f.type]++;
  }
  for(const group of byKey.values()){
   assert.equal(group.size,eyeEnabled?3:1,'LATER_DISCOVERY_FEEDBACK_CARDINALITY');assert.ok(group.has(types[0]));
   if(eyeEnabled){const d=group.get(types[1]),q=group.get(types[2]);assert.ok(d&&q);assert.equal(q.value.eyeId,d.id);assert.deepEqual(d.value,group.get(types[0]).value);}
   logical++;
  }
  const peer=packet.roots.filter(n=>n.kind==='DIAGNOSTIC_PEER_FOLLOWUP_WITNESS'&&n.payload.horseId===h.horse);
  peerWitnesses+=peer.length;const peerKeys=new Set();
  for(const n of peer){const p=n.payload,k=key({prior:p.eventId,later:p.followupEventId,opponent:p.peerId,priorFinish:p.peerPriorFinish,laterFinish:p.peerFollowupFinish});assert.ok(!peerKeys.has(k),'DUPLICATE_SNAPSHOT_PEER_FACT');peerKeys.add(k);if(byKey.has(k))overlap++;}
 }
 return {logicalPacketRelations:logical,counts,verifiedFindings:Object.values(counts).reduce((a,b)=>a+b,0),snapshotPeerWitnesses:peerWitnesses,overlapLogicalFacts:overlap,distinctCombinedLogicalFacts:logical+peerWitnesses-overlap,formal:false};
}
