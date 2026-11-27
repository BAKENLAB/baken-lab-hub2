// V39 research only. Fixed Work35 input, shared V38/V35 computations.
// No formal grade or assertion that a hypothetical start is today's observation.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadV38,analyzeV38} from './work35-v38-completion.mjs';
import {jointField} from './work29-v30-terminal.mjs';
const H=n=>'TEST:NAR|TEST:H'+n, uniq=a=>[...new Set(a)].sort();
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const incident=(s,h)=>s.edges.filter(e=>e.a===h||e.b===h);
const verdict=(e,t)=>!e||t===null?'UNKNOWN':e.max<=t?'SUPPORT':e.min>t?'COUNTER':'UNRESOLVED';
// Independently enumerate all small-field orders (not a transitive-closure implementation).
export function orderOracle(roster,edges){
 assert.ok(roster.length<=7);
 const orders=[];
 function visit(prefix,left){
  if(!left.length){if(edges.every(e=>e.order==='UNKNOWN'||(e.order==='AHEAD'?prefix.indexOf(e.a)<prefix.indexOf(e.b):prefix.indexOf(e.b)<prefix.indexOf(e.a))))orders.push(prefix);return;}
  for(const h of left)visit([...prefix,h],left.filter(q=>q!==h));
 }
 visit([],roster);
 return {orders:orders.length,envelopes:orders.length?roster.map(h=>({slot:h,min:Math.min(...orders.map(o=>o.indexOf(h)+1)),max:Math.max(...orders.map(o=>o.indexOf(h)+1))})):[]};
}
function bounds(e){return e.map(x=>[x.slot,x.min,x.max]).sort((a,b)=>a[0].localeCompare(b[0]));}
// Presence alternatives: unknown entries may start or not. No promotion to known active.
export function participationOracle(roster,edges){
 const known=roster.known_active,unknown=roster.possible_active.filter(h=>!known.includes(h));
 assert.ok(unknown.length<=7);
 return Array.from({length:2**unknown.length},(_,mask)=>{
  const slots=roster.possible_active.filter(h=>known.includes(h)||unknown.indexOf(h)>=0&&(mask&(1<<unknown.indexOf(h))));
  return {slots,...orderOracle(slots,edges.filter(e=>slots.includes(e.a)&&slots.includes(e.b)))};
 });
}
function semantic(x){
 if(Array.isArray(x))return x.map(semantic);
 if(!x||typeof x!=='object')return x;
 return Object.fromEntries(Object.entries(x).filter(([k])=>!/(^|_)(refs?|lineage|evidence_ids?|root_keys?|digest|sha256|hash|prose|comment|reason|decision_effect|grade_effect_proven|v34_reanalysis)($|_)/i.test(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,semantic(v)]));
}
function itemValue(i){return semantic({state:i.state,missing:i.missing,findings:i.v33_findings??[]});}
function responsePair(s,e,h){
 const sign=e.a===h?1:-1,rival=sign===1?e.b:e.a,a=s.starts?.[h],b=s.starts?.[rival];
 const start=a&&b?[b[0]-a[1],b[1]-a[0]]:null;
 const finish=e.interval_ms?(sign===1?e.interval_ms:[-e.interval_ms[1],-e.interval_ms[0]]):null;
 const gain=Number.isFinite(e.change_ms)?sign*e.change_ms:null;
 const bound=e.change_bound_ms;
 return {rival,start,finish,gain,bound,
  recovered:!!(start&&finish&&start[1]<0&&finish[0]>0&&gain>bound),
  lead_retained:!!(start&&finish&&start[0]>0&&finish[0]>0),
  loss:Number.isFinite(gain)&&Number.isFinite(bound)&&gain< -bound,refs:e.refs};
}
function axis(axis,support,counter,unknown,facts,refs){
 return {axis,state:support&&counter?'MIXED':support?'SUPPORT':counter?'COUNTER':'UNKNOWN',support,counter,unknown,facts,refs:uniq(refs)};
}
function route(x,h,s,threshold){
 const history=x.historical_scenarios.find(z=>z.event===s.response_event&&z.checkpoint_m===s.checkpoint_m);
 const env=s.field.envelopes.find(e=>e.slot===h.slot)??null;
 const own=incident(s,h.slot),pairs=own.map(e=>responsePair(s,e,h.slot));
 const missing=pairs.filter(e=>!e.finish||!e.start||!e.refs.length).map(e=>e.rival);
 const active=x.roster.known_active.includes(h.slot)&&h.identity_known&&h.status==='ACTIVE';
 const conditional=active&&s.valid&&s.comparable&&s.complete&&!s.roleConflicts.length&&!!env&&!!s.condition_refs?.length&&!!s.historical_role_refs?.length&&!missing.length;
 const recovered=pairs.filter(p=>p.recovered),lead=pairs.filter(p=>p.lead_retained),loss=pairs.filter(p=>p.loss);
 const win=conditional?verdict(env,1):'UNKNOWN',place=conditional?verdict(env,threshold):'UNKNOWN';
 const past=history?.field.envelopes.find(e=>e.slot===h.slot)??null;
 // EYE data come from actual shared 100-item reanalysis; event scope is
 // explicit. A counter to a different historical route is not a veto here.
 const findings=(h.findings_v33??[]).filter(f=>f.item==='RANK18'&&f.eye_id&&f.observation?.checkpoint_m===s.checkpoint_m);
 const eyeSupport=findings.flatMap(f=>(f.observation.measurements??[]).filter(m=>m.event===s.response_event&&m.supported).map(m=>({id:f.eye_id,event:m.event,gain:m.gain,refs:m.refs})));
 const eyeCounter=findings.flatMap(f=>(f.observation.counterexamples??[]).filter(m=>m.event===s.response_event).map(m=>({id:f.eye_id,event:m.event,gain:m.gain,refs:m.refs})));
 const axes=[
  axis('A',pairs.some(p=>p.finish&&p.refs.length),false,missing.length>0,{historical_envelope:past,measured_response:pairs},pairs.flatMap(p=>p.refs)),
  axis('B',conditional,!!s.roleConflicts.length||!!history&&!history.contextMatched,!conditional,{contextMatched:history?.contextMatched??false,roleConflicts:s.roleConflicts,explicit_starts:s.starts,current_observed:false},[...(s.condition_refs??[]),...(s.historical_role_refs??[])]),
  axis('C',win==='SUPPORT'||place==='SUPPORT',place==='COUNTER',!conditional||place==='UNRESOLVED',{envelope:env,WIN:win,PLACE:place},s.edges.flatMap(e=>e.refs)),
  axis('D',recovered.length>0||lead.length>0,loss.length>0,missing.length>0,{recovered,lead,loss},pairs.flatMap(p=>p.refs)),
  axis('E',eyeSupport.length>0,eyeCounter.length>0,!eyeSupport.length&&!eyeCounter.length,{support:eyeSupport,counter:eyeCounter},[...eyeSupport,...eyeCounter].flatMap(e=>e.refs))
 ];
 const blocked=[];
 if(!active)blocked.push('RUNNER_UNCONFIRMED');
 if(!s.valid)blocked.push('SHARED_INVALID_OR_HELD');
 if(!s.comparable)blocked.push('CONTEXT_OR_SHARED_PACE_NOT_COMPARABLE');
 if(s.roleConflicts.length)blocked.push('ROLE_ANTECEDENT_CONFLICT');
 if(missing.length||!s.complete)blocked.push('INCOMPLETE_FIELD_RESPONSE');
 if(!s.condition_refs?.length||!s.historical_role_refs?.length)blocked.push('ANTECEDENT_LINEAGE_MISSING');
 // This is a research judgement of a stated stress branch, not a forecast.
 // Positive EYE is not a second vote; its evidence already enters the response.
 // Negative EYE is retained on the relevant route; a local loss does not negate
 // a still-supported full-field bound. Uncertain or contradicted bounds never grade.
 // A/B/C use these same route facts, not axis counts. E is a scoped
 // material review, not an extra vote. A measured loss can coexist with a win.
 const [a,b,c,d,f]=axes;
 if(!a.support||a.unknown||!b.support||b.counter||d.unknown)blocked.push('FIVE_AXIS_DEPENDENCY_HELD');
 if((f.support||f.counter)&&!f.refs.length)blocked.push('EYE_LINEAGE_HELD');
 const candidate=blocked.length?null:c.support&&win==='SUPPORT'?'A':c.support&&place==='SUPPORT'?'B':c.counter&&place==='COUNTER'?'C':null;
 return {id:s.id,event:s.response_event,checkpoint:s.checkpoint_m,horse:h.slot,scope:'EXPLICIT_STRESS_ANTECEDENT_ONLY',
  replay:s.id.startsWith('OBS:'),axes,blocked,envelope:env,historical_envelope:past,WIN:win,PLACE:place,candidate,
  response_kind:win==='SUPPORT'?(recovered.length?'DEFICIT_OVERTAKEN':lead.length===pairs.length?'START_ADVANTAGE_RETAINED':'MIXED_RESPONSE'):'NO_SUPPORTED_WIN_IN_BRANCH',
  possible_winner:!!env&&env.min===1,refs:uniq(axes.flatMap(a=>a.refs)),formal:false,observed_current:false};
}
export function analyzeV39(V,id,{withdraw=null,placeThreshold=2,gapStress=true}={}){
 const x=analyzeV38(V,id,{withdraw,eyeEnabled:true,placeThreshold,gapStress});
 const runners=x.runners.map(h=>{
  const routes=x.conditional_scenarios.map(s=>route(x,h,s,placeThreshold));
  const stress=routes.filter(p=>!p.replay);
  const win=stress.filter(p=>p.candidate==='A'),place=stress.filter(p=>p.candidate==='B');
  // No global S or C: the source does not establish completeness of today's
  // role/pace/form alternatives. C on one branch is not global disadvantage.
  const research_grade=win.length?'A':place.length?'B':null;
  return {...h,routes_v39:routes,research_grade,grade:null,formal:false,
   research_scope:'CONDITIONAL_STRESS_CANDIDATE_NOT_CURRENT_RACE_GRADE',
   research_reason:research_grade?'EXPLICIT_SUPPORTED_STRESS_ROUTE':'NO_SUPPORTED_EXPLICIT_STRESS_ROUTE',
   current_grade:null,decisive_unknowns:['CURRENT_ROLE_PACE','CURRENT_FORM','CURRENT_ALTERNATIVE_COVERAGE'],WIN:{...h.WIN,conditional_support:win.map(r=>r.id),overall:'UNRESOLVED'},PLACE:{...h.PLACE,conditional_support:[...win,...place].map(r=>r.id),overall:'UNRESOLVED'}};
 });
 return {...x,runners,formal:false,grade:null,policy:'V39_PARTIAL_CONDITIONAL_DECISION_NO_FORMAL_ADOPTION'};
}
export function auditEyeRoot(V,id,event){
 const after=analyzeV39(V,id,{gapStress:false}),root=after.source_packet.evidence.find(e=>e.event===event&&e.subject==='TEST:H4'&&e.field==='checkpoint_ms')?.evidenceId;
 assert.ok(root,'FIXED_ROOT_REQUIRED');
 const before=analyzeV39(V,id,{withdraw:root,gapStress:false});
 assert.equal(before.source_digest,after.source_digest);
 const target='TEST:NAR|'+event;
 const b=before.runners.find(h=>h.slot===H(4)),a=after.runners.find(h=>h.slot===H(4));
 const findings=h=>(h.findings_v33??[]).filter(f=>f.item==='RANK18'&&f.eye_id);
 const matching=(h,k)=>findings(h).flatMap(f=>(f.observation?.[k]??[]).filter(m=>m.event===target&&m.refs.includes(root)));
 const independentPositive=matching(a,'measurements').filter(m=>m.supported),relevantCounter=matching(a,'counterexamples');
 const positive=independentPositive.length>0&&matching(b,'measurements').length===0;
 const counter=relevantCounter.length>0&&matching(b,'counterexamples').length===0;
 const changed=after.runners.flatMap(h=>h.items.filter(i=>i.item.startsWith('RANK')).flatMap(i=>{
  const j=before.runners.find(q=>q.slot===h.slot).items.find(q=>q.item===i.item);
  return eq(itemValue(i),itemValue(j))?[]:[{horse:h.slot,item:i.item,before:itemValue(j),after:itemValue(i),direct_root_ref:i.refs.includes(root)}];
 }));
 const changes=after.runners.flatMap(h=>h.routes_v39.flatMap(p=>{
  const q=before.runners.find(z=>z.slot===h.slot).routes_v39.find(z=>z.id===p.id);
  const view=z=>z?{WIN:z.WIN,PLACE:z.PLACE,candidate:z.candidate,envelope:z.envelope,axis_states:z.axes.map(a=>[a.axis,a.state])}:null;
  return eq(view(p),view(q))?[]:[{horse:h.slot,id:p.id,event:p.event,before:view(q),after:view(p)}];
 }));
 const grades=after.runners.map(h=>({horse:h.slot,before:before.runners.find(q=>q.slot===h.slot).research_grade,after:h.research_grade}));
 const unrelated=after.historical_scenarios.filter(s=>s.event!==target).every(s=>{
  const q=before.historical_scenarios.find(z=>z.id===s.id);
  const view=z=>z.edges.map(e=>[e.a,e.b,e.order,e.interval_ms]);
  return q&&eq(view(s),view(q));
 });
 // The admission experiment is scoped to this distinct incident and not
 // a general evidence ingestion policy. Do not claim a grade effect if absent.
 return {event,root,snapshot:after.source_digest,eye_enabled_both:true,positive_review:positive,counter_review:counter,
  admission:positive?'POSITIVE_INCIDENT_REVIEWED':counter?'COUNTER_INCIDENT_REVIEWED':'NOT_ADMITTED_BY_EYE_REVIEW',
  selected_grade:positive||counter?'RESTORED_RESEARCH_REVIEW':'WITHHELD_RESEARCH_REVIEW',
  selected_grades:(positive||counter?after:before).runners.map(h=>({horse:h.slot,grade:h.research_grade})),
  independent_positive:independentPositive.map(m=>({event:m.event,gain:m.gain,refs:m.refs})),counter:relevantCounter.map(m=>({event:m.event,gain:m.gain,refs:m.refs})),
  changed,changes,grades,unrelated,formal:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const V=await loadV38(),t=(id,f)=>{f();console.log(id+' PASS');};
 const full=analyzeV39(V,'FK34_FULL'),local=analyzeV39(V,'FK35_ACTIVE_NO_CHECKPOINT'),missing=analyzeV39(V,'FK35_ACTIVE_MISSING');
 t('F39-01',()=>{
  for(const x of [full,local,missing])for(const s of [...x.historical_scenarios,...x.conditional_scenarios]){
   if(!s.valid)continue;
   const oracle=orderOracle(x.roster.possible_active,s.edges);
   assert.ok(oracle.orders>0);
   assert.deepEqual(bounds(oracle.envelopes),bounds(s.field.envelopes));
   assert.deepEqual(bounds(jointField([...x.roster.possible_active].reverse(),[...s.edges].reverse(),2).envelopes),bounds(oracle.envelopes));
  }
 });
 t('F39-02',()=>{
  for(const x of [local,missing]){
   const measured=x.historical_scenarios.filter(s=>s.valid&&s.edges.filter(e=>e.interval_ms).length===6);
   assert.ok(measured.length>0);
   for(const s of measured){
    const original=full.historical_scenarios.find(z=>z.id===s.id);assert.ok(original);
    for(const e of s.edges){if(e.a===H(5)||e.b===H(5)){assert.equal(e.interval_ms,null);assert.equal(e.order,'UNKNOWN');}else assert.deepEqual(e.interval_ms,original.edges.find(z=>z.a===e.a&&z.b===e.b).interval_ms);}
    assert.deepEqual(bounds(s.field.envelopes).find(e=>e[0]===H(5)),[H(5),1,5]);
   }
   assert.ok(x.runners.every(h=>h.grade===null));
  }
 });
 const unknown=analyzeV39(V,'FK34_UNKNOWN');
 t('F39-03',()=>{
  assert.ok(unknown.roster.possible_active.includes(H(5)));assert.ok(!unknown.roster.known_active.includes(H(5)));
  const s=unknown.historical_scenarios[0];assert.ok(s);
  const p=participationOracle(unknown.roster,s.edges);
  assert.ok(p.some(q=>q.slots.includes(H(5)))&&p.some(q=>!q.slots.includes(H(5))));
  assert.ok(p.some(q=>q.envelopes.some(e=>e.slot===H(5)&&e.min===1)));
  assert.ok(unknown.runners.every(h=>h.research_grade===null));
  const cycle=[{a:'A',b:'B',order:'AHEAD'},{a:'A',b:'C',order:'BEHIND'},{a:'B',b:'C',order:'AHEAD'}];
  assert.equal(orderOracle(['A','B','C'],cycle).orders,0);
  assert.equal(jointField(['A','B','C'],cycle,2).state,'CONTRADICTED_SHARED_ORDER');
 });
 const context=analyzeV39(V,'FK35_CONTEXT_CHANGE');
 t('F39-04',()=>{
  const f=V.C.fixtures.find(f=>f.id==='FK34_FULL'),c=V.C.fixtures.find(f=>f.id==='FK35_CONTEXT_CHANGE');
  assert.deepEqual(f.docs.find(d=>d.eventId==='TEST:LONE'),c.docs.find(d=>d.eventId==='TEST:LONE'));
  assert.notDeepEqual(f.docs[0].conditions,c.docs[0].conditions);
  const a=full.historical_scenarios.filter(s=>s.event.endsWith('TEST:LONE')),b=context.historical_scenarios.filter(s=>s.event.endsWith('TEST:LONE'));
  assert.ok(a.some(s=>s.contextMatched));assert.ok(b.length&&b.every(s=>!s.contextMatched));
  assert.ok(context.runners.every(h=>h.routes_v39.filter(p=>p.event.endsWith('TEST:LONE')).every(p=>p.candidate===null)));
 });
 t('F39-05',()=>{
  assert.ok(full.runners.some(h=>h.routes_v39.some(p=>!p.replay&&p.candidate==='A')));
  assert.ok(full.runners.some(h=>h.routes_v39.some(p=>p.response_kind==='DEFICIT_OVERTAKEN')));
  const h3=full.runners.find(h=>h.slot===H(3));
  const f=V.C.fixtures.find(f=>f.id==='FK34_FULL');
  assert.ok(f.docs.filter(d=>d.kind==='HISTORICAL_RESULT').every(d=>d.rows.find(r=>r.nativeId==='TEST:H3').finish>1));
  assert.ok(h3.routes_v39.some(p=>p.id.startsWith('GAP_STRESS:')&&p.candidate==='A'),'NONWINNER_CONDITIONAL_WIN');
  assert.ok(h3.research_grade==='A');
  for(const x of [full,local,missing,unknown,context]){
   assert.equal(x.groups,118);assert.equal(x.held,826);
   for(const h of x.runners){assert.equal(h.items.length,115);assert.equal(h.grade,null);assert.equal(h.current_grade,null);
    for(const p of h.routes_v39){assert.equal(p.axes.length,5);assert.equal(p.observed_current,false);if(p.candidate){assert.equal(p.blocked.length,0);assert.ok(p.refs.length);}}
   }
  }
 });
 const eye=auditEyeRoot(V,'FK35_EYE','TEST:DISCOVERED'),counter=auditEyeRoot(V,'FK35_EYE_COUNTER','TEST:NEW_COUNTER');
 t('F39-06',()=>{
  assert.ok(eye.unrelated&&counter.unrelated);
  assert.ok(eye.changes.length&&counter.changes.length);
  assert.ok(eye.eye_enabled_both&&counter.eye_enabled_both);
  assert.equal(eye.formal,false);assert.equal(counter.formal,false);
  // Audit admission and semantic effects independently; no forced grade delta.
  assert.ok(!counter.positive_review||counter.independent_positive.length);
 });
 const brief=x=>({id:x.id,grades:x.runners.map(h=>({horse:h.slot,grade:h.research_grade,paths:h.routes_v39.filter(p=>!p.replay).map(p=>({id:p.id,event:p.event,grade:p.candidate,WIN:p.WIN,PLACE:p.PLACE,kind:p.response_kind,axes:p.axes.map(a=>[a.axis,a.state]),blocked:p.blocked}))}))});
 const eb=e=>({...e,changed:e.changed.map(i=>({horse:i.horse,item:i.item,direct_root_ref:i.direct_root_ref})),changes:e.changes});
 console.log('V39_RECEIPT '+JSON.stringify({full:brief(full),context:brief(context),unknown:brief(unknown),eye:eb(eye),counter:eb(counter)}));
}
