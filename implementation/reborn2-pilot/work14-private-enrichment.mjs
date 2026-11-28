// Work14 exact private derivative, not official HTML or native authority.
// Source bytes remain in the operator's private directory. No CI data upload.
import assert from 'node:assert/strict';
import {sha} from './adapter.mjs';
export const WORK14_JSON_SHA='c5c812ada7aad222bf5408053e31ca0a5a5f6da8d4b7f928ed0b059515541654';
export const WORK14_FILE_SHA='2f6f278e34afb13c66e1c08a48cf4b7d4c93657f34d6061c7377e08f1e898570';
export function applyWork14(packet,roster,p,w,snapshot,joined,supplemental){
 assert.equal(sha(w),WORK14_JSON_SHA,'WORK14_FIXED_JSON_PIN');
 assert.equal(w.schema,'REBORN2_WORK14_REVIEWED_FACT_ENRICHMENT_1');
 assert.equal(w.scope,'PRIVATE_REPORTED_FACT_DIAGNOSTIC_ONLY_NOT_NATIVE_ADMISSION');
 assert.equal(w.basePacketDigest,sha(p));assert.equal(w.targetEventId,packet.target.eventId);
 assert.equal(w.baseFeatureCutoff,packet.cutoff);assert.equal(w.scheduledPost,p.target.scheduledPost);
 assert.ok(Object.values(w.guards).every(v=>v===false),'WORK14_GUARDS');
 const cutoff=w.latestDbCheckAt,ms=Date.parse(cutoff),post=Date.parse(w.scheduledPost);
 assert.ok(Date.parse(packet.cutoff)<=Date.parse(w.latestObservedCardAt)&&Date.parse(w.latestObservedCardAt)<=ms&&ms<post,'WORK14_TIMING');
 assert.equal(w.snapshot.id,snapshot.id);assert.equal(w.snapshot.sha256,snapshot.payload_digest);
 assert.equal(w.snapshot.rosterDigest,snapshot.official_roster_digest);
 assert.equal(w.currentRoster.explicitOfficialDeclaredCount,null);
 assert.equal(w.currentRoster.recordedCount,roster.length);
 assert.equal(w.currentRoster.rows.length,roster.length);
 for(const a of w.currentRoster.rows){const h=roster.find(q=>q.horseNo===a.horseNo),z=p.roster.find(q=>q.no===a.horseNo);assert.ok(h&&z&&a.horseId===h.horseId&&a.currentStatus===h.status&&a.weightKg===z.carriedKg&&a.numberNameWeightStatusMatch===true,'WORK14_ROSTER_MATCH');}
 const hist=packet.events.filter(e=>e.role==='HISTORICAL_RESULT'),byId=new Map(hist.map(e=>[e.eventId,e]));
 assert.equal(w.historicalEvents.length,hist.length);
 assert.equal(new Set(w.historicalEvents.map(e=>e.eventId)).size,hist.length);
 const roots=new Map(packet.roots.map(n=>[n.id,n])),add=(kind,payload,depends)=>{const k='DIAGNOSTIC_'+kind,d=[...new Set(depends)].sort(),id=sha([k,payload,d]);roots.set(id,{id,kind:k,payload,depends:d});return id;};
 const reported=[],legacy=[],counts=[],held=[],admitted=[];
 // Work14 preserves the exact prior race tuple. Only timestamped explicit
 // result metadata is accepted as reported context. Titles, legacy rows,
 // row counts and status totals never supply formal class/count/direction.
 for(const [i,z] of w.historicalEvents.entries()){
  const e=byId.get(z.eventId);assert.ok(e&&e.nativeRaceIdentity.dateJst<p.target.raceDate,'WORK14_HISTORICAL_EVENT');
  assert.equal(z.officialClassLiteral,null);assert.equal(z.officialDeclaredCount,null);assert.equal(z.officialDirectionLiteral,null);assert.equal(z.officialStarterClassificationCertified,false);
  assert.equal(z.baseReportedDistanceM,e.observations.distanceM?.value);assert.equal(z.baseReportedGoing,e.observations.goingLiteral?.value);
  if(z.legacyContextCandidate){assert.equal(z.legacyContextCandidate.asOfVerified,false);legacy.push(z.eventId);}
  if(z.countComparison)counts.push({event:z.eventId,state:z.countComparison});
  const v=z.storedOfficialResult;if(!v?.metadata)continue;
  const m=v.metadata;assert.ok(v.source==='NAR_OFFICIAL_RACEMARK'&&Date.parse(v.createdAt)<=Date.parse(w.baseFeatureCutoff)&&v.originalReplay===false,'WORK14_RESULT_PROVENANCE');
  const u=new URL(z.sourceRef);assert.ok(u.hostname==='www.keiba.go.jp'&&u.pathname==='/KeibaWeb/TodayRaceInfo/RaceMarkTable'&&u.searchParams.get('k_babaCode')===e.nativeRaceIdentity.venueId&&u.searchParams.get('k_raceDate')===e.nativeRaceIdentity.dateJst.replaceAll('-','/')&&Number(u.searchParams.get('k_raceNo'))===e.nativeRaceIdentity.raceNo,'WORK14_EVENT_SOURCE');
  if(m.distanceM!==e.observations.distanceM?.value||m.going!==e.observations.goingLiteral?.value||!['ダート','芝'].includes(m.surface)){held.push({event:z.eventId,reason:'WORK14_REPORTED_CONTEXT_CONFLICT'});continue;}
  const doc=add('SOURCE_DOCUMENT',{eventId:e.eventId,role:'HISTORICAL_RESULT',id:'WORK14_RESULT_METADATA:'+e.eventId,sourceRef:z.sourceRef,sha256:WORK14_FILE_SHA,representation:'REVIEWED_DERIVED_STORED_RESULT_METADATA',recordedAt:v.createdAt},[e.eventRoot]);
  const sr=add('SOURCE_FIELD',{eventId:e.eventId,horseId:null,field:'surfaceLiteral',root:{documentId:doc,field:'surfaceLiteral',rowPointer:JSON.stringify({path:'/historicalEvents/'+i+'/storedOfficialResult/metadata/surface'})},state:'REPORTED',reason:'WORK14_TIMESTAMPED_STORED_RESULT_METADATA_NOT_ORIGINAL'},[doc,e.eventRoot]);
  const ob=add('OBSERVATION',{eventId:e.eventId,horseId:null,field:'surfaceLiteral',state:'REPORTED',value:m.surface},[e.eventRoot,sr]);
  assert.ok(!e.observations.surfaceLiteral,'WORK14_NO_SILENT_OVERRIDE');e.observations.surfaceLiteral={state:'REPORTED_DIAGNOSTIC_FACT',value:m.surface,evidenceId:ob};
  const witness=add('CONTEXT_CORROBORATION',{eventId:e.eventId,distanceM:m.distanceM,going:m.going,sourcePath:'/historicalEvents/'+i+'/storedOfficialResult/metadata'},[doc,e.observations.distanceM.evidenceId,e.observations.goingLiteral.evidenceId]);
  admitted.push({event:z.eventId,surface:m.surface,witness,sourceRef:z.sourceRef});reported.push(z.eventId);
 }
 // Cross-check the exact 13 corner rows with the independently validated
 // snapshot. Hold the conflicting ordinal, not the entire horse history.
 assert.equal(w.cornerEvidence.length,13);assert.equal(w.peerFollowups.length,22);assert.equal(w.raceLevelLaps.length,1);
 const conflicts=[];
 for(const c of w.cornerEvidence){
  const x=snapshot.evidence.packet.evidence[c.index],h=roster.find(q=>q.horseNo===c.horseNo),e=byId.get(c.eventId),row=e?.rows.find(q=>q.nativeId===c.horseId);
  assert.ok(x&&h&&e&&row&&h.horseId===c.horseId&&x.horseNo===c.horseNo&&x.pastHorseNo===c.pastHorseNo&&row.observations.no.value===c.pastHorseNo,'WORK14_CORNER_ID');
  assert.equal(c.sourceRef,x.sourceRef);assert.deepEqual(c.cornerLabels,x.corners.map(q=>q.corner));assert.deepEqual(c.positions,x.corners.map(q=>q.position));
  if(c.matchState==='MATCH'){assert.ok(c.eligibleForOrdinalComparison&&joined.some(q=>q.horse===c.horseId&&q.event===c.eventId&&q.sourceIndex===c.index),'WORK14_MATCH_NOT_JOINED');continue;}
  assert.equal(c.matchState,'CONFLICT');assert.equal(c.eligibleForOrdinalComparison,false);
  const prior=row.observations.cornerPositionsLiteral;assert.ok(prior&&prior.value!==c.positions.join(','));
  const doc=add('SOURCE_DOCUMENT',{eventId:e.eventId,role:'HISTORICAL_RESULT',id:'WORK14_CONFLICT:'+e.eventId,sourceRef:c.sourceRef,sha256:WORK14_FILE_SHA,representation:'REVIEWED_DERIVED_CORNER_CONFLICT'},[e.eventRoot]);
  const sr=add('SOURCE_FIELD',{eventId:e.eventId,horseId:c.horseId,field:'cornerPositionsLiteral',root:{documentId:doc,field:'cornerPositionsLiteral',rowPointer:JSON.stringify({path:c.sourcePointer,cornerLabels:c.cornerLabels})},state:'REPORTED',reason:'STORED_ORDINAL_DIFFERS_FROM_REPORTED_CARD'},[doc,row.observations.no.evidenceId]);
  const conflict=add('UNAVAILABLE_FIELD',{eventId:e.eventId,horseId:c.horseId,field:'cornerPositionsLiteral',state:'CONFLICT',value:null,reason:'WORK14_ORDINAL_CONFLICT',cardLiteral:prior.value,storedLiteral:c.positions.join(',')},[prior.evidenceId,sr]);
  row.observations.cornerPositionsLiteral={state:'CONFLICT',value:null,reason:'WORK14_ORDINAL_CONFLICT',evidenceId:conflict};
  conflicts.push({horseId:c.horseId,event:c.eventId,sourceIndex:c.index,ref:conflict});
 }
 // Peer actual numbers/source identities retained in supplement; do not
 // invent peer's horse number or promote incomplete witness to grade evidence.
 const peerStrict=w.peerFollowups.filter(z=>z.strictSameSubjectWitness).length,peerConflict=w.peerFollowups.filter(z=>z.ordinalConflictInPriorWitness).length;
 for(const z of w.peerFollowups){const x=snapshot.evidence.packet.opponentFollowups[z.index];assert.ok(x&&z.peerHorseId===x.peerOfficialHorseId&&z.subjectHorseNo===x.horseNo&&z.peerPriorFinish===x.peerPriorFinish&&z.peerFollowupFinish===x.peerFollowupFinish&&z.sourceRef===x.sourceRef&&z.followupSourceRef===x.followupSourceRef&&z.sourceEventTimeURLMatch===true,'WORK14_PEER_BINDING');}
 const lap=w.raceLevelLaps[0],original=snapshot.evidence.packet.officialRaceLaps[0];
 assert.equal(lap.sourceRef,original.sourceRef);assert.equal(lap.individualHorseSectionals,false);assert.equal(lap.finishTimeReconciled,true);assert.equal(lap.distanceM,original.distance_m);assert.equal(lap.winnerTimeSeconds,original.winner_time_seconds);
 const target=packet.events.find(e=>e.role==='TARGET_CARD');
 const rd=add('SOURCE_DOCUMENT',{eventId:target.eventId,role:'TARGET_CARD',id:'WORK14_CURRENT_ROSTER_CHECK',sourceRef:p.source.raceCardUrl,sha256:WORK14_FILE_SHA,representation:'STORED_CARD_CORROBORATION_NOT_DECLARED_COUNT',capturedAt:w.latestObservedCardAt,checkedAt:cutoff},[target.eventRoot]);
 for(const h of roster){const row=target.rows.find(q=>q.nativeId===h.horseId);add('ROSTER_CORROBORATION',{eventId:target.eventId,horseId:h.horseId,horseNo:h.horseNo,sourcePath:'/currentRoster/rows/'+(h.horseNo-1)},[rd,row.observations.no.evidenceId,row.observations.status.evidenceId,row.observations.weightG.evidenceId]);}
 packet.roots=[...roots.values()];packet.cutoff=cutoff;
 return {sourceDigest:WORK14_FILE_SHA,baseFeatureCutoff:w.baseFeatureCutoff,featureCutoff:cutoff,reportedContexts:admitted,legacyHeld:legacy,countComparisons:counts,contextHeld:held,ordinalConflicts:conflicts,peerMatched:supplemental.coverage.peerMatched,peerStrict,peerConflict,lap:{event:lap.eventId,segments:lap.segments.length,scope:'RACE_LEVEL_ONLY'},rosterCorroborated:roster.length,explicitDeclaredCount:null,formal:false};
}
