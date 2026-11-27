// V42 research: route construction consumes V41 local comparisons rather than V40 candidate labels.
// Fixed synthetic observations only. No market, point tally, rank quota, formal grade or future observation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {loadV40} from './work36-v40-integrated.mjs';
import {analyze as analyzeV41,admission,leakAudit} from './work36-v41-local-decision.mjs';
import {jointField} from './work29-v30-terminal.mjs';
import {jointClockFeasibility} from './work30-v31-integrated.mjs';
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),uniq=a=>[...new Set(a)].sort();
const H=n=>'TEST:NAR|TEST:H'+n;
const id=h=>h.split('|').at(-1);
const t=(n,f)=>{f();console.log(n+' PASS');};
const interval=(a,b,u)=>[b-a-u,b-a+u];
const order=z=>!z?'UNKNOWN':z[0]>0?'AHEAD':z[1]<0?'BEHIND':'UNKNOWN';
const roots=(...xs)=>uniq(xs.flat());
const fieldOrder=(roster,edges,threshold)=>jointField(roster,edges.map(e=>({a:e.a,b:e.b,order:e.order})),threshold);
const fields={distance_m:'RANK43',venue:'RANK45',surface:'RANK47',going:'RANK48',class_label:'RANK33',class_version:'RANK33',direction:'RANK49',first_turn_m:'RANK67',straight_m:'RANK50',course_version:'RANK52',checkpoints_m:'RANK44',gate:'RANK53',weightG:'RANK54'};
function compatibleWindow(a,b){
 return a.checkpoint===b.checkpoint&&a.distance-a.checkpoint===b.distance-b.checkpoint&&
  a.shared.every((q,i)=>q.dimension===b.shared[i]?.dimension&&eq(q.past,b.shared[i].past));
}
function pace(a,b){
 const pa=a.leader,pb=b.leader;
 if(!pa||!pb||!Number.isFinite(a.precision)||!Number.isFinite(b.precision))return {state:'UNKNOWN',segments:[]};
 const k=pa.distances_m?.indexOf(a.checkpoint),j=pb.distances_m?.indexOf(b.checkpoint);
 if(k<1||j<1||k!==j||!eq(pa.distances_m.slice(0,k+1),pb.distances_m.slice(0,j+1)))return {state:'UNKNOWN',segments:[]};
 const segments=Array.from({length:k},(_,i)=>{
  const x=pa.elapsed_ms[i+1]-pa.elapsed_ms[i],y=pb.elapsed_ms[i+1]-pb.elapsed_ms[i],bound=(i===0?1:2)*(a.precision+b.precision);
  return {from:pa.distances_m[i],to:pa.distances_m[i+1],a:x,b:y,bound,overlap:Math.abs(x-y)<=bound};
 });
 return {state:segments.every(s=>s.overlap)?'OVERLAPPING_OBSERVED_PACE':'OBSERVED_PACE_DIFFERS',segments};
}
// Literal clocks are used ONLY for already verified, measured V41 pair rows;
// denied events never enter history. Build a full vector from one response
// incident, never cherry-pick each pair from different events.
function route(x,docs,a,b,threshold){
 const roster=x.roster.possible_active,da=docs.find(d=>d.eventId===id(a.event)),db=docs.find(d=>d.eventId===id(b.event));
 const ka=da.geometry.checkpoints_m.indexOf(a.checkpoint),kb=db.geometry.checkpoints_m.indexOf(b.checkpoint);
 const p=pace(a,b),same=a.event===b.event;
 const shared=a.shared.concat(b.shared).filter(q=>q.state!=='MATCHED');
 const edges=b.edges.map(e=>{
  const z=a.edges.find(q=>q.a===e.a&&q.b===e.b),ar=da.rows.find(r=>r.nativeId===id(e.a)),br=da.rows.find(r=>r.nativeId===id(e.b)),cr=db.rows.find(r=>r.nativeId===id(e.a)),dr=db.rows.find(r=>r.nativeId===id(e.b));
  const complete=ka>=0&&kb>=0&&[ar?.checkpointMs?.[ka],br?.checkpointMs?.[ka],cr?.checkpointMs?.[kb],dr?.checkpointMs?.[kb],cr?.clockMs,dr?.clockMs,a.precision,b.precision].every(Number.isFinite);
  const measured=!!(complete&&z?.measured&&e.measured&&a.sourceValid&&b.sourceValid);
  const initial=measured?interval(ar.checkpointMs[ka],br.checkpointMs[ka],2*a.precision):null;
  const baseGap=measured?dr.checkpointMs[kb]-cr.checkpointMs[kb]:null;
  const end=measured?dr.clockMs-cr.clockMs:null,gain=measured?end-baseGap:null;
  const gainBound=measured?4*b.precision:null;
  const transferred=measured?[initial[0]+gain-gainBound,initial[1]+gain+gainBound]:null;
  // Same-event replay uses actual finish interval, not duplicated measurement uncertainty.
  const finish=measured?(same?[end-2*b.precision,end+2*b.precision]:transferred):null;
  const responseStart=measured?interval(cr.checkpointMs[kb],dr.checkpointMs[kb],2*b.precision):null;
  const roleConflict=!!(initial&&responseStart&&order(initial)!=='UNKNOWN'&&order(responseStart)!=='UNKNOWN'&&order(initial)!==order(responseStart));
  const changed=uniq([...a.fieldChanged,...b.fieldChanged]),fieldInteraction=changed.filter(h=>h!==e.a&&h!==e.b);
  const direct=measured&&z.unaffected&&e.unaffected&&!shared.length&&compatibleWindow(a,b)&&!roleConflict&&p.state==='OVERLAPPING_OBSERVED_PACE';
  // All opponent interactions must be accounted for before a full transfer
  // claim; locally valid response remains inspectable even if field held.
  const full=direct&&!fieldInteraction.length&&a.rosterMatched&&b.rosterMatched&&x.roster.known_active.length===roster.length;
  return {a:e.a,b:e.b,initial,gain,gainBound,finish,measurement:measured,local:direct,full,
   order:direct?order(finish):'UNKNOWN',fieldOrder:full?order(finish):'UNKNOWN',
   roleConflict,fieldInteraction,refs:roots(z?.refs??[],e.refs),scope:full?'MATCHED_FIELD_CONDITIONAL_RESPONSE':direct?'LOCAL_RESPONSE_FIELD_INTERACTION_HELD':'DEPENDENT_TRANSFER_HELD'};
 });
 const local=fieldOrder(roster,edges,threshold);
 const fullEdges=edges.map(e=>({...e,order:e.fieldOrder}));
 const field=fieldOrder(roster,fullEdges,threshold);
 const numeric=jointClockFeasibility(roster,fullEdges.filter(e=>e.full&&e.finish).map(e=>({a:e.a,b:e.b,delta:(e.finish[0]+e.finish[1])/2,bound:(e.finish[1]-e.finish[0])/2,refs:e.refs})));
 const valid=field.state!=='CONTRADICTED_SHARED_ORDER'&&numeric.state!=='CONTRADICTED_NUMERIC_DIFFERENCES';
 return {id:a.id+'>'+b.id,start:a.event,response:b.event,checkpoint:a.checkpoint,remaining:a.distance-a.checkpoint,replay:same,pace:p,edges,local,field,numeric,valid,
  context:shared.length?'CHANGED_SHARED_CONDITIONS':'REPORTED_SHARED_CONDITIONS_MATCH',
  actual_current:'UNPROVEN',formal:false};
}
function oriented(e,h){
 const s=e.a===h?1:-1;
 // Clock bounds are measured differences in milliseconds. Preserve all
 // endpoints while giving zero a single representation in either orientation.
 const rev=x=>!x?null:(s===1?x:[-x[1],-x[0]]).map(v=>v===0?0:v);
 const initial=rev(e.initial),finish=rev(e.finish),gain=e.gain===null?null:e.gain*s;
 return {rival:s===1?e.b:e.a,initial,finish,gain,gainBound:e.gainBound,scope:e.scope,local:e.local,full:e.full,
  recovered:!!(initial&&finish&&initial[1]<0&&finish[0]>0&&gain>e.gainBound),
  retained:!!(initial&&finish&&initial[0]>0&&finish[0]>0),
  lost:!!(initial&&finish&&initial[0]>0&&finish[1]<0),refs:e.refs};
}
// Derive positive condition-return evidence from V41 measured contrasts:
// a favorable observed result under the actual target condition, adverse
// result under a different condition, no claim of isolated causality.
function discoveries(h,x,routes){
 const history=x.history_v41;
 const candidates=h.contrast.flatMap(c=>{
  if(!c.reversal)return [];
  const rows=c.events.map(ev=>history.find(s=>s.event===ev&&s.checkpoint===c.checkpoint));
  const i=c.finish.findIndex(z=>z[0]>0),j=1-i;
  if(i<0||!rows[i]||!rows[j])return [];
  const matched=rows[i].edges.find(e=>[e.a,e.b].includes(h.horse)&&[e.a,e.b].includes(c.rival));
  if(!matched?.unaffected)return [];
  const adverse=rows[j].edges.find(e=>[e.a,e.b].includes(h.horse)&&[e.a,e.b].includes(c.rival));
  if(!adverse||adverse.unaffected)return [];
  const favorable=rows[i].shared.every(q=>q.state==='MATCHED');
  if(!favorable)return [];
  const groups=[];
  if(c.changed.some(k=>['distance_m','going','surface','gate','weightG'].includes(k)))groups.push('EYE07');
  if(c.changed.some(k=>['venue','straight_m','course_version','direction','first_turn_m'].includes(k)))groups.push('EYE08');
  return groups.map(item=>({item,kind:'MATCHED_CONDITION_OBSERVED_REVERSAL',horse:h.horse,rival:c.rival,event:c.events[i],counterEvent:c.events[j],checkpoint:c.checkpoint,finish:c.finish[i],counterFinish:c.finish[j],refs:c.refs,scope:'CONDITIONAL_ASSOCIATION_NOT_CAUSAL',targets:uniq(['RANK35',...c.changed.map(k=>fields[k]).filter(Boolean),'RANK100'])}));
 });
 // EYE03 actual upstream shared positive return; tie each incident to the
 // route's response, not a blanket bonus.
 const upstream=x.runners.find(q=>q.slot===h.horse);
 const existing=(upstream?.findings_v33??[]).filter(f=>f.item==='RANK18'&&f.eye_id).flatMap(f=>(f.observation?.measurements??[]).filter(m=>m.supported).map(m=>({item:'EYE03',kind:'SHARED_RECOVERY_RETURN',horse:h.horse,rival:f.observation.rival,event:m.event,checkpoint:m.checkpoint_m,refs:m.refs,scope:'CONDITIONAL_RECOVERY',targets:['RANK18','RANK21','RANK100'],counterEvents:(f.observation.counterexamples??[]).map(q=>q.event)})));
 const counter=(upstream?.findings_v33??[]).filter(f=>f.item==='RANK18'&&f.eye_id).flatMap(f=>(f.observation?.counterexamples??[]).map(m=>({item:'EYE03',kind:'SHARED_RECOVERY_COUNTER',horse:h.horse,rival:f.observation.rival,event:m.event,checkpoint:m.checkpoint_m,refs:m.refs,scope:'MEASURED_COUNTER_TO_RECOVERY',targets:['RANK18','RANK21','RANK100']})));
 const all=[...candidates,...existing,...counter];
 const unique=new Map();
 for(const q of all){const k=JSON.stringify([q.item,q.kind,q.horse,q.rival??null,q.event,q.counterEvent??null,q.checkpoint??null]);if(!unique.has(k))unique.set(k,{...q,refs:uniq(q.refs)});else{const prior=unique.get(k);unique.set(k,{...prior,refs:roots(prior.refs,q.refs)});}}
 return [...unique.values()];
}
function assess(h,r,eye,threshold,feedback=[]){
 const own=r.edges.filter(e=>e.a===h||e.b===h).map(e=>oriented(e,h));
 const e=r.field.envelopes.find(q=>q.slot===h),l=r.local.envelopes.find(q=>q.slot===h);
 const active=!!e&&r.valid,full=active&&own.every(q=>q.full);
 const fullWin=full&&e.max===1,fullPlace=full&&e.max<=threshold,fullCounter=full&&e.min>threshold;
 const localEvidence=own.filter(q=>q.local),positive=own.filter(q=>q.recovered||q.retained),negative=own.filter(q=>q.lost);
 const found=eye.filter(q=>q.event===r.response&&(q.checkpoint===undefined||q.checkpoint===r.checkpoint));
 const relevance=found.map(q=>({...q,explicitCounter:q.kind==='SHARED_RECOVERY_COUNTER',effective:q.kind!=='SHARED_RECOVERY_COUNTER'&&own.some(p=>p.full&&p.finish?.[0]>0&&(!q.rival||p.rival===q.rival))}));
 const axes=[
  {axis:'A',support:own.filter(q=>q.full&&q.finish?.[0]>0),counter:own.filter(q=>q.full&&q.finish?.[1]<0),unknown:own.filter(q=>!q.full),refs:roots(...own.map(q=>q.refs))},
  {axis:'B',support:localEvidence,counter:[],unknown:own.filter(q=>!q.full),facts:{context:r.context,pace:r.pace,checkpoint:r.checkpoint,remaining:r.remaining},refs:roots(...own.map(q=>q.refs))},
  {axis:'C',support:fullWin||fullPlace?[e]:[],counter:fullCounter?[e]:[],unknown:!full||!fullPlace&&!fullCounter?[l]:[],refs:roots(...r.edges.map(q=>q.refs))},
  {axis:'D',support:positive,counter:negative,unknown:own.filter(q=>!q.full||!q.initial),refs:roots(...own.map(q=>q.refs))},
  {axis:'E',support:relevance.filter(q=>q.effective),counter:relevance.filter(q=>q.explicitCounter),unknown:relevance.length?relevance.filter(q=>!q.effective&&!q.explicitCounter):['NO_ADDITIONAL_RELEVANT_DISCOVERY'],refs:roots(...relevance.map(q=>q.refs))}
 ];
 // Material effect: applicable matched whole-field response and explicit
 // demonstrated response to deficit/advantage. EYE is not a second vote.
 const winResponse=own.every(q=>q.recovered||q.retained||q.finish?.[0]>0&&q.initial?.[0]<=0&&q.initial?.[1]>=0);
 // Each required axis has a directional, route-specific role. Discovery
 // corroborates the relevant response or exposes a contradiction; absence of
 // new discovery is not negative evidence. Do not add discovery as a vote.
 const [A,B,C,D,E]=axes;
 const contradiction=E.support.some(q=>E.counter.some(v=>q.item===v.item&&q.event===v.event&&q.rival===v.rival));
 const basis={ability:A.support.length>0&&A.unknown.length===0,applicability:B.unknown.length===0&&r.pace.state==='OVERLAPPING_OBSERVED_PACE',comparison:C.support.length>0,response:D.unknown.length===0&&winResponse,discovery:!contradiction};
 const winGate=Object.values(basis).every(Boolean);
 const placeGate=basis.ability&&basis.applicability&&basis.comparison&&D.unknown.length===0&&positive.length>0&&basis.discovery;
 const counterGate=full&&A.counter.length>0&&C.counter.length>0&&D.unknown.length===0&&basis.discovery;
 const conditionalDecision=fullWin&&winGate?'CONDITIONAL_WIN':fullPlace&&placeGate?'CONDITIONAL_PLACE':fullCounter&&counterGate?'CONDITIONAL_COUNTER':'HELD';
 // The Work42-selected EYE03 kernel already recomputed a joint field
 // envelope including every matched adverse event. Re-review a dependent
 // recovery route against that bound; never replace its original scenario.
 const recoveryReviews=feedback.filter(f=>f.subject===h&&f.before.event===r.start+'@'+r.checkpoint&&own.some(q=>q.rival===f.rival&&q.recovered)).map(f=>({rival:f.rival,before:f.before.envelope,after:f.after.envelope,state:f.state,refs:f.refs}));
 const required=conditionalDecision==='CONDITIONAL_WIN'?1:conditionalDecision==='CONDITIONAL_PLACE'?threshold:null;
 const held=required!==null&&recoveryReviews.some(f=>!f.after||f.after.max>required||f.state!=='CONDITIONAL_RECOVERY_SUPPORTED_AFTER_COUNTER_REVIEW');
 const decision=held?'HELD':conditionalDecision;
 if(held){
  C.unknown=[...C.unknown,...C.support];C.support=[];
  D.unknown=[...D.unknown,...D.support];D.support=[];
  E.counter=[...E.counter,...recoveryReviews];E.refs=roots(E.refs,...recoveryReviews.map(q=>q.refs));
  basis.discovery=false;
 }
 return {id:r.id,checkpoint:r.checkpoint,remaining:r.remaining,start:r.start,response:r.response,replay:r.replay,decision,...(recoveryReviews.length?{conditionalDecision,recoveryReviews}:{}),axes,basis,field:e??null,local:l??null,full,own,
  actual_current:'UNPROVEN',formal:false};
}
export function integrate(x,docs,{eyeEnabled=true}={}){
 const hs=x.history_v41,threshold=x.placeThreshold??2;
 const routes=hs.flatMap(a=>hs.filter(b=>compatibleWindow(a,b)).map(b=>route(x,docs,a,b,threshold)));
 const runners=x.runners_v41.map(h=>{
  const eye=eyeEnabled?discoveries(h,x,routes):[],rr=routes.map(r=>assess(h.horse,r,eye,threshold,eyeEnabled&&x.work42ReturnApplied?(x.feedback??[]):[]));
  const items=h.items.map(i=>{
   const changed=hs.flatMap(s=>(s.individual[h.horse]??[]).concat(s.shared).filter(q=>fields[q.dimension]===i.item&&q.state!=='MATCHED').map(q=>({event:s.event,dimension:q.dimension,past:q.past,current:q.current,delta:q.delta,state:q.state,refs:q.refs})));
   const effects=eye.filter(q=>q.targets.includes(i.item));
   const routeFacts=i.item==='RANK100'?rr.map(p=>({id:p.id,decision:p.decision,local:p.local,field:p.field,...(x.work42ReturnApplied?{conditionalDecision:p.conditionalDecision,recoveryReviews:p.recoveryReviews}:{} )})):i.item==='RANK35'?rr.flatMap(p=>p.own.filter(e=>e.local).map(e=>({route:p.id,rival:e.rival,finish:e.finish,scope:e.scope}))):[];
   return {...i,v42:{changed,effects,routeFacts,scope:'RESEARCH_CONSUMED_NOT_FORMAL'}};
  });
  // The research judgement distinguishes conditional route evidence from
  // supported current applicability. No fabricated coverage or grade.
  const win=rr.filter(p=>!p.replay&&p.decision==='CONDITIONAL_WIN'),place=rr.filter(p=>!p.replay&&['CONDITIONAL_PLACE','CONDITIONAL_WIN'].includes(p.decision));
  const counter=rr.filter(p=>p.decision==='CONDITIONAL_COUNTER'),held=rr.filter(p=>p.decision==='HELD');
  const coherent=(p,claim)=>{
   const related=rr.filter(q=>q.start===p.start&&q.checkpoint===p.checkpoint);
   const adverse=related.filter(q=>q.decision==='HELD'||q.decision==='CONDITIONAL_COUNTER'||(claim==='WIN'&&q.decision!=='CONDITIONAL_WIN'));
   return {id:p.id,adverse:adverse.map(q=>q.id),supported:!adverse.length&&related.some(q=>q.replay)};
  };
  const winReview=win.map(p=>coherent(p,'WIN')),placeReview=place.map(p=>coherent(p,'PLACE'));
  const conditional=winReview.some(q=>q.supported)?'A':placeReview.some(q=>q.supported)?'B':null;
  return {horse:h.horse,items,eye,paths:rr,conditional_grade:conditional,research_grade:conditional,research_scope:'HISTORICAL_ANTECEDENT_CONDITIONAL_ONLY',current_grade:null,grade:null,formal:false,
   reasons:{win:winReview,place:placeReview,counter:counter.map(q=>q.id),held:held.map(q=>q.id),S:'CURRENT_SUPPORT_AND_ROBUSTNESS_NOT_PROVEN',C:'CURRENT_DISADVANTAGE_NOT_PROVEN',unknown:['CURRENT_FORM','CURRENT_ROLE_AND_PACE_APPLICABILITY','CURRENT_SCENARIO_COVERAGE']}};
 });
 return {id:x.id,digest:x.source_digest,routes,runners,formal:false,grade:null,threshold};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const V=await loadV40(),all=[];
for(const f of V.C.fixtures.filter(f=>f.id!=='W36_MASTER_IMMUTABLE')){
 const x=analyzeV41(V,f.id);all.push({base:x,z:integrate(x,f.docs)});
}
const get=n=>all.find(q=>q.z.id===n);
t('F42-01',()=>{
 assert.equal(all.length,25);assert.equal(all.reduce((n,q)=>n+q.base.source_packet.evidence.length,0),8190);
 for(const {base,z} of all){assert.equal(base.groups,118);assert.equal(base.held,826);assert.equal(z.digest,V.fixed.get(z.id).pin.source_digest);assert.ok(z.runners.every(h=>h.items.length===115&&h.grade===null));}
});
t('F42-02',()=>{
 for(const [name,expected] of [['W36_CONTEXT_WEIGHT',6],['W36_CONTEXT_GATE',3]]){
  const q=get(name),r=q.z.routes.find(r=>r.replay&&r.edges.some(e=>e.local));assert.ok(r);
  assert.equal(r.edges.filter(e=>e.local).length,expected);
  assert.equal(r.edges.filter(e=>e.full).length,0);
  assert.ok(q.z.runners.some(h=>h.paths.some(p=>p.id===r.id&&p.axes[1].support.length)));
  assert.ok(q.z.runners.some(h=>h.items.find(i=>i.item==='RANK35').v42.routeFacts.length));
 }
});
t('F42-03',()=>{
 const q=get('FK34_FULL');
 assert.deepEqual(uniq(q.z.routes.map(r=>String(r.checkpoint))),['1200','200','800']);
 for(const r of q.z.routes)for(const e of r.edges.filter(e=>e.measurement)){
  assert.ok(e.finish&&e.finish[0]<=e.finish[1]);
  if(!r.replay)assert.equal(e.finish[1]-e.finish[0],e.initial[1]-e.initial[0]+2*e.gainBound);
  assert.equal(e.order,e.local?order(e.finish):'UNKNOWN');
 }
});
t('F42-04',()=>{
 const q=get('W36_OTHER_COUNTER');
 assert.ok(q.z.runners.some(h=>h.eye.some(e=>e.item==='EYE07'&&e.kind==='MATCHED_CONDITION_OBSERVED_REVERSAL')));
 for(const h of q.z.runners)for(const e of h.eye)for(const target of e.targets){assert.ok(h.items.find(i=>i.item===target)?.v42.effects.some(f=>f.event===e.event));}
});
const baseIds=new Set(V.generated.find(g=>g.f.id==='W36_BASE').f.docs.map(d=>d.eventId));
const candidate=V.master.f.docs.filter(d=>d.kind==='HISTORICAL_RESULT'&&!baseIds.has(d.eventId)).map(d=>d.eventId);
const masks=[[],candidate.slice(0,2),[candidate[2]],candidate.slice(0,3),[...candidate.slice(0,2),candidate[3]]].map(a=>{const m=admission(V,a);return {m,z:integrate(m.x,V.master.f.docs)};});
t('F42-05',()=>{
 for(const {m,z} of masks){
  assert.equal(z.digest,masks[0].z.digest);const audit=leakAudit({...m.x,v42:z});assert.equal(audit.leaks.length,0);assert.equal(audit.events.length,0);assert.equal(audit.broken.length,0);
 }
 const b=masks[0].z.runners.find(h=>h.horse===H(4)),p=masks[1].z.runners.find(h=>h.horse===H(4));
 assert.ok(p.eye.some(e=>e.item==='EYE03'));
 assert.ok(p.paths.some(q=>!q.replay&&q.decision==='CONDITIONAL_WIN'&&!b.paths.some(z=>z.id===q.id)));
});
t('F42-06',()=>{
 for(const {z} of all)for(const h of z.runners){
  for(const p of h.paths)if(p.decision!=='HELD'){assert.ok(p.full);assert.equal(p.axes.length,5);}
  assert.equal(h.research_grade,h.conditional_grade);assert.equal(h.current_grade,null);if(h.research_grade==='A')assert.ok(h.reasons.win.some(q=>q.supported));if(h.research_grade==='B'){assert.ok(!h.reasons.win.some(q=>q.supported));assert.ok(h.reasons.place.some(q=>q.supported));}
 }
 const q=get('FK34_UNKNOWN');assert.ok(q.z.runners.every(h=>h.conditional_grade===null));
});
t('F42-07',()=>{
 const q=get('FK34_FULL'),docs=V.C.fixtures.find(f=>f.id===q.z.id).docs;
 for(const r of q.z.routes){
  const a=docs.find(d=>d.eventId===id(r.start)),b=docs.find(d=>d.eventId===id(r.response));
  const j=a.geometry.checkpoints_m.indexOf(r.checkpoint),k=b.geometry.checkpoints_m.indexOf(r.checkpoint);
  for(const e of r.edges.filter(e=>e.measurement)){
   const [u,v]=[e.a,e.b].map(h=>a.rows.find(q=>q.nativeId===id(h)));
   const [w,z]=[e.a,e.b].map(h=>b.rows.find(q=>q.nativeId===id(h)));
   const mid=r.replay?z.clockMs-w.clockMs:(v.checkpointMs[j]-u.checkpointMs[j])+(z.clockMs-w.clockMs)-(z.checkpointMs[k]-w.checkpointMs[k]);
   const bound=r.replay?2*b.precisionMs:2*a.precisionMs+4*b.precisionMs;
   assert.deepEqual(e.finish,[mid-bound,mid+bound]);
  }
  const forward=fieldOrder(q.base.roster.possible_active,r.edges.map(e=>({...e,order:e.fieldOrder})),q.z.threshold);
  const reversed=fieldOrder([...q.base.roster.possible_active].reverse(),[...r.edges].reverse().map(e=>({...e,order:e.fieldOrder})),q.z.threshold);
  for(const e of forward.envelopes){const v=reversed.envelopes.find(q=>q.slot===e.slot);assert.deepEqual([e.min,e.max],[v.min,v.max]);}
 }
});
t('F42-08',()=>{
 const h=n=>masks[n].z.runners.find(q=>q.horse===H(4));
 const routeId='TEST:NAR|TEST:COUNTER@800>TEST:NAR|TEST:W36_POS_B@800';
 const b=h(0).paths.find(p=>p.id===routeId),p=h(1).paths.find(p=>p.id===routeId),o=h(4).paths.find(p=>p.id===routeId);
 assert.equal(b,undefined);assert.ok(p&&o);
 assert.equal(p.decision,'CONDITIONAL_WIN');assert.equal(o.decision,p.decision);
 const pair=p.own.find(e=>e.rival===H(2));assert.deepEqual(pair.finish,[1000,1600]);
 const support=p.axes.find(a=>a.axis==='E').support.filter(e=>e.item==='EYE03');
 for(const rival of [H(1),H(5)])assert.ok(support.some(e=>e.rival===rival&&e.event===p.response&&e.checkpoint===p.checkpoint));
 // A route-specific transfer is weaker than recovery across the largest observed deficit.
 const responseDocs=V.master.f.docs.filter(d=>candidate.slice(0,2).includes(d.eventId));
 const measured=responseDocs.map(d=>{
  const subject=d.rows.find(row=>row.nativeId===id(H(4))),rival=d.rows.find(row=>row.nativeId===id(H(2)));
  const checkpoint=d.geometry.checkpoints_m.indexOf(p.checkpoint);
  assert.ok(checkpoint>=0);
  const deficit=subject.checkpointMs[checkpoint]-rival.checkpointMs[checkpoint];
  const finish=rival.clockMs-subject.clockMs;
  assert.ok(deficit>2*d.precisionMs&&finish>2*d.precisionMs);
  return {deficit,lowerGain:finish+deficit-4*d.precisionMs};
 });
 assert.equal(measured.length,2);
 assert.equal(Math.min(...measured.map(m=>m.lowerGain))-Math.max(...measured.map(m=>m.deficit)),-400);
 assert.ok(!support.some(e=>e.rival===H(2)));
 assert.deepEqual(o.own.map(e=>e.finish),p.own.map(e=>e.finish));
 assert.ok(h(3).paths.some(q=>q.response.endsWith('W36_COUNTER_MATCHED')&&q.decision==='CONDITIONAL_COUNTER'));
 assert.ok(p.basis.discovery&&p.basis.ability&&p.basis.applicability&&p.basis.comparison&&p.basis.response);
});
t('F42-09',()=>{
 const {base,z}=get('W36_OTHER_COUNTER');
 for(const h of base.runners_v41){
  const a=discoveries(h,base,z.routes);
  const duplicate={...base,runners:base.runners.map(q=>({...q,findings_v33:[...(q.findings_v33??[]),...(q.findings_v33??[])]}))};
  const b=discoveries({...h,contrast:[...h.contrast,...h.contrast]},duplicate,z.routes);
  assert.deepEqual(a,b,'DUPLICATE_FINDING_MUST_NOT_DOUBLE_COUNT');
 }
 const h=masks[3].z.runners.find(q=>q.horse===H(4));
 assert.ok(h.eye.some(e=>e.kind==='SHARED_RECOVERY_COUNTER'&&e.event.endsWith('W36_COUNTER_MATCHED')));
 assert.ok(h.paths.some(p=>p.response.endsWith('W36_COUNTER_MATCHED')&&p.axes.find(a=>a.axis==='E').counter.length));
});
t('F42-10',()=>{
 const read=(n,blob,sha)=>{
  const b=readFileSync(new URL('./work37-pinned/'+n,import.meta.url));
  assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),blob);
  if(sha)assert.equal(createHash('sha256').update(b).digest('hex'),sha);
  return JSON.parse(b);
 };
 const handoff=read('stage37-final-handoff-v0.1.json','95aa9c8906aef6a6398e3f749f3bd19e8632c780');
 const pin=read('work36-independent-pins-v0.1.json','ca1ad8f0a2059f0226cfdb7f78122ddce39cca27','0811e22bac17e6c49ff13b91747cc96e55042e7496e4be3f39ed438c99cf9e13');
 const h3=read('work36-original-crosscheck-h3-v0.1.json','b6b0a5979b0f13c100bd1721c4b6d71618498da6','caec36b32fc37075f6057cea2cc9bbf1818d931d3d82972309fe13da88c84b8b');
 assert.equal(handoff.priorWorkLedger,699);assert.equal(handoff.addedWorkTests,0);assert.equal(pin.cases.length,16);
 assert.equal(pin.cases.filter(p=>p.id==='W36_MASTER_IMMUTABLE').length,1);
 assert.deepEqual(pin.cases.map(p=>p.id).sort(),V.generated.map(g=>g.p.id).sort());
 for(const p of pin.cases){
  const g=V.generated.find(q=>q.p.id===p.id);assert.ok(g);
  for(const k of ['source_digest','bundle_sha256','evidence'])assert.equal(g.p[k],p[k]);
  assert.deepEqual(g.f.docs.map(d=>d.eventId),p.event_ids);
  for(const e of p.root_map){
   const a=g.out.packet.evidence.find(q=>q.evidenceId===e.id);assert.ok(a);
   for(const k of ['event','subject','field','root','dependencies'])assert.deepEqual(a[k],e[k]);
  }
 }
 assert.equal(handoff.cases.length,25);
 for(const p of handoff.cases){const a=get(p.id);assert.equal(a.z.digest,p.digest);assert.equal(a.base.source_packet.evidence.length,p.evidence);}
 const h=get('FK34_FULL').z.runners.find(q=>q.horse===H(3));
 assert.equal(h3.cross.length,20);
 for(const q of h3.cross){
  const r=h.paths.find(p=>p.checkpoint===800&&id(p.start)===q.start&&id(p.response)===q.response);assert.ok(r);
  for(const e of q.edges){const a=r.own.find(p=>id(p.rival)===e.rival);assert.deepEqual(a.finish,e.interval);}
  assert.equal(r.own.every(p=>p.finish&&p.finish[0]>0),false);
 }
 console.log('V42_WORK37_INDEPENDENT_CHECK '+JSON.stringify({fixturePackets:15,masterPackets:1,casePins:25,H3Cross:20,H3PairIntervals:80,clearWins:0,scope:'RECORDED_800M_CROSSES_ONLY'}));
});
const compact=z=>({id:z.id,digest:z.digest,routes:z.routes.map(r=>({id:r.id,checkpoint:r.checkpoint,remaining:r.remaining,local:r.edges.filter(e=>e.local).length,full:r.edges.filter(e=>e.full).length,valid:r.valid})),runners:z.runners.map(h=>({horse:h.horse,conditional:h.conditional_grade,eye:h.eye,reason:h.reasons,paths:h.paths.map(p=>({id:p.id,decision:p.decision,field:p.field&&[p.field.min,p.field.max],local:p.local&&[p.local.min,p.local.max],axes:p.axes.map(a=>({axis:a.axis,support:a.support.length,counter:a.counter.length,unknown:a.unknown.length}))}))}))});
for(const {z} of all)console.log('V42_CASE '+JSON.stringify(compact(z)));
for(const {m,z} of masks)console.log('V42_MASK '+JSON.stringify({admitted:m.admitted,result:compact(z)}));

}
