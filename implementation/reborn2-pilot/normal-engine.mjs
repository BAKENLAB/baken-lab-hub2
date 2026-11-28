// NORMAL v0.1 candidate; separate from frozen V48. No scoring, odds or publication.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ENGINE,sha} from './adapter.mjs';
const raw=readFileSync(new URL('../reborn2-work09/normal-material-115.json',import.meta.url));
export const MAP_BLOB='4a98a25b8ac6772ee78480a65d4aca22de4b1a20';
assert.equal(createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex'),MAP_BLOB);
const map=JSON.parse(raw);assert.equal(map.engine,ENGINE);
const id=x=>x.startsWith('EYE-')?x.replace('-',''):'RANK'+x;
const definitions=map.items.map(x=>({...x,item:id(x.id)}));
assert.equal(definitions.length,115);assert.equal(new Set(definitions.map(i=>i.item)).size,115);
const uniq=x=>[...new Set(x)].sort(),finite=Number.isFinite;
export const NORMAL_VERSION='REBORN2_NORMAL_CANDIDATE_0.1';
const contextKeys=['surfaceLiteral','distanceM','goingLiteral','directionLiteral','classLiteral'];
// Source-native observation state only. A literal corner position is not
// an individual elapsed clock or a measurement of acceleration.
const clockMs=s=>{const m=typeof s==='string'&&s.match(/^(\d{1,2}):([0-5]\d)\.(\d{1,3})$/);return m?Number(m[1])*60000+Number(m[2])*1000+Number(m[3].padEnd(3,'0')):null;};
const positions=s=>{if(typeof s!=='string'||!/^\d{1,2}(?:,\d{1,2})+$/.test(s))return null;const a=s.split(',').map(Number);return a.every(v=>v>=1&&v<=24)?a:null;};
const day=s=>Date.parse(s+'T00:00:00Z')/86400000;
const isTop3=(finish,count)=>finite(finish)&&finite(count)&&count>3&&finish<=3;
// This policy is preregistered candidate logic, not a validated grading model.
// Distinct comparable events establish repeatability, not proof counts.
// No grade if current roster/history/role coverage or key context is unknown.
export function decideNormalGrade({eligible,completeField,allHistory,paceCovered,axes,winPaths,placePaths,against,allPeersAhead,allScenarioWin,eyeFeedback}){
 const hold=reason=>({grade:'UNASSESSED',reason});
 if(!eligible||!completeField||!allHistory||!paceCovered)return hold('CURRENT_FIELD_OR_COMPARABLE_HISTORY_INCOMPLETE');
 const a=Object.fromEntries(axes.map(x=>[x.axis,x.state]));
 if(['A','B','C','D'].some(k=>!a[k]||a[k]==='HELD'))return hold('DECISIVE_AXIS_UNRESOLVED');
 if(against&&a.A==='COUNTER'&&a.C==='COUNTER'&&a.D==='COUNTER'&&!winPaths.length&&!placePaths.length&&a.B!=='COUNTER'&&a.E!=='SUPPORT')return {grade:'C',reason:'REPEATED_MATCHED_NONPLACE_AND_DIRECT_DISADVANTAGE_UNDER_REVIEWED_SCENARIOS'};
 if(against||[a.A,a.B,a.C,a.D].some(s=>s==='COUNTER'||s==='MIXED'))return hold('MATERIAL_COUNTER_OR_MIXED');
 if(winPaths.length&&a.A==='SUPPORT'&&a.B==='SUPPORT'&&a.C==='SUPPORT'&&a.D==='SUPPORT'){
  if(allPeersAhead&&allScenarioWin&&eyeFeedback&&a.E==='SUPPORT')return {grade:'S',reason:'REPEATED_MATCHED_WINS_ALL_RIVALS_AND_REVIEWED_ROLES_SUPPORT_WITH_EYE_FEEDBACK'};
  return {grade:'A',reason:'REPEATED_MATCHED_WINS_WITH_CONDITIONAL_ROLE_AND_RIVAL_SUPPORT'};
 }
 if(placePaths.length&&a.A==='SUPPORT'&&a.B==='SUPPORT'&&a.C==='SUPPORT'&&a.D==='SUPPORT')return {grade:'B',reason:'REPEATED_MATCHED_TOP3_IN_FIELDS_OVER_THREE_WITH_ROLE_AND_RIVAL_SUPPORT'};
 return hold('NO_SUFFICIENT_CONDITIONAL_PATH');
}
export function computeNormal(packet,roster,{fixture=false}={}){
 assert.equal(packet.scope,fixture?'FIXED_FIXTURE_GRAPH_ONLY':'NATIVE_PARTIAL_GRAPH_VERIFIED');
 const observed=fixture?'OBSERVED_TEST_FORMAT':'OBSERVED_NATIVE_VERIFIED';
 const byId=new Map(packet.roots.map(r=>[r.id,r]));assert.equal(byId.size,packet.roots.length);
 const closure=direct=>{const seen=new Set();function visit(i){if(seen.has(i))return;assert.ok(byId.has(i),'NORMAL_ROOT_MISSING');seen.add(i);byId.get(i).depends.forEach(visit);}direct.forEach(visit);return uniq([...seen]);};
 const obs=(x,k)=>x?.observations?.[k]?.state===observed?x.observations[k]:null;
 const v=(x,k)=>obs(x,k)?.value??null;
 const ref=(...os)=>uniq(os.flat().filter(Boolean).map(o=>o.evidenceId));
 const card=packet.events.find(e=>e.role==='TARGET_CARD'),history=packet.events.filter(e=>e.role==='HISTORICAL_RESULT').sort((a,b)=>a.nativeRaceIdentity.dateJst.localeCompare(b.nativeRaceIdentity.dateJst)||a.eventId.localeCompare(b.eventId));
 assert.ok(card&&card.eventId===packet.target.eventId);
 const row=(e,h)=>e.rows.find(r=>r.nativeId===h);
 const context=e=>Object.fromEntries(contextKeys.map(k=>[k,v(e,k)]));
 const compare=e=>{const a=context(card),b=context(e),unknown=contextKeys.filter(k=>a[k]===null||b[k]===null),changed=contextKeys.filter(k=>a[k]!==null&&b[k]!==null&&a[k]!==b[k]);if(card.nativeRaceIdentity.venueId!==e.nativeRaceIdentity.venueId)changed.push('venue');return {state:unknown.length?'INCOMPLETE':changed.length?'DIFFERENT':'MATCHED_LITERAL',unknown,changed,current:a,historical:b,refs:ref(contextKeys.flatMap(k=>[obs(card,k),obs(e,k)]),{evidenceId:card.eventRoot},{evidenceId:e.eventRoot})};};
 const profile=new Map(roster.map(h=>[h.horseId,history.filter(e=>row(e,h.horseId)).map(e=>{
  const r=row(e,h.horseId),p=positions(v(r,'cornerPositionsLiteral')),count=v(e,'declaredCount'),finish=v(r,'finish');
  // Same reported ordinal sequence only. A single position has no
  // identifiable first/last comparison. No claim about actual start.
  const role=p&&finite(count)&&p.every(n=>n<=count)?p[0]<=3?'FORWARD_REPORTED':'OTHER_REPORTED':null;
  return {event:e.eventId,date:e.nativeRaceIdentity.dateJst,e,r,finish,count,final:v(r,'final600Ms'),clock:clockMs(v(r,'finishClockLiteral')),p,role,ctx:compare(e)};
 })]));
 const active=roster.filter(h=>h.status==='ACTIVE'),possible=roster.filter(h=>h.status!=='CANCELLED');
 const completeField=possible.length>=2&&possible.every(h=>h.status==='ACTIVE'&&v(row(card,h.horseId),'status')==='ACTIVE')&&v(card,'declaredCount')===roster.length;
 // Role inference is an ordinal hypothesis from repeated same-reported
 // context, not a measured start, exact pace or current position.
 const roles=possible.map(h=>{const q=profile.get(h.horseId).filter(z=>z.ctx.state==='MATCHED_LITERAL'&&z.role),distinct=new Set(q.map(z=>z.event)),types=uniq(q.map(z=>z.role));return {horse:h.horseId,role:distinct.size>=2&&types.length===1?types[0]:'UNKNOWN',events:q.map(z=>z.event),refs:ref(q.map(z=>obs(z.r,'cornerPositionsLiteral')),q.map(z=>obs(z.e,'declaredCount')),q.flatMap(z=>z.ctx.refs.map(evidenceId=>({evidenceId}))),obs(row(card,h.horseId),'status'))};});
 const paceCovered=completeField&&roles.every(q=>q.role!=='UNKNOWN');
 const forward=roles.filter(q=>q.role==='FORWARD_REPORTED'),others=roles.filter(q=>q.role==='OTHER_REPORTED');
 const scenarios=paceCovered?[{id:forward.length===1?'SINGLE_FORWARD_CANDIDATE':forward.length>1?'FORWARD_COMPETITION':'NO_IDENTIFIED_FORWARD',forward:forward.map(x=>x.horse),other:others.map(x=>x.horse),refs:closure(uniq(roles.flatMap(x=>x.refs))),scope:'CONDITIONAL_ORDINAL_ROLE_HYPOTHESIS_NOT_ACTUAL_PACE'}]:[];
 const allHistory=possible.every(h=>profile.get(h.horseId).some(z=>z.ctx.state==='MATCHED_LITERAL'&&finite(z.finish)));
 const runners=roster.map(h=>{
  const horse=h.horseId,t=row(card,horse),runs=profile.get(horse),matched=runs.filter(z=>z.ctx.state==='MATCHED_LITERAL'&&finite(z.finish)),items=new Map(definitions.map(i=>[i.item,{item:i.item,name:i.name,category:i.category,state:'HELD',reason:i.category==='M'?'SPECIAL_MEASUREMENT_UNAVAILABLE':i.category==='S'?'SEPARATE_SOURCE_UNVERIFIED':'NORMAL_COMPUTATION_OR_EVIDENCE_INSUFFICIENT',findings:[]}]));
  const emit=(item,type,value,directRefs,limits=[],state='DERIVED_COMPARISON')=>{
   const i=items.get(item);assert.ok(i&&['F','C'].includes(i.category),'NORMAL_ITEM_NOT_ALLOWED');
   const direct=uniq(directRefs);if(!direct.length)return null;
   const f={id:sha([NORMAL_VERSION,horse,item,type,value,direct]),item,type,value,directRefs:direct,refs:closure(direct),limits,state,formal:false};
   i.findings.push(f);i.state=state;i.reason=null;return f;
  };
  const put=(i,type,val,os,limits=[],state='OBSERVED_FACT')=>emit(i,type,val,ref(os),limits,state);
  const findings=i=>items.get(i).findings;
  const knownRefs=z=>ref(obs(z.r,'finish'),obs(z.e,'declaredCount'),z.ctx.refs.map(evidenceId=>({evidenceId})));
  const runValue=z=>({event:z.event,finish:z.finish,declaredCount:z.count});
  for(const z of runs){
   const {e,r}=z;
   for(const [item,k] of [['RANK02','finish'],['RANK03','officialMarginLiteral'],['RANK06','final600Ms'],['RANK17','cornerPositionsLiteral']])if(obs(r,k))put(item,'REPORTED_'+k,{event:z.event,value:v(r,k)},[obs(r,k)],['REPORTED_HISTORICAL_FACT']);
   if(z.clock!==null)put('RANK05','EXPLICIT_MINUTE_SECOND_CLOCK',{event:z.event,ms:z.clock,literal:v(r,'finishClockLiteral')},[obs(r,'finishClockLiteral')],['NOT_INDIVIDUAL_CROSSING_CLOCK']);
   if(obs(e,'leaderLapSlots'))put('RANK19','RACE_LEADER_LAP_LITERALS',{event:z.event,slots:v(e,'leaderLapSlots')},[obs(e,'leaderLapSlots')],['NO_INDIVIDUAL_CLOCK_OR_DISTANCE_BOUNDARY_INFERENCE']);
   if(z.p){const delta=z.p[0]-z.p.at(-1);put('RANK18','ORDINAL_POSITION_CHANGE',{event:z.event,positions:z.p,delta},[obs(r,'cornerPositionsLiteral')],['NO_SPEED_CAUSAL_OR_DISTANCE_INFERENCE'],'DERIVED_COMPARISON');
    if(z.p.some((n,i)=>i>0&&n>z.p[0])&&finite(z.finish)&&z.finish<Math.max(...z.p))put('RANK21','REPORTED_BACKWARD_RECOVERY',{event:z.event,positions:z.p,finish:z.finish},[obs(r,'cornerPositionsLiteral'),obs(r,'finish')],['NO_CAUSAL_EXPLANATION'],'DERIVED_COMPARISON');
    if(delta>0)put('RANK22','ORDINAL_ADVANCE',{event:z.event,delta},[obs(r,'cornerPositionsLiteral')],['NO_DISTANCE_GAIN_INFERENCE'],'DERIVED_COMPARISON');
   }
   for(const [item,k] of [['RANK43','distanceM'],['RANK47','surfaceLiteral'],['RANK48','goingLiteral'],['RANK49','directionLiteral']])if(obs(e,k)&&obs(card,k))put(item,'CONDITION_LITERAL_COMPARISON',{event:z.event,historical:v(e,k),current:v(card,k),matched:v(e,k)===v(card,k)},[obs(e,k),obs(card,k)],['NOT_CAUSAL_APTITUDE'],'DERIVED_COMPARISON');
   emit('RANK45','VENUE_AND_CONTEXT_COMPARISON',{event:z.event,...z.ctx,refs:undefined},z.ctx.refs,['LITERAL_CLASS_NOT_LEVEL_EQUIVALENCE']);
   if(obs(t,'weightG')&&obs(r,'weightG'))put('RANK54','WEIGHT_CHANGE',{event:z.event,deltaG:v(t,'weightG')-v(r,'weightG')},[obs(t,'weightG'),obs(r,'weightG')],['NO_WEIGHT_CAUSAL_EFFECT'],'DERIVED_COMPARISON');
   if(obs(e,'distanceM')&&obs(card,'distanceM'))put('RANK44','DISTANCE_CHANGE',{event:z.event,deltaM:v(card,'distanceM')-v(e,'distanceM')},[obs(e,'distanceM'),obs(card,'distanceM')],['NO_CAUSAL_APTITUDE'],'DERIVED_COMPARISON');
  }
  if(obs(t,'bodyWeightKg'))put('RANK81','BODY_WEIGHT',{kg:v(t,'bodyWeightKg'),deltaKg:v(t,'bodyWeightDeltaKg')},[obs(t,'bodyWeightKg'),obs(t,'bodyWeightDeltaKg')],['NO_FORM_INFERENCE']);
  if(obs(t,'sexAge'))put('RANK91','REPORTED_SEX_AGE',{literal:v(t,'sexAge')},[obs(t,'sexAge')],['NO_GROWTH_INFERENCE']);
  const latest=runs.at(-1);
  if(latest){const gap=day(card.nativeRaceIdentity.dateJst)-day(latest.date);if(finite(gap)&&gap>0){
   const dr=ref({evidenceId:card.eventRoot},{evidenceId:latest.e.eventRoot},obs(t,'no'),obs(latest.r,'no'));
   emit('RANK78','DAYS_SINCE_LATEST_SUPPLIED_RUN',{days:gap,event:latest.event},dr,['SUPPLIED_HISTORY_MAY_NOT_BE_COMPLETE']);
   emit('RANK79','REPORTED_RACE_INTERVAL',{days:gap,event:latest.event},dr,['SUPPLIED_HISTORY_MAY_NOT_BE_COMPLETE']);
  }}
  if(matched.length){const rr=uniq(matched.flatMap(knownRefs));emit('RANK01','MATCHED_CONTEXT_PERFORMANCE',matched.map(runValue),rr,['NO_CLASS_LEVEL_OR_CURRENT_ABILITY_CERTAINTY']);emit('RANK12','MATCHED_WIN_AND_COUNTER',matched.map(runValue),rr,['REPEATABILITY_REQUIRES_DISTINCT_EVENTS']);}
  if(matched.length>=2)emit('RANK13','REPEATED_MATCHED_FINISHES',matched.map(runValue),uniq(matched.flatMap(knownRefs)),['NO_NUMERIC_ABILITY_SCORE']);
  // Direct comparisons retain both supports and counters, same event only.
  const pairs=[];
  for(const z of runs)for(const rival of possible.filter(q=>q.horseId!==horse)){
   const q=row(z.e,rival.horseId),rf=v(q,'finish');if(!finite(z.finish)||!finite(rf))continue;
   const refs=ref(obs(z.r,'finish'),obs(q,'finish'),obs(z.r,'final600Ms'),obs(q,'final600Ms'),obs(t,'no'),obs(row(card,rival.horseId),'no'),z.ctx.refs.map(evidenceId=>({evidenceId})));
   const val={event:z.event,rival:rival.horseId,ownFinish:z.finish,rivalFinish:rf,order:z.finish<rf?'AHEAD':z.finish>rf?'BEHIND':'TIE',final600DifferenceMs:finite(z.final)&&finite(v(q,'final600Ms'))?z.final-v(q,'final600Ms'):null,context:z.ctx.state};
   const f=emit('RANK35','DIRECT_REPORTED_COMPARISON',val,refs,['HISTORICAL_ONLY']);pairs.push({...val,refs:f.refs});
  }
  // Common opponent locator: no transitive order or comparable class claim.
  for(const z of matched)for(const rival of possible.filter(q=>q.horseId!==horse))for(const rz of profile.get(rival.horseId).filter(a=>a.ctx.state==='MATCHED_LITERAL'&&a.event!==z.event&&finite(a.finish))){
   for(const peer of z.e.rows.filter(p=>p.nativeId!==horse&&p.nativeId!==rival.horseId)){
    const peer2=row(rz.e,peer.nativeId),p1=v(peer,'finish'),p2=v(peer2,'finish');if(!finite(p1)||!finite(p2))continue;
    put('RANK36','COMMON_OPPONENT_LOCATOR',{events:[z.event,rz.event],rival:rival.horseId,peer:peer.nativeId,ownFinish:z.finish,peerFinishA:p1,rivalFinish:rz.finish,peerFinishB:p2},[obs(z.r,'finish'),obs(peer,'finish'),obs(rz.r,'finish'),obs(peer2,'finish'),...z.ctx.refs.map(evidenceId=>({evidenceId})),...rz.ctx.refs.map(evidenceId=>({evidenceId}))],['NO_TRANSITIVE_ORDER_OR_PEER_STRENGTH_INFERENCE'],'DERIVED_COMPARISON');
   }
  }
  const role=roles.find(q=>q.horse===horse);
  if(role?.role!=='UNKNOWN'&&role){emit('RANK58','REPEATED_REPORTED_ORDINAL_ROLE',{role:role.role,events:role.events},role.refs,['FIRST_REPORTED_CORNER_NOT_START']);emit('RANK60','ROLE_REPRODUCIBILITY',{role:role.role,events:role.events},role.refs,['NOT_MEASURED_EARLY_SPEED']);}
  if(paceCovered){const refs=uniq(scenarios.flatMap(s=>s.refs));emit('RANK63','FORWARD_CANDIDATE_SHARE',{forward:forward.length,possible:possible.length},refs,['NO_FIXED_PACE_THRESHOLD']);emit('RANK65','FORWARD_ROLE_COMPETITION',{forward:forward.map(x=>x.horse)},refs,['NOT_ACTUAL_COMPETITION']);emit('RANK69','ORDINAL_PACE_SCENARIO',scenarios,refs,['NO_MEASURED_PACE_FORECAST'],'CONDITIONAL_HYPOTHESIS');emit('RANK70','ORDINAL_ROLE_GROUPS',{forward:forward.map(x=>x.horse),other:others.map(x=>x.horse)},refs,['NO_EXACT_CURRENT_ORDER'],'CONDITIONAL_HYPOTHESIS');}
  // EYE03: genuine feedback of reported recovery only; does not establish
  // current benefit without comparable repeated role/conditions.
  const feedback=[];
  for(const f of findings('RANK21')){
   const z=runs.find(z=>z.event===f.value.event);
   const eye=emit('EYE03','ORDINAL_RECOVERY_DISCOVERY',f.value,f.directRefs,['NO_MEASURED_ACCELERATION_OR_CAUSAL_LOAD']);
   if(z.ctx.state==='MATCHED_LITERAL'&&role?.role===z.role&&role.role!=='UNKNOWN'){
    const q=emit('RANK74','EYE03_MATCHED_RECOVERY_ROUTE',{event:z.event,eyeId:eye.id,role:role.role},uniq([...eye.directRefs,...z.ctx.refs,...role.refs]),['CONDITIONAL_NOT_CURRENT_RESULT'],'CONDITIONAL_HYPOTHESIS');feedback.push({eye:'EYE03',target:'RANK74',findingId:q.id,event:z.event,refs:q.refs});
   }
  }
  // EYE07: return to earlier matched context after latest different context;
  // prior top3 and counter history both retained. No causal improvement.
  if(latest?.ctx.state==='DIFFERENT'){
   const prior=matched.filter(z=>z.event!==latest.event&&isTop3(z.finish,z.count));
   const counters=matched.filter(z=>!isTop3(z.finish,z.count)&&z.finish!==1);
   if(prior.length){const refs=uniq([...latest.ctx.refs,...prior.flatMap(knownRefs),...counters.flatMap(knownRefs)]);const e=emit('EYE07','RETURN_TO_REPORTED_SUCCESS_CONTEXT',{latest:latest.event,prior:prior.map(runValue),counters:counters.map(runValue)},refs,['NO_CAUSAL_BENEFIT']);
    const q=emit('RANK95','EYE07_CONTEXT_RETURN_REVIEW',{eyeId:e.id,prior:prior.map(runValue),counters:counters.map(runValue)},refs,['CONDITIONAL_CONTEXT_ONLY'],'CONDITIONAL_HYPOTHESIS');feedback.push({eye:'EYE07',target:'RANK95',findingId:q.id,event:prior[0].event,refs:q.refs});}
  }
  const matchedPairs=pairs.filter(p=>p.context==='MATCHED_LITERAL'),ahead=matchedPairs.filter(p=>p.order==='AHEAD'),behind=matchedPairs.filter(p=>p.order==='BEHIND');
  const wins=matched.filter(z=>z.finish===1),places=matched.filter(z=>isTop3(z.finish,z.count)),nonplace=matched.filter(z=>finite(z.count)&&z.count>3&&z.finish>3);
  const compatible=matched.filter(z=>role&&role.role!=='UNKNOWN'&&z.role===role.role);
  const repeat=zs=>new Set(zs.map(z=>z.event)).size>=2;
  const against=behind.length>0||nonplace.length>0;
  const paths=(kind,events)=>scenarios.flatMap(s=>{
   const supported=events.filter(z=>compatible.includes(z));if(!repeat(supported))return [];
   const counter=compatible.filter(z=>kind==='WIN'?z.finish!==1:!isTop3(z.finish,z.count));
   const e=feedback.filter(q=>supported.some(z=>z.event===q.event));
   const refs=uniq([...s.refs,...supported.flatMap(knownRefs),...counter.flatMap(knownRefs),...matchedPairs.flatMap(p=>p.refs),...e.flatMap(q=>q.refs)]);
   return [{kind,scenario:s.id,condition:'REPORTED_MATCHED_CONTEXT_AND_REPEATED_ORDINAL_ROLE',events:supported.map(runValue),counter:counter.map(runValue),rivals:matchedPairs,eyeFeedback:e.map(q=>q.findingId),refs,scope:'CONDITIONAL_NOT_PREDICTION',supported:counter.length===0&&behind.length===0}];
  });
  const win=paths('WIN',wins),place=paths('PLACE',places),winPaths=win.filter(p=>p.supported),placePaths=place.filter(p=>p.supported);
  const axis=(axis,state,refs,reason)=>({axis,state,refs:uniq(refs),reason});
  const perf=repeat(wins)||repeat(places),bad=repeat(nonplace),matchedRefs=uniq(matched.flatMap(knownRefs));
  const axes=[
   axis('A',perf&&bad?'MIXED':perf?'SUPPORT':bad?'COUNTER':'HELD',matchedRefs,'REPEATED_MATCHED_REPORTED_PERFORMANCE'),
   axis('B',matched.length?'SUPPORT':'HELD',matchedRefs,'LITERAL_CONTEXT_MATCH_NOT_CAUSAL_APTITUDE'),
   axis('C',ahead.length&&behind.length?'MIXED':ahead.length?'SUPPORT':behind.length?'COUNTER':'HELD',matchedPairs.flatMap(p=>p.refs),'DIRECT_REPORTED_RIVALS_ONLY'),
   axis('D',!paceCovered?'HELD':winPaths.length||placePaths.length?'SUPPORT':repeat(compatible.filter(z=>nonplace.includes(z)))?'COUNTER':'HELD',uniq([...scenarios.flatMap(s=>s.refs),...compatible.flatMap(knownRefs)]),'CONDITIONAL_ORDINAL_ROLE_NOT_SPEED'),
   axis('E',feedback.length?'SUPPORT':'HELD',feedback.flatMap(q=>q.refs),'ONLY_RETURNED_EYE_FINDINGS_NO_EXTRA_VOTE')
  ];
  const allPeersAhead=possible.filter(q=>q.horseId!==horse).every(q=>ahead.some(p=>p.rival===q.horseId)&&!behind.some(p=>p.rival===q.horseId));
  const decision=decideNormalGrade({eligible:h.status==='ACTIVE',completeField,allHistory,paceCovered,axes,winPaths,placePaths,against,allPeersAhead,allScenarioWin:scenarios.length>0&&winPaths.length===scenarios.length,eyeFeedback:feedback.length>0});
  if(winPaths.length)emit('RANK100','CONDITIONAL_WIN_PATH',winPaths,winPaths.flatMap(p=>p.refs),['NOT_FORMAL_GRADE'],'CONDITIONAL_HYPOTHESIS');
  if(placePaths.length)emit('RANK99','CONDITIONAL_PLACE_PATH',placePaths,placePaths.flatMap(p=>p.refs),['NOT_FORMAL_GRADE'],'CONDITIONAL_HYPOTHESIS');
  return {horse,horseNo:h.horseNo,status:h.status,candidateGrade:decision.grade,decisionReason:decision.reason,formalGrade:null,axes,winPaths,placePaths,counterPaths:[...win,...place].filter(p=>!p.supported),feedback,items:[...items.values()],formal:false};
 });
 return {schema:NORMAL_VERSION,scope:fixture?'EXISTING_FIXTURE_NORMAL_CANDIDATE_ONLY':'APPROVED_NATIVE_NORMAL_CANDIDATE_ONLY',engineCommit:ENGINE,mapBlob:MAP_BLOB,sourceGraphDigest:sha(packet),field:{completeField,allHistory,paceCovered,roles,scenarios},runners,formal:false,persistenceAllowed:false};
}
