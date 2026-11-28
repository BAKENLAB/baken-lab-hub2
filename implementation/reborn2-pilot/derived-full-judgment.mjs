// Executable full judgment computation, extracted from fixed V43 generic
// used by V48 FINAL. Upstream real observation admission is not implemented.
// Existing fixture contexts ONLY in this development exercise; the original
// computational functions and scope labels are preserved. No native claims.
import assert from 'node:assert/strict';
import {candidateV48} from '../../research/reborn2-chatgpt-circuit/work42-v48-candidate.mjs';
import {refineV47} from '../../research/reborn2-chatgpt-circuit/work42-v47-judgment.mjs';
import {refineV46} from '../../research/reborn2-chatgpt-circuit/work42-v46-semantic.mjs';
const uniq=x=>[...new Set(x)].sort(), eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(o,keys)=>assert.deepEqual(Object.keys(o).sort(),[...keys].sort());
const id=h=>h.split('|').at(-1);
const safeInt=Number.isSafeInteger;
const states=['SUPPORT','COUNTER','MIXED','UNKNOWN','NOT_APPLICABLE'];
const axis=(axis,support,counter,unknown)=>({axis,state:support.length?counter.length?'MIXED':'SUPPORT':counter.length?'COUNTER':'UNKNOWN',support,counter,unknown});

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

export function computeFullJudgment({common,decision,docs,packet,adapted,work42}){
 assert.ok(work42);
 assert.equal(common.source_digest,decision.digest);
 assert.equal(common.groups,118);assert.equal(common.held,826);
 let runners=synthesize(common,decision,docs,packet,adapted);
 runners=refineV46(common,decision,docs,packet,runners,work42.returns);
 runners=refineV47(common,decision,docs,packet,runners,work42.returns);
 assert.ok(runners.every(h=>h.itemConsumption.length===115));
 const candidate=candidateV48(docs,packet,runners,decision);
 return {runners,candidate};
}
