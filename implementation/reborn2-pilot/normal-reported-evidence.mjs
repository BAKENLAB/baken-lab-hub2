// Codex13: private reported evidence is consumed by the common NORMAL
// calculation, NOT by native/fixture grading. No missing official count or
// class is substituted. Every finding carries the same graph closure.
import assert from 'node:assert/strict';
import {sha} from './adapter.mjs';
const unique=a=>[...new Set(a)].sort();
const observed=x=>x?.state==='REPORTED_DIAGNOSTIC_FACT'?x:null;
export function attachWork14PeerLap(packet,roster,w,snapshot){
 assert.equal(packet.scope,'PRIVATE_REPORTED_FACT_GRAPH_ONLY');
 assert.equal(w.snapshot.sha256,snapshot.payload_digest);
 const roots=new Map(packet.roots.map(n=>[n.id,n]));
 const hist=new Map(packet.events.filter(e=>e.role==='HISTORICAL_RESULT').map(e=>[e.eventId,e]));
 const add=(kind,payload,depends)=>{const k='DIAGNOSTIC_'+kind,d=unique(depends),id=sha([k,payload,d]);for(const q of d)assert.ok(roots.has(q),'PEER_LAP_DEPENDENCY');roots.set(id,{id,kind:k,payload,depends:d});return id;};
 const before=t=>Number.isFinite(Date.parse(t))&&Date.parse(t)<=Date.parse(w.snapshot.asOf);
 const cornerRef=c=>{
  const matches=[...roots.values()].filter(n=>c.matchState==='CONFLICT'
   ?n.kind==='DIAGNOSTIC_UNAVAILABLE_FIELD'&&n.payload.eventId===c.eventId&&n.payload.horseId===c.horseId&&n.payload.field==='cornerPositionsLiteral'&&n.payload.state==='CONFLICT'
   :n.kind==='DIAGNOSTIC_CORNER_CORROBORATION'&&n.payload.eventId===c.eventId&&n.payload.horseId===c.horseId&&n.payload.sourceIndex===c.index);
  assert.equal(matches.length,1,'PEER_CORNER_WITNESS_CLOSURE');
  return matches[0].id;
 };
 const eventId=z=>{const map={'佐賀':'32','船橋':'19','園田':'27'};assert.ok(map[z.track]);return 'NAR-'+map[z.track]+'-'+z.raceDate.replaceAll('-','')+'-'+String(z.raceNo).padStart(2,'0');};
 assert.equal(new Set(w.peerFollowups.map(q=>q.index)).size,22);
 for(const z of w.peerFollowups){
  const x=snapshot.evidence.packet.opponentFollowups[z.index],e=hist.get(z.priorEventId),later=hist.get(z.followupEventId),h=roster.find(q=>q.horseId===z.subjectHorseId),row=e?.rows.find(q=>q.nativeId===z.subjectHorseId);
  assert.ok(x&&e&&later&&h&&row&&h.horseNo===x.horseNo&&z.subjectHorseNo===h.horseNo,'PEER_ROW_BINDING');
  assert.equal(eventId(x.priorRace),e.eventId);assert.equal(eventId(x.followupRace),later.eventId);
  assert.ok(e.nativeRaceIdentity.dateJst<later.nativeRaceIdentity.dateJst&&before(x.sourceCheckedAt)&&before(x.followupCheckedAt),'PEER_TIME');
  assert.equal(z.peerHorseId,x.peerOfficialHorseId);assert.equal(z.peerPriorFinish,x.peerPriorFinish);assert.equal(z.peerFollowupFinish,x.peerFollowupFinish);assert.equal(z.sourceRef,x.sourceRef);assert.equal(z.followupSourceRef,x.followupSourceRef);
  const prior=w.cornerEvidence.find(c=>c.index===z.priorCornerIndex);assert.ok(prior&&prior.horseId===h.horseId&&prior.eventId===e.eventId,'PEER_SUBJECT_WITNESS');
  assert.equal(z.ordinalConflictInPriorWitness,prior.matchState==='CONFLICT');
  const laterWitnesses=w.cornerEvidence.filter(c=>z.followupEventCornerIndices.includes(c.index));assert.ok(laterWitnesses.length&&laterWitnesses.every(c=>c.eventId===later.eventId),'PEER_LATER_EVENT_WITNESS');
  assert.equal(z.strictSameSubjectWitness,laterWitnesses.some(c=>c.horseId===h.horseId));
  const finish=observed(row.observations.finish);assert.ok(finish,'PEER_SUBJECT_FINISH');
  const doc=(ev,sourceRef,checkedAt,role)=>add('SOURCE_DOCUMENT',{eventId:ev.eventId,role:'HISTORICAL_RESULT',id:'WORK14_PEER:'+z.index+':'+role,sourceRef,sha256:w.snapshot.sha256,representation:'STORED_TWO_RESULT_PAGE_FACT_NOT_ORIGINAL',sourceCheckedAt:checkedAt},[ev.eventRoot]);
  const a=doc(e,z.sourceRef,x.sourceCheckedAt,'PRIOR'),b=doc(later,z.followupSourceRef,x.followupCheckedAt,'FOLLOWUP');
  const a1=add('PEER_SOURCE_FIELD',{eventId:e.eventId,horseId:z.peerHorseId,field:'finish',value:z.peerPriorFinish,sourcePath:z.sourcePointer+'/peerPriorFinish',sourceRef:z.sourceRef},[a]);
  const b1=add('PEER_SOURCE_FIELD',{eventId:later.eventId,horseId:z.peerHorseId,field:'finish',value:z.peerFollowupFinish,sourcePath:z.sourcePointer+'/peerFollowupFinish',sourceRef:z.followupSourceRef},[b]);
  // No invented peer horse number or peer row, subject finish remains card.
  add('PEER_FOLLOWUP_WITNESS',{eventId:e.eventId,followupEventId:later.eventId,horseId:h.horseId,peerId:z.peerHorseId,subjectFinish:finish.value,peerPriorFinish:z.peerPriorFinish,peerFollowupFinish:z.peerFollowupFinish,strictSameSubjectWitness:z.strictSameSubjectWitness,ordinalConflictInPriorWitness:z.ordinalConflictInPriorWitness,sourceIndex:z.index,scope:'REPORTED_PEER_HISTORY_NOT_CLASS_CERTIFIED'},[a1,b1,finish.evidenceId,row.observations.no.evidenceId,cornerRef(prior),...laterWitnesses.map(cornerRef)]);
 }
 const z=w.raceLevelLaps[0],x=snapshot.evidence.packet.officialRaceLaps[0],e=hist.get(z.eventId);
 assert.ok(e&&eventId(x.pastRace)===e.eventId&&before(x.sourceCheckedAt)&&x.individual_horse_sectionals===false&&z.individualHorseSectionals===false);
 assert.equal(z.sourceRef,x.sourceRef);assert.equal(z.distanceM,x.distance_m);assert.equal(z.winnerTimeSeconds,x.winner_time_seconds);
 assert.deepEqual(z.segments,x.segments.map(a=>({fromM:a.from_m,toM:a.to_m,seconds:a.seconds,cumulativeSeconds:a.cumulative_seconds})));
 let d=0,t=0;for(const a of z.segments){assert.equal(a.fromM,d);assert.ok(a.toM>d&&a.seconds>0);d=a.toM;t+=Math.round(a.seconds*10);assert.equal(t,Math.round(a.cumulativeSeconds*10));}assert.equal(d,z.distanceM);assert.equal(t,Math.round(z.winnerTimeSeconds*10));
 const doc=add('SOURCE_DOCUMENT',{eventId:e.eventId,role:'HISTORICAL_RESULT',id:'WORK14_RACE_LAP:'+e.eventId,sourceRef:z.sourceRef,sha256:w.snapshot.sha256,representation:'STORED_RACE_LEVEL_LAP_NOT_ORIGINAL',sourceCheckedAt:x.sourceCheckedAt},[e.eventRoot]);
 add('RACE_LEVEL_LAP_WITNESS',{eventId:e.eventId,distanceM:d,segments:z.segments,winnerTimeSeconds:z.winnerTimeSeconds,sourcePath:z.sourcePointer,individualHorseSectionals:false},[doc,e.eventRoot,e.observations.distanceM.evidenceId]);
 packet.roots=[...roots.values()];
 return {peerWitnesses:22,raceLapWitnesses:1};
}
// Invoked INSIDE analyzeNormalContext, after its unchanged strict grade
// decision. Adds evidence-backed partial calculations to existing 115 items,
// separate partial axes and routes; no grade or strict path promotion.
export function calculateReportedEvidence({packet,roster,horse,eyeEnabled,emit,close,refs}){
 assert.equal(packet.scope,'PRIVATE_REPORTED_FACT_GRAPH_ONLY');
 const card=packet.events.find(e=>e.role==='TARGET_CARD'),hist=packet.events.filter(e=>e.role==='HISTORICAL_RESULT');
 const nodes=new Map(packet.roots.map(n=>[n.id,n])),row=(e,h)=>e?.rows.find(r=>r.nativeId===h),o=(e,k)=>observed(e?.observations?.[k]),v=(e,k)=>o(e,k)?.value??null;
 const ctx=hist.filter(e=>e.nativeRaceIdentity.venueId===card.nativeRaceIdentity.venueId&&v(e,'distanceM')===v(card,'distanceM'));
 const all=ctx.flatMap(e=>{const r=row(e,horse);if(!r||!Number.isInteger(v(r,'finish')))return [];
  const f=o(r,'cornerPositionsLiteral'),p=f?.value?.split(',').map(Number),labels=f?close([f.evidenceId]).map(id=>nodes.get(id)).filter(n=>n.kind==='DIAGNOSTIC_SOURCE_FIELD'&&n.payload.field==='cornerPositionsLiteral').map(n=>{try{return JSON.parse(n.payload.root.rowPointer).cornerLabels??null;}catch{return null;}}).filter(Boolean):[];
  const explicit=labels.length>0&&labels.every(a=>JSON.stringify(a)===JSON.stringify(labels[0])&&a.length===p.length);
  return [{event:e.eventId,finish:v(r,'finish'),going:v(e,'goingLiteral'),surface:v(e,'surfaceLiteral'),positions:p??null,convention:explicit?'EXPLICIT_CORNERS:'+labels[0].join(','):'REPORTED_ORDER_UNLABELED',ordinalConflict:r.observations.cornerPositionsLiteral?.state==='CONFLICT',refs:refs(e.eventRoot,o(e,'distanceM'),o(e,'goingLiteral'),o(e,'surfaceLiteral'),o(r,'finish'),o(r,'no'),f,r.observations.cornerPositionsLiteral?.state==='CONFLICT'?r.observations.cornerPositionsLiteral.evidenceId:null)}];});
 const limits=['REPORTED_FACTS_ONLY','CLASS_DIRECTION_AND_STARTER_COUNT_UNVERIFIED','NOT_CURRENT_ABILITY_OR_GRADE'];
 const partial=(id,type,val,rs,extra=[])=>emit(id,type,val,rs,[...limits,...extra],'PARTIAL_REPORTED_EVIDENCE');
 const clean=x=>({event:x.event,finish:x.finish,going:x.going,surface:x.surface,positions:x.positions,convention:x.convention,ordinalConflict:x.ordinalConflict});
 const refsAll=refs(all.map(z=>z.refs)),wins=all.filter(z=>z.finish===1),places=all.filter(z=>z.finish<=3),bad=all.filter(z=>z.finish>3),exact=all.filter(z=>z.going===v(card,'goingLiteral'));
 if(all.length){partial('RANK01','PARTIAL_SAME_VENUE_DISTANCE_PERFORMANCE',all.map(clean),refsAll);partial('RANK12','PARTIAL_REPORTED_WIN_AND_NONWIN',{wins:wins.map(clean),nonwins:all.filter(z=>z.finish!==1).map(clean)},refsAll);}
 if(all.length>=2)partial('RANK13','PARTIAL_REPEAT_OUTCOME',all.map(clean),refsAll);
 if(exact.length)partial('RANK95','PARTIAL_MATCHED_VENUE_DISTANCE_GOING',exact.map(clean),refs(exact.map(z=>z.refs),o(card,'goingLiteral'),o(card,'distanceM')));
 const ordinal=all.filter(z=>z.positions?.length>=2&&!z.ordinalConflict);
 const role=z=>z.positions[0]<=3?'FORWARD':'OTHER';
 const roleEvidence=ordinal.map(z=>({...clean(z),role:role(z)}));
 if(ordinal.length)partial('RANK58','PARTIAL_HISTORICAL_ROLE_OPTIONS',roleEvidence,refs(ordinal.map(z=>z.refs)),['NOT_ACTUAL_START']);
 if(ordinal.length>=2)partial('RANK60','PARTIAL_ROLE_REPEAT_AND_VARIATION',roleEvidence,refs(ordinal.map(z=>z.refs)));
 const field=roster.map(h=>{const runs=ctx.flatMap(e=>{const r=row(e,h.horseId),f=o(r,'cornerPositionsLiteral');return f?[{event:e.eventId,role:Number(f.value.split(',')[0])<=3?'FORWARD':'OTHER',ref:f.evidenceId}]:[];});return {horse:h.horseId,roles:unique(runs.map(z=>z.role)),refs:refs(runs.map(z=>z.ref))};});
 const fieldRefs=refs(card.eventRoot,field.map(z=>z.refs));
 partial('RANK65','PARTIAL_ROLE_COMPETITION_HYPOTHESIS',{historicalOptions:field.map(({refs,...q})=>q),actualRange:[0,roster.length]},fieldRefs,['NOT_ACTUAL_PACE']);
 const peer=packet.roots.filter(n=>n.kind==='DIAGNOSTIC_PEER_FOLLOWUP_WITNESS'&&n.payload.horseId===horse).map(n=>({...n.payload,ref:n.id,order:n.payload.subjectFinish<n.payload.peerPriorFinish?'SUPPORT':n.payload.subjectFinish>n.payload.peerPriorFinish?'COUNTER':'NEUTRAL',gradeEligible:false}));
 const relevant=peer.filter(p=>all.some(z=>z.event===p.eventId)),laterTop3=relevant.filter(p=>p.peerFollowupFinish<=3&&!p.ordinalConflictInPriorWitness);
 for(const p of peer){partial('RANK34','PARTIAL_PEER_REPORTED_FOLLOWUP',p,[p.ref],['SUBJECT_FINISH_CARD_REPORTED','NO_GLOBAL_CLASS_OR_STRENGTH',...(p.ordinalConflictInPriorWitness?['PRIOR_ORDINAL_CONFLICT_NO_GRADE']:[])]);}
 const direct=[];for(const z of all){const e=hist.find(q=>q.eventId===z.event);for(const rival of roster.filter(h=>h.horseId!==horse)){const q=row(e,rival.horseId),f=v(q,'finish');if(Number.isInteger(f))direct.push({event:z.event,rival:rival.horseId,ownFinish:z.finish,rivalFinish:f,order:z.finish<f?'SUPPORT':z.finish>f?'COUNTER':'NEUTRAL',refs:refs(z.refs,o(q,'finish'),o(q,'no'))});}}
 const common=[];for(const a of relevant.filter(p=>!p.ordinalConflictInPriorWitness))for(const n of packet.roots.filter(n=>n.kind==='DIAGNOSTIC_PEER_FOLLOWUP_WITNESS'&&n.payload.horseId!==horse&&n.payload.peerId===a.peerId&&n.payload.eventId!==a.eventId&&!n.payload.ordinalConflictInPriorWitness)){const b=n.payload,ea=hist.find(e=>e.eventId===a.eventId),eb=hist.find(e=>e.eventId===b.eventId);if(!ea||!eb||ea.nativeRaceIdentity.venueId!==eb.nativeRaceIdentity.venueId||v(ea,'distanceM')!==v(eb,'distanceM')||v(ea,'goingLiteral')!==v(eb,'goingLiteral'))continue;const order=a.subjectFinish<a.peerPriorFinish&&b.subjectFinish>b.peerPriorFinish?'SUPPORT':a.subjectFinish>a.peerPriorFinish&&b.subjectFinish<b.peerPriorFinish?'COUNTER':'NEUTRAL';const q={rival:b.horseId,peer:a.peerId,events:[a.eventId,b.eventId],order,gradeEligible:false};common.push(q);partial('RANK36','PARTIAL_COMMON_PEER_DIRECTION',q,[a.ref,n.id],['NO_TRANSITIVE_ORDER']);}
 const laps=packet.roots.filter(n=>n.kind==='DIAGNOSTIC_RACE_LEVEL_LAP_WITNESS'&&row(hist.find(e=>e.eventId===n.payload.eventId),horse));
 for(const n of laps)partial('RANK19','STORED_RACE_LEVEL_LAP_SEGMENTS',n.payload,[n.id],['NO_INDIVIDUAL_SECTIONALS_OR_LOAD']);
 const paths=[];for(const mode of ['FORWARD','OTHER']){const rs=ordinal.filter(z=>role(z)===mode);if(!rs.length)continue;paths.push({mode,win:rs.filter(z=>z.finish===1).map(clean),place:rs.filter(z=>z.finish<=3).map(clean),counter:rs.filter(z=>z.finish>3).map(clean),refs:close(refs(rs.map(z=>z.refs))),gradeEligible:false,scope:'REPORTED_HISTORICAL_RESPONSE_NOT_CURRENT_PATH'});}
 const feedback=[];
 if(eyeEnabled){
  const recovery=ordinal.filter(z=>z.positions.some((n,i)=>i>0&&n>z.positions[0])&&z.finish<Math.max(...z.positions));
  if(recovery.length){const good=recovery.filter(z=>z.finish<=3),counter=recovery.filter(z=>z.finish>3),ev=refs(recovery.map(z=>z.refs),fieldRefs);
   const f=partial('EYE03','PARTIAL_REPORTED_RECOVERY_WITH_COUNTERS',{support:good.map(clean),counter:counter.map(clean)},ev,['UNLABELED_ORDINAL_NOT_INDEPENDENT_CORNER_PROOF']);
   const q=partial('RANK74','EYE03_PARTIAL_RESPONSE_REANALYSIS',{eyeId:f.id,support:good.map(clean),counter:counter.map(clean),currentSuitability:'HELD'},ev,['NO_GRADE_FEEDBACK']);
   const path={mode:'EYE03_REPORTED_RECOVERY',win:good.filter(z=>z.finish===1).map(clean),place:good.map(clean),counter:counter.map(clean),refs:q.refs,gradeEligible:false,scope:'REPORTED_HISTORICAL_RESPONSE_NOT_CURRENT_PATH'};paths.push(path);feedback.push({eye:'EYE03',target:'RANK74',eyeId:f.id,findingId:q.id,refs:q.refs,gradeEligible:false});
  }
 }
 if(wins.length)partial('RANK100','PARTIAL_PRIOR_WIN_RESPONSES_CURRENT_HELD',paths.filter(q=>q.win.length),refs(paths.filter(q=>q.win.length).map(q=>q.refs)));
 if(places.length)partial('RANK99','PARTIAL_PRIOR_PLACE_RESPONSES_CURRENT_HELD',paths.filter(q=>q.place.length),refs(paths.filter(q=>q.place.length).map(q=>q.refs)));
 const axes=[{axis:'A',state:all.length?'PARTIAL_REPORTED_PERFORMANCE':'HELD',wins:wins.length,place:places.length,counter:bad.length,refs:close(refsAll)},{axis:'B',state:exact.length?'PARTIAL_SAME_GOING':'HELD',events:exact.map(clean),refs:close(refs(exact.map(z=>z.refs)))},{axis:'C',state:direct.length||peer.length?'PARTIAL_RELATIVE_EVIDENCE':'HELD',direct,common,peer,laterTop3,refs:close(refs(direct.map(z=>z.refs),peer.map(z=>z.ref)))},{axis:'D',state:paths.length?'PARTIAL_HISTORICAL_RESPONSE':'HELD',paths,refs:close(refs(paths.map(z=>z.refs)))},{axis:'E',state:feedback.length?'PARTIAL_EYE_REANALYSIS':'HELD',feedback,refs:close(refs(feedback.map(z=>z.refs)))}];
 return {axes,paths,feedback,peerWitnesses:peer.length,lapWitnesses:laps.length,gradeEligible:false};
}
