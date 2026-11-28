// NORMAL v0.2 candidate. Ordinary-material transfer, explicit uncertainty.
// Pure computation is not source authorization or production grade authority.
import assert from 'node:assert/strict';
import {sha} from './adapter.mjs';
export const VERSION='REBORN2_NORMAL_CANDIDATE_0.2';
const unique=a=>[...new Set(a)].sort(),finite=Number.isFinite;
const distinct=a=>new Set(a.map(x=>x.event)).size>=2;
const ordinal=s=>typeof s==='string'&&/^\d{1,2}(?:,\d{1,2})+$/.test(s)?s.split(',').map(Number):null;
const keys=['surfaceLiteral','distanceM','goingLiteral','directionLiteral','classLiteral'];
export function analyzeNormalContext(packet,roster,base,{fixture=false,eyeEnabled=true}={}){
 const expected=fixture?'FIXED_FIXTURE_GRAPH_ONLY':'NATIVE_PARTIAL_GRAPH_VERIFIED',state=fixture?'OBSERVED_TEST_FORMAT':'OBSERVED_NATIVE_VERIFIED';
 assert.equal(packet.scope,expected);
 const nodes=new Map(packet.roots.map(n=>[n.id,n]));assert.equal(nodes.size,packet.roots.length);
 for(const n of nodes.values()){assert.equal(n.id,sha([n.kind,n.payload,n.depends]),'NORMAL_ROOT_DIGEST');assert.ok(n.kind.startsWith(fixture?'FIXTURE_':'NATIVE_'),'NORMAL_ROOT_DOMAIN');}
 const close=ids=>{const seen=new Set(),stack=new Set();function visit(id){assert.ok(!stack.has(id),'NORMAL_ROOT_CYCLE');if(seen.has(id))return;const n=nodes.get(id);assert.ok(n,'NORMAL_ROOT_MISSING');stack.add(id);n.depends.forEach(visit);stack.delete(id);seen.add(id);}ids.forEach(visit);return unique([...seen]);};
 const o=(x,k)=>x?.observations?.[k]?.state===state?x.observations[k]:null;
 const v=(x,k)=>o(x,k)?.value??null;
 const refs=(...xs)=>unique(xs.flat(Infinity).filter(Boolean).map(x=>typeof x==='string'?x:x.evidenceId));
 const card=packet.events.find(e=>e.role==='TARGET_CARD'),hist=packet.events.filter(e=>e.role==='HISTORICAL_RESULT');
 const row=(e,h)=>e.rows.find(r=>r.nativeId===h);
 assert.ok(card&&card.eventId===packet.target.eventId);
 assert.deepEqual(unique(card.rows.map(r=>r.nativeId)),unique(roster.map(h=>h.horseId)),'NORMAL_ROSTER');
 assert.equal(card.rows.length,roster.length);
 // Bind every consumed observed field to the issued observation node, not
 // merely a self-hashed caller record. Row identity has its own witness.
 for(const e of packet.events){
  const er=nodes.get(e.eventRoot);assert.ok(er?.kind.endsWith('_EVENT_IDENTITY')&&er.payload.id===e.eventId,'NORMAL_EVENT_ROOT');
  for(const [subject,x] of [[null,e],...e.rows.map(r=>[r.nativeId,r])])for(const [k,f] of Object.entries(x.observations)){
   if(f.state!==state)continue;const n=nodes.get(f.evidenceId);assert.ok(n,'NORMAL_OBSERVATION_ROOT');
   if(k==='no'){assert.equal(n.payload.eventId,e.eventId);assert.equal(n.payload.horseId,subject);assert.equal(n.payload.horseNo,f.value);}
   else{assert.ok(n.kind.endsWith('_OBSERVATION'));assert.equal(n.payload.eventId,e.eventId);assert.equal(n.payload.horseId,subject);assert.equal(n.payload.field,k);assert.equal(n.payload.state,'OBSERVED');assert.deepEqual(n.payload.value,f.value);}
   close([f.evidenceId]);
  }
 }
 const context=e=>Object.fromEntries(keys.map(k=>[k,v(e,k)]));
 // Provisional transfer family: same surface, exact distance, literal class.
 // Different going/venue/direction allowed only as explicit conditional
 // variation, not proof of class equivalence or causal aptitude. Unknown
 // essential fields are held. No arbitrary numeric ability score.
 function compare(a,b){
  const x=context(a),y=context(b),missing=keys.filter(k=>x[k]==null||y[k]==null),diff=keys.filter(k=>x[k]!=null&&y[k]!=null&&x[k]!==y[k]);
  if(a.nativeRaceIdentity.venueId!==b.nativeRaceIdentity.venueId)diff.push('venue');
  const sameCore=['surfaceLiteral','distanceM','classLiteral'].every(k=>x[k]!=null&&x[k]===y[k]);
  return {kind:missing.length?'INCOMPLETE':!sameCore?'OUTSIDE_FAMILY':diff.length?'CONDITIONAL_VARIATION':'EXACT_REPORTED',missing,diff,refs:refs(a.eventRoot,b.eventRoot,keys.flatMap(k=>[o(a,k),o(b,k)]))};
 }
 const comparable=c=>['EXACT_REPORTED','CONDITIONAL_VARIATION'].includes(c.kind);
 // Work11 contract: the source pointer must explicitly record cornerLabels;
 // no guessed numbering from a string length. Existing frozen measured
 // fixtures can exercise the ordinal math with a DISTINCT distance convention,
 // not masquerading as corners or real races.
 function position(e,r){
  const f=o(r,'cornerPositionsLiteral')??(fixture?o(r,'fixtureCheckpointRanks'):null);if(!f)return null;
  const a=Array.isArray(f.value)&&fixture?f.value:ordinal(f.value);if(!a||a.length<2||a.some(n=>!Number.isInteger(n)||n<1||n>24))return null;
  const source=close([f.evidenceId]).map(id=>nodes.get(id)).filter(n=>n.kind.endsWith('_SOURCE_FIELD')&&n.payload.field===(Array.isArray(f.value)?'fixtureCheckpointRanks':'cornerPositionsLiteral'));
  const labels=source.map(n=>{try{const p=JSON.parse(n.payload.root.rowPointer);return Array.isArray(f.value)?p.fixtureCheckpointDistancesM:p.cornerLabels;}catch{return null;}});
  if(!labels.length||!labels.every(x=>Array.isArray(x)&&x.length===a.length&&x.every((n,i)=>Number.isInteger(n)&&n>=1&&(Array.isArray(f.value)||n<=4)&&(!i||n>x[i-1]))&&JSON.stringify(x)===JSON.stringify(labels[0])))return null;
  const count=v(e,'declaredCount');if(!finite(count)||count<4||a.some(n=>n>count))return null;
  return {positions:a,convention:(Array.isArray(f.value)?'FIXTURE_DISTANCE:':'CORNER:')+labels[0].join(','),role:a[0]<=3?'FORWARD':'OTHER',last:a.at(-1),refs:refs(f,o(e,'declaredCount'))};
 }
 const possible=roster.filter(h=>h.status!=='CANCELLED'&&h.status!=='EXCLUDED'),knownStatus=h=>v(row(card,h.horseId),'status')===h.status;
 const rosterBound=v(card,'declaredCount')===roster.length&&roster.every(h=>knownStatus(h)||h.status==='UNKNOWN');
 const profiles=new Map();
 const past=(e,h)=>{
  const r=row(e,h);if(!r)return null;const c=compare(card,e),finish=v(r,'finish'),count=v(e,'declaredCount'),p=position(e,r);
  const finishers=e.rows.filter(q=>finite(v(q,'finish'))),validFinish=finite(finish)&&finish>=1&&finite(count)&&finish<=count;
  const top3=validFinish&&count>3&&finishers.length>=4&&finish<=3;
  const nonplace=validFinish&&count>3&&finishers.length>=4&&finish>3;
  const rootRefs=refs(c.refs,o(r,'finish'),o(r,'no'),o(e,'declaredCount'),finishers.map(q=>o(q,'finish')),p?.refs);
  return {event:e.eventId,e,r,c,finish,count,validFinish,top3,nonplace,p,refs:rootRefs};
 };
 for(const h of possible)profiles.set(h.horseId,hist.map(e=>past(e,h.horseId)).filter(Boolean).filter(z=>comparable(z.c)));
 // A single documented role is a possibility, never an exclusive prediction.
 // Unknown roles remain in the field. Their uncertainty is not propagated
 // as blanket UNASSESSED to other horses.
 const field=possible.map(h=>{const p=profiles.get(h.horseId),observed=p.filter(z=>z.p&&z.validFinish);return {horse:h.horseId,status:h.status,roles:unique(observed.map(z=>z.p.role)),conventions:unique(observed.map(z=>z.p.convention)),refs:refs(o(row(card,h.horseId),'status'),o(row(card,h.horseId),'no'),observed.map(z=>z.refs)),events:observed.map(z=>z.event)};});
 const unresolved=field.filter(x=>x.status!=='ACTIVE'||!x.roles.length).map(x=>x.horse);
 const forwardMin=field.filter(x=>x.status==='ACTIVE'&&x.roles.length===1&&x.roles[0]==='FORWARD').length;
 // This is a range of observed-role candidates, not a physical pace forecast.
 const forwardMax=field.filter(x=>!x.roles.length||x.roles.includes('FORWARD')).length;
 const fieldRefs=close(refs(card.eventRoot,o(card,'declaredCount'),field.map(x=>x.refs)));
 const scenarios=['FORWARD','OTHER'].map(role=>({id:'ORDINAL_'+role,role,forwardCandidateRange:[forwardMin,forwardMax],unknownRivals:unresolved,refs:fieldRefs,scope:'CONDITIONAL_SUBJECT_ROLE_NOT_EXHAUSTIVE_FIELD_PACE'}));
 // Use historical rivals' PRIOR reported role histories, not their realized
 // first-three positions in this same race (that count is tautological).
 // Unknown prior roles widen the range; compare fractions across field sizes.
 // No inference from chronological order within a date.
 function composition(z){
  const e=z.e,rows=e.rows,count=v(e,'declaredCount'),subjectConvention=z.p?.convention;
  if(!subjectConvention||!Number.isInteger(count)||count!==rows.length||count<4)return {state:'HISTORICAL_FIELD_PROFILE_UNVERIFIED',range:null,refs:z.refs};
  const options=rows.map(r=>{
   const prior=hist.filter(q=>q.nativeRaceIdentity.dateJst<e.nativeRaceIdentity.dateJst&&compare(e,q).kind==='EXACT_REPORTED').map(q=>{const h=row(q,r.nativeId),p=h?position(q,h):null;return p?.convention===subjectConvention?p:null;}).filter(Boolean);
   return {horse:r.nativeId,roles:unique(prior.map(p=>p.role)),refs:refs(o(r,'no'),prior.map(p=>p.refs))};
  });
  const min=options.filter(q=>q.roles.length===1&&q.roles[0]==='FORWARD').length,max=options.filter(q=>!q.roles.length||q.roles.includes('FORWARD')).length;
  const unknown=options.filter(q=>!q.roles.length).map(q=>q.horse);
  const overlap=min*possible.length<=forwardMax*count&&forwardMin*count<=max*possible.length;
  return {state:unknown.length?'HISTORICAL_FIELD_PROFILE_UNVERIFIED':overlap?'REPORTED_ROLE_PROFILE_OVERLAP':'REPORTED_ROLE_PROFILE_NONOVERLAP',range:[min,max],fieldSize:count,unknown,refs:refs(z.refs,options.map(q=>q.refs))};
 }
 const result=base.runners.map(old=>{
  const horse=old.horse,h=roster.find(q=>q.horseId===horse),own=field.find(q=>q.horse===horse),runs=profiles.get(horse)??[];
  const items=new Map(old.items.map(i=>[i.item,{...i,findings:[...i.findings]}]));
  // Supersede old path/role/feedback semantics, not merely append a second
  // incompatible judgment. Keep observed facts and unrelated comparisons.
  for(const id of ['RANK01','RANK12','RANK13','RANK34','RANK36','RANK58','RANK60','RANK63','RANK65','RANK69','RANK70','RANK74','RANK95','RANK99','RANK100','EYE03','EYE07']){
   const i=items.get(id);i.findings=[];i.state='HELD';i.reason='NORMAL_V02_COMPARISON_NOT_ESTABLISHED';
  }
  if(!eyeEnabled){for(const i of items.values()){if(i.item.startsWith('EYE')){i.findings=[];i.state='HELD';i.reason='EYE_ABLATION_OFF';}else{i.findings=i.findings.filter(f=>!f.type.startsWith('EYE'));if(!i.findings.length){i.state='HELD';i.reason='EYE_ABLATION_OFF_OR_NO_MATERIAL';}}}}
  const emit=(id,type,value,rs,limits=[],s='DERIVED_COMPARISON')=>{
   const i=items.get(id);assert.ok(i&&['F','C'].includes(i.category));const direct=refs(rs);if(!direct.length)return null;
   const f={id:sha([VERSION,horse,id,type,value,direct]),item:id,type,value,directRefs:direct,refs:close(direct),limits,state:s,formal:false};i.findings.push(f);i.state=s;i.reason=null;return f;
  };
  const report=z=>({event:z.event,finish:z.finish,field:z.count,context:z.c.kind,differences:z.c.diff,role:z.p?.role??null,convention:z.p?.convention??null});
  const usable=runs.filter(z=>z.validFinish),wins=usable.filter(z=>z.finish===1),places=usable.filter(z=>z.top3),bad=usable.filter(z=>z.nonplace);
  if(usable.length){emit('RANK01','COMPARABLE_CONTEXT_RECORD',usable.map(report),usable.map(z=>z.refs),['CONDITIONAL_CONTEXT_TRANSFER']);emit('RANK12','REPORTED_WINS_AND_COUNTERS',{wins:wins.map(report),nonwins:usable.filter(z=>z.finish!==1).map(report)},usable.map(z=>z.refs));}
  if(distinct(usable))emit('RANK13','REPEATED_REPORTED_OUTCOMES',usable.map(report),usable.map(z=>z.refs));
  if(own?.roles.length){emit('RANK58','DOCUMENTED_ROLE_OPTIONS',own,own.refs,['NOT_ACTUAL_START']);if(own.events.length>=2)emit('RANK60','REPORTED_ROLE_HISTORY',own,own.refs);}
  emit('RANK63','FORWARD_ROLE_CANDIDATE_INTERVAL',{min:forwardMin,max:forwardMax,unknown:unresolved},fieldRefs,['NOT_ACTUAL_PACE_OR_PROBABILITY']);
  emit('RANK69','CONDITIONAL_ROLE_SCENARIOS',scenarios,fieldRefs,['NOT_EXHAUSTIVE'],'CONDITIONAL_HYPOTHESIS');
  // Rival evidence has two separate channels. Cross-event common opponent
  // comparisons require same reported surface/distance/class AND same
  // venue/going/direction between the two events; no transitive certainty.
  const comparisons=[],peerLevel=[];
  for(const rival of possible.filter(q=>q.horseId!==horse)){
   const rr=profiles.get(rival.horseId)??[],direct=[],common=[];
   for(const z of usable){
    const q=row(z.e,rival.horseId),f=v(q,'finish');if(finite(f))direct.push({event:z.event,order:z.finish<f?'SUPPORT':z.finish>f?'COUNTER':'NEUTRAL',refs:refs(z.refs,o(q,'finish'),o(q,'no'))});
    for(const rz of rr.filter(q=>q.validFinish&&q.event!==z.event&&compare(z.e,q.e).kind==='EXACT_REPORTED'))for(const p of z.e.rows.filter(p=>p.nativeId!==horse&&p.nativeId!==rival.horseId)){
     const p2=row(rz.e,p.nativeId),a=v(p,'finish'),bb=v(p2,'finish');if(!finite(a)||!finite(bb))continue;
     const left=Math.sign(a-z.finish),right=Math.sign(bb-rz.finish);
     const order=left>0&&right<0?'SUPPORT':left<0&&right>0?'COUNTER':'NEUTRAL';
     const val={events:[z.event,rz.event],rival:rival.horseId,peer:p.nativeId,ownFinish:z.finish,peerA:a,rivalFinish:rz.finish,peerB:bb,order,scope:'CONDITIONAL_COMMON_OPPONENT_NOT_TRANSITIVE'};
     const f=emit('RANK36','COMMON_OPPONENT_RELATIVE_RESPONSE',val,refs(z.refs,rz.refs,o(p,'finish'),o(p2,'finish'),o(p,'no'),o(p2,'no')),['NOT_A_DETERMINISTIC_ORDER']);common.push({...val,refs:f.refs});
    }
   }
   const all=[...direct,...common],s=all.some(q=>q.order==='SUPPORT'),c=all.some(q=>q.order==='COUNTER');
   comparisons.push({rival:rival.horseId,state:s&&c?'MIXED':s?'SUPPORT':c?'COUNTER':'HELD',direct,common,refs:refs(all.map(q=>q.refs))});
  }
  // Opponent level witness: a later observed top3 against at least four
  // reported finishers in the same family. No global class rating.
  for(const z of usable)for(const p of z.e.rows.filter(q=>q.nativeId!==horse&&finite(v(q,'finish'))))for(const e of hist.filter(e=>e.nativeRaceIdentity.dateJst>z.e.nativeRaceIdentity.dateJst&&compare(z.e,e).kind==='EXACT_REPORTED')){
   const later=past(e,p.nativeId);if(!later?.top3)continue;
   const f=emit('RANK34','OPPONENT_LATER_COMPARABLE_TOP3',{event:z.event,later:later.event,opponent:p.nativeId,subjectFinish:z.finish,opponentFinish:v(p,'finish'),laterFinish:later.finish},refs(z.refs,later.refs,o(p,'finish'),o(p,'no')),['NOT_GLOBAL_STRENGTH_OR_TRANSITIVE_ORDER']);peerLevel.push({event:z.event,opponent:p.nativeId,refs:f.refs});
  }
  // EYE03 unlocks a distinct late-ordinal-recovery response mode. Both
  // successful and failed runs with the same pattern enter its decision.
  // EYE-off recomputes routes without that mode, not merely hides comments.
  const recovery=z=>z.p&&z.p.last>3&&z.p.positions.some((n,i)=>i>0&&n>z.p.positions[0]);
  const feedback=[],paths=[];
  for(const scenario of scenarios){
   const byConvention=new Map();
   for(const z of usable.filter(z=>z.p?.role===scenario.role)){const a=byConvention.get(z.p.convention)??[];a.push(z);byConvention.set(z.p.convention,a);}
   for(const [convention,rs] of byConvention){
    for(const mode of ['FRONT_AT_LAST_REPORTED_POINT','LATE_ORDINAL_RECOVERY','LATE_POSITION_NONPLACE_COUNTER']){
     if(mode==='LATE_ORDINAL_RECOVERY'&&!eyeEnabled)continue;
     const related=rs.filter(z=>mode==='FRONT_AT_LAST_REPORTED_POINT'?z.p.last<=3:mode==='LATE_ORDINAL_RECOVERY'?recovery(z):z.p.last>3);
     if(!related.length)continue;
     const recoverySuccess=related.filter(z=>z.top3&&z.finish<z.p.last);
     if(mode==='LATE_ORDINAL_RECOVERY'&&!distinct(recoverySuccess))continue;
     const evidence=refs(fieldRefs,related.map(z=>z.refs));
     let eyeId=null;
     if(mode==='LATE_ORDINAL_RECOVERY'){
      const f=emit('EYE03','REPEATED_ORDINAL_RECOVERY_WITH_COUNTERS',{scenario:scenario.id,convention,success:recoverySuccess.map(report),all:related.map(report)},evidence,['NO_ACCELERATION_OR_CAUSAL_LOAD']);eyeId=f.id;
      const q=emit('RANK74','EYE03_ADDS_RECOVERY_RESPONSE_MODE',{scenario:scenario.id,convention,eyeId,events:related.map(report)},evidence,['CONDITIONAL_NOT_ACTUAL_PACE'],'CONDITIONAL_HYPOTHESIS');
      feedback.push({eye:'EYE03',target:'RANK74',findingId:q.id,eyeId,scenario:scenario.id,mode,refs:q.refs});
     }
     for(const kind of ['WIN','PLACE']){
      const assessed=related.map(z=>({z,composition:composition(z)}));
      const support=assessed.filter(q=>q.composition.state!=='REPORTED_ROLE_PROFILE_NONOVERLAP'&&(kind==='WIN'?q.z.finish===1:q.z.top3)).map(q=>q.z);
      const counter=related.filter(z=>kind==='WIN'?z.finish!==1:z.nonplace);
      if(mode==='LATE_POSITION_NONPLACE_COUNTER'&&(kind!=='PLACE'||support.length))continue;
      if(!distinct(support)&&!distinct(counter))continue;
      const hasAnchor=support.some(z=>z.c.kind==='EXACT_REPORTED');
      // Variation transfer requires a current exact anchor; a change in
      // venue/going/direction alone is not grounds for positive grade.
      const pathState=distinct(support)&&hasAnchor?(counter.length?'MIXED':'SUPPORT'):distinct(counter)&&!support.length?'COUNTER':'HELD';
      paths.push({kind,scenario:scenario.id,mode,convention,state:pathState,events:support.map(report),counter:counter.map(report),eyeId,unknownRivals:unresolved,fieldProfileComparisons:assessed.map(q=>({event:q.z.event,...q.composition})),refs:close(refs(evidence,assessed.map(q=>q.composition.refs))),scope:'CONDITIONAL_SIMILAR_ORDINAL_RESPONSE_NOT_SAME_LEADER'});
     }
    }
   }
  }
  // EYE07 context return selects an additional context-specific review,
  // never discards contradictory same-family histories.
  if(eyeEnabled){
   const exactGood=places.filter(z=>z.c.kind==='EXACT_REPORTED'),latest=[...usable].sort((a,b)=>a.e.nativeRaceIdentity.dateJst.localeCompare(b.e.nativeRaceIdentity.dateJst)).at(-1);
   if(latest?.c.kind==='CONDITIONAL_VARIATION'&&exactGood.some(z=>z.e.nativeRaceIdentity.dateJst<latest.e.nativeRaceIdentity.dateJst)){
    const f=emit('EYE07','RETURN_TO_EXACT_REPORTED_CONTEXT',{latest:report(latest),prior:exactGood.map(report),counters:bad.map(report)},refs(latest.refs,exactGood.map(z=>z.refs),bad.map(z=>z.refs)),['NOT_CAUSAL_BENEFIT']);const q=emit('RANK95','EYE07_CONTEXT_RETURN_REVIEW',{eyeId:f.id,prior:exactGood.map(report),counters:bad.map(report)},f.refs,['CONDITIONAL_CONTEXT_ONLY']);feedback.push({eye:'EYE07',target:'RANK95',findingId:q.id,eyeId:f.id,refs:q.refs});
   }
  }
  const winPaths=paths.filter(p=>p.kind==='WIN'&&p.state==='SUPPORT'),placePaths=paths.filter(p=>p.kind==='PLACE'&&p.state==='SUPPORT'),counterPaths=paths.filter(p=>['MIXED','COUNTER'].includes(p.state));
  if(winPaths.length)emit('RANK100','CONDITIONAL_WIN_PATH',winPaths,winPaths.map(p=>p.refs),['NOT_FORMAL_GRADE'],'CONDITIONAL_HYPOTHESIS');
  if(placePaths.length)emit('RANK99','CONDITIONAL_PLACE_PATH',placePaths,placePaths.map(p=>p.refs),['NOT_FORMAL_GRADE'],'CONDITIONAL_HYPOTHESIS');
  const supports=comparisons.filter(c=>c.state==='SUPPORT'||c.state==='MIXED'),counters=comparisons.filter(c=>c.state==='COUNTER'||c.state==='MIXED');
  const unknownComparisons=comparisons.filter(c=>c.state==='HELD').map(c=>c.rival);
  const allCompared=comparisons.length>0&&!unknownComparisons.length;
  const allAhead=allCompared&&comparisons.every(c=>c.state==='SUPPORT');
  const sameRaceThreeAhead=usable.some(z=>new Set(comparisons.flatMap(c=>c.direct.filter(d=>d.event===z.event&&d.order==='COUNTER').map(()=>c.rival))).size>=3);
  const perf=distinct(wins)||distinct(places),poor=distinct(bad),exactAnchor=usable.some(z=>z.c.kind==='EXACT_REPORTED'&&z.top3);
  const axis=(axis,state,rs,reason)=>({axis,state,refs:close(refs(rs)),reason});
  const axes=[
   axis('A',perf&&bad.length?'MIXED':perf?'SUPPORT':poor?'COUNTER':'HELD',usable.map(z=>z.refs),'REPEATED_COMPARABLE_OUTCOME_WITH_COUNTERS'),
   axis('B',exactAnchor?'SUPPORT':usable.some(z=>z.c.kind==='EXACT_REPORTED')?'OBSERVED_CONTEXT':'HELD',usable.map(z=>z.refs),'EXACT_ANCHOR_AND_CONDITIONAL_VARIATIONS'),
   axis('C',supports.length&&counters.length?'MIXED':supports.length?'SUPPORT':counters.length?'COUNTER':peerLevel.length?'CONDITIONAL_PEER_WITNESS':'HELD',refs(comparisons.map(c=>c.refs),peerLevel.map(c=>c.refs)),'DIRECT_COMMON_AND_LATER_OPPONENT_WITNESSES'),
   axis('D',winPaths.length||placePaths.length?(counterPaths.some(p=>p.kind==='PLACE')?'MIXED':'SUPPORT'):counterPaths.some(p=>p.kind==='PLACE'&&p.state==='COUNTER')?'COUNTER':'HELD',refs(fieldRefs,paths.map(p=>p.refs)),'SIMILAR_ORDINAL_RESPONSE_MODES_WITH_UNRESOLVED_RIVALS'),
   axis('E',feedback.length?'CONDITIONAL_DISCOVERY':'HELD',feedback.map(f=>f.refs),'EYE_ADDS_RESPONSE_MODE_NOT_ADDITIONAL_VOTE')
  ];
  const a=Object.fromEntries(axes.map(q=>[q.axis,q.state]));
  let grade='UNASSESSED',reason='NO_SUFFICIENT_CONDITIONAL_PATH';
  if(h.status!=='ACTIVE'||!knownStatus(h)||!rosterBound)reason='CURRENT_FIELD_OR_COMPARABLE_HISTORY_INCOMPLETE';
  else if(a.A==='COUNTER'&&a.C==='COUNTER'&&a.D==='COUNTER'&&counterPaths.some(p=>p.kind==='PLACE'&&p.state==='COUNTER')&&!winPaths.length&&!placePaths.length&&!feedback.length){grade='C';reason='REPEATED_COMPARABLE_NONPLACE_WITH_CONCRETE_ROLE_COUNTER_AND_RIVAL_COUNTER';}
  else if(a.A==='SUPPORT'&&a.B==='SUPPORT'&&a.D==='SUPPORT'){
   const robustRoles=new Set(winPaths.filter(p=>p.fieldProfileComparisons.every(q=>q.state==='REPORTED_ROLE_PROFILE_OVERLAP')).map(p=>p.scenario)).size===2;
   if(distinct(wins)&&allAhead&&!unresolved.length&&robustRoles&&!bad.length&&!counterPaths.length){grade='S';reason='REPEATED_WIN_SUPPORT_BOTH_REVIEWED_ROLE_MODES_ALL_RIVALS_NO_COUNTER';}
   else if(winPaths.length&&!bad.length&&!counters.length&&['SUPPORT','CONDITIONAL_PEER_WITNESS'].includes(a.C)){grade='A';reason='CONDITIONAL_WIN_WITH_ANCHORED_RIVAL_OR_PEER_SUPPORT';}
   else if(placePaths.length&&!bad.length&&!sameRaceThreeAhead&&['SUPPORT','MIXED','COUNTER','CONDITIONAL_PEER_WITNESS'].includes(a.C)){grade='B';reason='CONDITIONAL_TOP3_WITH_NONBLOCKING_RIVAL_EVIDENCE';}
  }
  // A/B are conditional and may coexist with unknown other horses; S needs
  // both reviewed role modes and no unresolved rival. None is formal.
  return {...old,candidateGrade:grade,decisionReason:reason,formalGrade:null,axes,items:[...items.values()],winPaths,placePaths,counterPaths,feedback,comparisons,currentAbility:{state:winPaths.length||placePaths.length?'CONDITIONAL_REPORTED_PERFORMANCE_SUPPORT':'HELD',scope:'NOT_OBSERVED_CURRENT_ABILITY',supportedScenarios:unique([...winPaths,...placePaths].map(p=>p.scenario)),unresolvedRivals:unresolved,unknownComparisons,matchedHistory:usable.map(report)},decisionEvidence:{refs:close(refs(fieldRefs,axes.map(a=>a.refs),paths.map(p=>p.refs))),allCompared,allAhead,sameRaceThreeAhead,exactAnchor,unresolved,unknownComparisons,eyeEnabled,formal:false}};
 });
 return {...base,schema:VERSION,field:{...base.field,rosterBound,roleOptions:field,forwardCandidateRange:[forwardMin,forwardMax],unresolved,reviewedRoleScenarios:scenarios,scenarioCoverage:'TWO_CONDITIONAL_SUBJECT_MODES_NOT_EXHAUSTIVE'},runners:result,eyeEnabled,formal:false};
}
