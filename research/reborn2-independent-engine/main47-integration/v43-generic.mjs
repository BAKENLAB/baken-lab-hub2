// V43: research-only, verified synthetic input. No official intake or production.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareSupply,compileReturn} from '../../reborn2-work42/codex-contract-v0.4.mjs';
import {loadV40} from '../../reborn2-chatgpt-circuit/work36-v40-integrated.mjs';
import {analyze} from '../../reborn2-chatgpt-circuit/work36-v41-local-decision.mjs';
import {integrate} from '../../reborn2-chatgpt-circuit/work36-v42-propagation.mjs';
import {run31,pipeline31,verifier31} from '../../reborn2-chatgpt-circuit/work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const uniq=x=>[...new Set(x)].sort(), eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(o,keys)=>assert.deepEqual(Object.keys(o).sort(),[...keys].sort());
const id=h=>h.split('|').at(-1);
const safeInt=Number.isSafeInteger;
const states=['SUPPORT','COUNTER','MIXED','UNKNOWN','NOT_APPLICABLE'];
const axis=(axis,support,counter,unknown)=>({axis,state:support.length?counter.length?'MIXED':'SUPPORT':counter.length?'COUNTER':'UNKNOWN',support,counter,unknown});
function validateClock(d){
 if(d.kind==='TARGET_CARD')return;
 const g=d.geometry?.checkpoints_m,rows=d.rows,u=d.precisionMs;
 // Missingness can remain in the verified historical analysis; contradictions
 // of reported complete clocks are rejected, not silently normalized.
 assert.ok(safeInt(u)&&u>0);
 if(!Array.isArray(g))return;
 assert.ok(g.every((m,i)=>safeInt(m)&&m>0&&m<d.distanceM&&(!i||m>g[i-1])));
 const finished=rows.filter(r=>['FINISHED','DEAD_HEAT'].includes(r.status));
 for(const row of finished){
  if(row.checkpointMs!=null){
   assert.equal(row.checkpointMs.length,g.length);
   assert.ok(row.checkpointMs.every((v,i,a)=>safeInt(v)&&v>(a[i-1]??0)));
   if(row.clockMs!=null)assert.ok(row.clockMs>row.checkpointMs.at(-1));
   const k=g.indexOf(d.distanceM-600);
   if(k>=0&&row.clockMs!=null&&row.final600Ms!=null)
    assert.equal(row.clockMs-row.checkpointMs[k],row.final600Ms,'FINAL600_CLOCK_CONFLICT');
  }
 }
 // Even in a partially observed field, known pair clock/rank orders
 // cannot contradict one another. Do not infer ranks for missing horses.
 for(const [i,a] of finished.entries())for(const b of finished.slice(i+1)){
  if([a.clockMs,b.clockMs,a.finish,b.finish].every(safeInt))assert.equal(Math.sign(a.clockMs-b.clockMs),Math.sign(a.finish-b.finish),'KNOWN_PAIR_FINISH_CONFLICT');
  for(let k=0;k<g.length;k++)if([a.checkpointMs?.[k],b.checkpointMs?.[k],a.checkpointRanks?.[k],b.checkpointRanks?.[k]].every(safeInt))
   assert.equal(Math.sign(a.checkpointMs[k]-b.checkpointMs[k]),Math.sign(a.checkpointRanks[k]-b.checkpointRanks[k]),'KNOWN_PAIR_CHECKPOINT_CONFLICT');
 }
 const complete=finished.length===d.actualStarters&&finished.every(r=>safeInt(r.clockMs)&&Array.isArray(r.checkpointMs)&&r.checkpointMs.length===g.length);
 if(!complete)return;
 const l=d.leaderLaps;
 if(l!=null){
  assert.deepEqual(l.boundariesM,[0,...g,d.distanceM]);
  assert.equal(l.valuesMs.length,g.length+1);
  let clock=0;
  for(const [i,v] of l.valuesMs.entries()){
   assert.ok(safeInt(v)&&v>0);clock+=v;
   assert.equal(clock,Math.min(...finished.map(r=>i===g.length?r.clockMs:r.checkpointMs[i])),'LEADER_CLOCK_CONFLICT');
  }
 }
 for(const r of finished){
  if(r.finish!=null)assert.equal(r.finish,1+finished.filter(q=>q.clockMs<r.clockMs).length,'FINISH_CLOCK_CONFLICT');
  if(r.checkpointRanks!=null)assert.deepEqual(r.checkpointRanks,r.checkpointMs.map((v,i)=>1+finished.filter(q=>q.checkpointMs[i]<v).length),'CHECKPOINT_RANK_CONFLICT');
 }
}
// Trusted receipt is a separate caller-controlled authority. This module
// cannot establish who authorized that receipt. Do not pass user-submitted
// pins as trusted custody. Stage31 synthetic clock epoch is deliberately retained.
export function verifyIntake(V,request,receipt){
 exact(request,['id','bundleText','envelope']);
 assert.ok(typeof request.id==='string'&&request.id.length>0);
 assert.equal(receipt.id,request.id);
 assert.equal(sha(request.bundleText),receipt.bundle_sha256,'INDEPENDENT_BUNDLE_PIN');
 assert.equal(request.envelope.digest,receipt.source_digest,'INDEPENDENT_PACKET_PIN');
 assert.equal(sha(JSON.stringify(request.envelope.packet)),receipt.source_digest);
 const b=JSON.parse(request.bundleText);
 exact(b,['scope','canonical','cases']);
 assert.equal(b.scope,'SYNTHETIC_ONLY');
 assert.deepEqual(b.canonical,V.C.canonical);
 assert.equal(b.cases.length,1);
 const q=b.cases[0];exact(q,['n','input','registry','expectedDigest']);
 assert.equal(q.n,request.id);assert.equal(q.expectedDigest,receipt.source_digest);
 const v=V.C.verify32(request.bundleText,request.id,request.envelope,sha,pipeline31,verifier31,receipt.bundle_sha256);
 assert.equal(v.state,'VERIFIED_SYNTHETIC_ENVELOPE',v.reason);
 // Parse only verified bytes. No caller-supplied observation layer or result.
 const docs=q.input.documents.map(d=>{
  assert.ok(d.bytes.every(x=>safeInt(x)&&x>=0&&x<128));
  const raw=Buffer.from(d.bytes);assert.equal(sha(raw),d.digest);
  return JSON.parse(raw.toString('utf8'));
 });
 const card=docs[0];
 assert.equal(card.kind,'TARGET_CARD');
 assert.equal(docs.filter(d=>d.kind==='TARGET_CARD').length,1);
 assert.equal(new Set(docs.map(d=>d.eventId)).size,docs.length);
 assert.ok(docs.every(d=>d.issuer===card.issuer));
 for(const d of docs){assert.ok(safeInt(d.publishedAt)&&safeInt(d.updatedAt)&&d.publishedAt<=d.updatedAt&&d.updatedAt<=q.input.manifest.cutoff);
  if(d!==card){assert.equal(d.kind,'HISTORICAL_RESULT');assert.ok(safeInt(d.eventAt)&&d.eventAt<d.publishedAt&&d.eventId!==card.eventId);}
  validateClock(d);
 }
 // Existing common engine regenerates the exact native synthetic registry.
 // Reject valid-but-incompatible contracts rather than replacing their custody.
 const replay=run31(docs,V.C.canonical,sha);
 assert.equal(replay.out.state,'TEST_PACKET');
 assert.deepEqual(replay.input,q.input,'NATIVE_INPUT_INCOMPATIBLE');
 assert.deepEqual(replay.registry,q.registry,'NATIVE_REGISTRY_INCOMPATIBLE');
 assert.deepEqual(replay.out,request.envelope,'NATIVE_PACKET_INCOMPATIBLE');
 assert.equal(replay.out.packet.evidence.length,receipt.evidence);
 const pin={...receipt,itemRows:card.rows.length*115,blob:receipt.blob??receipt.bundle_sha256};
 const W={...V,C:{...V.C,fixtures:[{id:request.id,docs}],receipt:{summary:[pin]},genericNoTemplates:true},fixed:new Map([[request.id,{raw:{raw:docs},pin}]])};
 const adapted=V.C.adapt32(v,sha);
 return {W,docs,packet:replay.out.packet,adapted};
}
// Independent accepted fixture receipt, not a new self-issued admission.
// The generic verifier never invokes this helper on untrusted supplied data.
export function acceptedRequest(V,name){
 const f=V.C.fixtures.find(f=>f.id===name),pin=V.fixed.get(name)?.pin;
 assert.ok(f&&pin);
 const {input,registry,out}=run31(f.docs,V.C.canonical,sha);
 const bundleText=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:V.C.canonical,cases:[{n:name,input,registry,expectedDigest:out.digest}]})+'\n';
 return {request:{id:name,bundleText,envelope:out},receipt:pin};
}
function lineage(packet,adapted,ids){
 const map=new Map(packet.evidence.map(e=>[e.evidenceId,e])),aliases=new Map(adapted.o.evidence.map(e=>[e.evidence_id,e])),seen=new Set(),roots=new Map(),unresolved=new Set();
 function visit(i){if(seen.has(i))return;seen.add(i);const e=map.get(i);if(!e){const a=aliases.get(i);if(a){for(const d of a.depends_on)visit(d);}else unresolved.add(i);return;}roots.set(e.root,{id:e.evidenceId,root:e.root,event:e.event,subject:e.subject,field:e.field});for(const d of e.dependencies)visit(d);}
 for(const i of ids)visit(i);
 return {roots:[...roots.values()].sort((a,b)=>a.root.localeCompare(b.root)),unresolved:[...unresolved].sort()};
}
function factsFor(x,docs,h){
 const card=docs[0],history=x.history_v41;
 // Entire observed field vector, not independent pair choices. All reported
 // same-context historical alternatives are retained, including held ones.
 const scenarios=history.map(s=>{
  const d=docs.find(d=>d.eventId===id(s.event)),k=d.geometry?.checkpoints_m?.indexOf(s.checkpoint)??-1;
  const field=card.rows.filter(r=>r.status!=='CANCELLED').map(r=>{
   const p=d.rows.find(v=>v.nativeId===r.nativeId);
   return {horse:card.issuer+'|'+r.nativeId,gate:r.gate,weightG:r.weightG,rank:k>=0?p?.checkpointRanks?.[k]??null:null,elapsed:k>=0?p?.checkpointMs?.[k]??null:null};
  });
  const min=Math.min(...field.filter(v=>Number.isFinite(v.elapsed)).map(v=>v.elapsed));
  const spread=field.every(v=>Number.isFinite(v.elapsed))?Math.max(...field.map(v=>v.elapsed))-min:null;
  const overlap=field.filter(v=>Number.isFinite(v.elapsed)&&v.elapsed-min<=2*d.precisionMs).map(v=>v.horse);
  const matched=s.sourceValid&&s.rosterMatched&&s.shared.every(q=>q.state==='MATCHED')&&!s.fieldChanged.length&&field.every(v=>Number.isFinite(v.elapsed))&&x.roster.known_active.length===field.length;
  const refs=uniq(s.edges.flatMap(e=>e.refs));
  return {event:s.event,checkpoint:s.checkpoint,remaining:s.distance-s.checkpoint,field,spread_ms:spread,leaderClockOverlap:overlap,leader:s.leader,
   historicalClass:d.conditions?.class_label??null,currentClass:card.conditions?.class_label??null,
   scope:matched?'REPORTED_CONTEXT_MATCHED_POSSIBLE_ROLE_VECTOR':'HISTORICAL_ONLY_OR_INCOMPLETE',refs};
 });
 const own=h.paths;
 const matching=f=>scenarios.some(s=>s.event===f.start&&s.checkpoint===f.checkpoint&&s.scope==='REPORTED_CONTEXT_MATCHED_POSSIBLE_ROLE_VECTOR');
 // Current strength cannot be inferred from class label alone. The same-rival
 // field comparison is meaningful, but no extrapolation to a stronger field.
 const compatible=own.filter(p=>p.full&&matching(p));
 const support=compatible.filter(p=>p.decision==='CONDITIONAL_WIN');
 const placing=compatible.filter(p=>['CONDITIONAL_WIN','CONDITIONAL_PLACE'].includes(p.decision));
 const counter=compatible.filter(p=>p.decision==='CONDITIONAL_COUNTER');
 return {scenarios,compatible,support,placing,counter,matchedStarts:scenarios.filter(s=>s.scope==='REPORTED_CONTEXT_MATCHED_POSSIBLE_ROLE_VECTOR')};
}
// The actual shared EYE feedback has re-run the field solver using the range of
// every comparable response, including adverse observations. Consume the new
// envelope as a sensitivity/counter review, never as another independent vote.
function feedbackFor(x,h){
 return (x.feedback??[]).filter(f=>f.subject===h.horse).map(f=>{
  const e=f.after.edges.find(e=>[e.a,e.b].includes(h.horse)&&[e.a,e.b].includes(f.rival));
  const orient=z=>!z?null:e.a===h.horse?z:[-z[1],-z[0]];
  const bounds=orient(e?.interval_ms);
  const before=f.before.envelope,after=f.after.envelope;
  const events=uniq((e?.observations??[]).map(o=>o.event));
  const state=bounds&&bounds[0]>0?'RECOVERY_ROBUST_IN_OBSERVED_RESPONSE_RANGE':bounds&&bounds[1]<0?'RECOVERY_COUNTERED_IN_OBSERVED_RESPONSE_RANGE':'RECOVERY_NOT_ROBUST_IN_OBSERVED_RESPONSE_RANGE';
  return {id:f.id,rival:f.rival,checkpoint:f.checkpoint_m,start:f.before.event,before:before?[before.min,before.max]:null,after:after?[after.min,after.max]:null,bounds,events,state,
   refs:uniq([...f.refs,...f.counter_refs]),independent_vote:false,scope:'RECOMPUTED_OUTER_BOUND_NOT_CURRENT_FORECAST'};
 });
}
function synthesize(x,z,docs,packet,adapted){
 const threshold=z.threshold;
 return z.runners.map(h=>{
  const f=factsFor(x,docs,h),feedback=feedbackFor(x,h);
  const routes=f.compatible.map(p=>{
   const relevant=feedback.filter(q=>q.start===p.start+'@'+p.checkpoint&&q.checkpoint===p.checkpoint);
   const robust=relevant.filter(q=>q.state==='RECOVERY_ROBUST_IN_OBSERVED_RESPONSE_RANGE');
   const fragile=relevant.filter(q=>q.state!=='RECOVERY_ROBUST_IN_OBSERVED_RESPONSE_RANGE');
   const review=fragile.length?'SENSITIVITY_COUNTER_OR_UNRESOLVED':robust.length?'RECOVERY_RANGE_SUPPORTED':'NO_ADDITIONAL_RANGE_REVIEW';
   // Does not delete a mathematically feasible win. A robust claim about a
   // recovery-dependent route cannot survive a demonstrated counter-range.
   const recoveryDependent=p.own.some(e=>e.recovered&&fragile.some(q=>q.rival===e.rival));
   const refs=uniq(p.axes.flatMap(a=>a.refs)),proof=lineage(packet,adapted,refs);
   // A measured cross-event response can support a conditional win even if
   // the response race was a defeat. The start vector and response intervals,
   // not the historical placing, are the claim premises.
   const historyReplay=h.paths.find(q=>q.replay&&q.response===p.response&&q.checkpoint===p.checkpoint);
   const materialUnknown=proof.unresolved.length>0||proof.roots.length===0;
   const claimSupport=p.decision==='HELD'?'HELD_ENGINE_PREMISE':recoveryDependent?'HELD_RECOVERY_COUNTER':materialUnknown?'HELD_SOURCE_LINEAGE':'VERIFIED_CONDITIONAL_ROUTE';
   return {id:p.id,start:p.start,response:p.response,checkpoint:p.checkpoint,remaining:p.remaining,decision:p.decision,
    review,robustClaim:p.decision==='CONDITIONAL_WIN'&&!recoveryDependent&&!materialUnknown&&robust.length>0,
    materialCounter:recoveryDependent,materialUnknown,claimSupport,unresolvedRouteLineage:proof.unresolved,
    historicalReplayDecision:historyReplay?.decision??null,historicalWinRequired:false,
    feedback:relevant,refs};
  });
  const A=axis('A',f.placing.map(p=>({route:p.id,measured:p.own,refs:p.axes[0].refs})),f.counter.map(p=>({route:p.id,measured:p.own,refs:p.axes[0].refs})),['NO_INDEPENDENT_CURRENT_FORM_MEASUREMENT']);
  const B=axis('B',f.scenarios.filter(s=>s.scope==='REPORTED_CONTEXT_MATCHED_POSSIBLE_ROLE_VECTOR'),[],['CURRENT_ROLE_AND_PACE_NOT_OBSERVED','CURRENT_PHYSICAL_FORM_UNVERIFIED']);
  const C=axis('C',f.placing.map(p=>({route:p.id,envelope:p.field,refs:p.axes[2].refs})),f.counter.map(p=>({route:p.id,envelope:p.field,refs:p.axes[2].refs})),['CLASS_LABEL_NOT_INDEPENDENT_STRENGTH']);
  const D=axis('D',f.placing.flatMap(p=>p.own.filter(e=>e.recovered||e.retained).map(e=>({route:p.id,...e}))),f.counter.flatMap(p=>p.own.filter(e=>e.lost).map(e=>({route:p.id,...e}))),['POSITION_NOT_PHYSIOLOGICAL_LOAD']);
  const E=axis('E',feedback.filter(q=>q.state==='RECOVERY_ROBUST_IN_OBSERVED_RESPONSE_RANGE'),feedback.filter(q=>q.state!=='RECOVERY_ROBUST_IN_OBSERVED_RESPONSE_RANGE'),feedback.length?[]:['NO_ADDITIONAL_RANGE_DISCOVERY']);
  const axes=[A,B,C,D,E];
  assert.ok(axes.every(a=>states.includes(a.state)));
  const used=uniq([...routes.flatMap(p=>p.refs),...feedback.flatMap(q=>q.refs),...f.scenarios.flatMap(s=>s.refs)]);
  const audit=lineage(packet,adapted,used),rootGroups=audit.roots;
  // Current-card-anchored conditional RESEARCH candidate, not actual current
  // grade. A comparison class label alone is not an external strength index;
  // these decisions require direct same-field historical counterpart evidence.
  const currentUnknown=['CURRENT_FORM_NOT_DIRECTLY_OBSERVED','CURRENT_SCENARIO_COVERAGE_BEYOND_RECORDED_ANTECEDENTS','INDEPENDENT_OPPONENT_STRENGTH'];
  const win=routes.filter(p=>p.decision==='CONDITIONAL_WIN'&&p.start!==p.response);
  const place=routes.filter(p=>['CONDITIONAL_WIN','CONDITIONAL_PLACE'].includes(p.decision)&&p.start!==p.response);
  const negative=routes.filter(p=>p.decision==='CONDITIONAL_COUNTER');
  const replay=f.compatible.filter(p=>p.replay);
  const replayWin=replay.filter(p=>p.decision==='CONDITIONAL_WIN'),replayPlace=replay.filter(p=>['CONDITIONAL_WIN','CONDITIONAL_PLACE'].includes(p.decision));
  // Replay is a diagnostic comparison, not a win or placing prerequisite.
  // Independent start/response event vectors and existing full-field bounds
  // must support the route, with its own material counter/lineage reviewed.
  const directWin=win.filter(p=>p.claimSupport==='VERIFIED_CONDITIONAL_ROUTE');
  const directPlace=place.filter(p=>p.claimSupport==='VERIFIED_CONDITIONAL_ROUTE');
  // Review each observed early role/pace situation rather than count wins.
  // Same event across checkpoints is one antecedent.
  const firstStarts=f.matchedStarts.filter(s=>s.checkpoint===Math.min(...f.matchedStarts.filter(q=>q.event===s.event).map(q=>q.checkpoint)));
  const startReviews=firstStarts.map(s=>{
   const alternatives=routes.filter(p=>p.start===s.event);
   const supported=alternatives.filter(p=>['CONDITIONAL_WIN','CONDITIONAL_PLACE'].includes(p.decision)&&p.claimSupport==='VERIFIED_CONDITIONAL_ROUTE');
   const bad=alternatives.filter(p=>p.decision==='CONDITIONAL_COUNTER'||p.materialCounter);
   const unresolved=!alternatives.length||alternatives.some(p=>p.claimSupport!=='VERIFIED_CONDITIONAL_ROUTE');
   return {event:s.event,role:s.leaderClockOverlap.length>1?'CLOCK_OVERLAP':'CLOCK_SEPARATED',supported:supported.map(p=>p.id),counter:bad.map(p=>p.id),unresolved,refs:s.refs};
  });
  const sourceComplete=f.scenarios.length>0&&f.scenarios.every(s=>s.scope==='REPORTED_CONTEXT_MATCHED_POSSIBLE_ROLE_VECTOR')&&x.roster.known_active.length===x.roster.possible_active.length;
  const roleWin=new Set(directWin.map(p=>startReviews.find(q=>q.event===p.start)?.role).filter(Boolean));
  const allObservedCompetitive=startReviews.length>0&&startReviews.every(q=>q.supported.length&&!q.counter.length&&!q.unresolved);
    // S requires distinct role contexts with a supported response, and
  // no materially adverse observed role. This is a provisional strict rule,
  // not an approved policy. Multiple horses may satisfy it independently.
  const S=sourceComplete&&allObservedCompetitive&&roleWin.has('CLOCK_OVERLAP')&&roleWin.has('CLOCK_SEPARATED')&&!routes.some(p=>p.materialCounter);
  const Aok=directWin.length>0;
  const Bok=directPlace.length>0;
  const allObservedAdverse=sourceComplete&&startReviews.length>0&&startReviews.every(q=>q.counter.length&&!q.supported.length&&!q.unresolved)&&replay.length>0&&replay.every(p=>p.decision==='CONDITIONAL_COUNTER')&&routes.length>0&&routes.every(p=>p.decision==='CONDITIONAL_COUNTER');
  const candidate=S?'S':Aok?'A':Bok?'B':allObservedAdverse?'C':null;
  const gradeReasons={S:S?'DISTINCT_SUPPORTED_ROLE_CONTEXTS_WITH_NO_OBSERVED_MATERIAL_COUNTER':'STRONG_MULTI_CONTEXT_SUPPORT_NOT_ESTABLISHED',A:Aok?'VERIFIED_NONREPLAY_WIN_ROUTE_WITH_REVIEWED_PREMISES':'NO_CORROBORATED_NONREPLAY_WIN_PATH',B:Bok?'VERIFIED_NONREPLAY_PLACE_ROUTE_WITH_REVIEWED_PREMISES':'NO_CORROBORATED_NONREPLAY_PLACE_PATH',C:allObservedAdverse?'ALL_ADMISSIBLE_RECORDED_CONTEXTS_SHOW_RELATIVE_DISADVANTAGE':'CURRENT_DISADVANTAGE_NOT_ESTABLISHED_OR_SCOPE_INCOMPLETE'};
  const itemConsumption=h.items.map(i=>({item:i.item,base:i.state,semantic:i.v33_findings??[],routeFacts:i.v42?.routeFacts??[],conditionFacts:i.v42?.changed??[],eye:i.v42?.effects??[],scope:'EXISTING_COMMON_ANALYSIS_NOT_ALL_ITEMS_PROVEN'}));
  return {horse:h.horse,axes,paths:routes,feedback,grade:null,current_grade:null,research_grade:candidate,assessment:candidate?'CURRENT_CARD_ANCHORED_CONDITIONAL_RESEARCH':'UNASSESSED_CURRENT',gradeReasons,currentUnknown,rootGroups,unresolvedLineage:audit.unresolved,itemConsumption,startReviews,sourceComplete,
    routeDecisionPolicy:'V44_ROUTE_PREMISE_REVIEW_NOT_HISTORICAL_WIN_GATE',
    acceptedWinRoutes:directWin.map(p=>p.id),acceptedPlaceRoutes:directPlace.map(p=>p.id),formal:false,
   summary:{win:win.length,place:place.length,counter:negative.length,held:h.paths.filter(p=>p.decision==='HELD').length,robust:routes.filter(p=>p.robustClaim).length,materialCounter:routes.filter(p=>p.materialCounter).length}};
 });
}
export async function analyzeVerified(V,request,receipt,{eyeEnabled=true,work42Envelope=null,work42Selection=null}={}){
 const {W,docs,packet,adapted}=verifyIntake(V,request,receipt);
 let work42=null;
 if(work42Envelope!==null){
  const p=await prepareSupply(work42Envelope,{id:request.id});
  // Source bytes and common packet must match the independently supplied
  // V43 receipt, not the self-replay receipt alone. Work42 capture is fixed
  // synthetic metadata, not independent real-world provenance.
  assert.deepEqual(p.request,request,'WORK42_REQUEST_MISMATCH');
  assert.equal(p.receipt.source_digest,receipt.source_digest);
  assert.equal(p.receipt.bundle_sha256,receipt.bundle_sha256);
  if(receipt.work42_analysis_sha256)assert.equal(p.supply.analysisSha256,receipt.work42_analysis_sha256,'WORK42_ANALYSIS_PIN');
  const map=Object.fromEntries(p.supply.runners.map(h=>{
   const ids=eyeEnabled?(work42Selection===null?h.categories.flatMap(c=>c.claims.map(q=>q.claim_id)):work42Selection[h.horse_id]??[]):[];
   return [h.horse_id,compileReturn(p.supply,h.horse_id,ids)];
  }));
  W.C.work42Return=map;
  work42={sourceDigest:p.supply.commonSha256,analysisSha256:p.supply.analysisSha256,scope:'VERIFIED_COMMON_BYTES_SYNTHETIC_METADATA',returns:map,missing:p.supply.missing,semanticCategories:['EYE03'],otherCategories:'ROUTED_NOT_YET_SEMANTICALLY_CONSUMED',formal:false};
 }
 const common=analyze(W,request.id,{eyeEnabled});
 const decision=integrate(common,docs,{eyeEnabled});
 assert.equal(decision.digest,receipt.source_digest);
 assert.equal(common.groups,118);assert.equal(common.held,826);
 const runners=synthesize(common,decision,docs,packet,adapted);
 assert.ok(runners.every(h=>h.itemConsumption.length===115));
 return {schema:'V43_VERIFIED_SYNTHETIC_RESEARCH_V1',id:request.id,...(work42?{work42}:{}),digest:decision.digest,evidence:packet.evidence.length,groups:common.groups,held:common.held,roster:common.roster,placeThreshold:decision.threshold,thresholdScope:'SYNTHETIC_FIXTURE_CONTROL_NOT_CANONICAL',runners,formal:false};
}
export {loadV40};
