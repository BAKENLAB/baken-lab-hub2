// V41 partial research: localized condition response and generic all-runner EYE provenance.
// Fixed synthetic evidence only. No formal grade, score, odds or current observation inference.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadV40,analyze as analyzeV40} from './work36-v40-integrated.mjs';
import {jointField} from './work29-v30-terminal.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const uniq=x=>[...new Set(x)].sort();
const H=n=>'TEST:NAR|TEST:H'+n;
const t=(id,f)=>{f();console.log(id+' PASS');};
const dims=['distance_m','venue','surface','going','class_label','class_version'];
const geo=['direction','first_turn_m','straight_m','course_version','checkpoints_m'];
const ownDims=['gate','weightG'];
const idOf=h=>h.split('|').at(-1);
const eventOf=s=>s.event.split('|').at(-1);
const state=(a,b)=>a==null||b==null?'UNKNOWN':eq(a,b)?'MATCHED':'CHANGED';
const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?b-a:null;
const sourceRefs=(p,event,subject,fields)=>p.evidence.filter(e=>e.event===event&&e.subject===subject&&fields.includes(e.field)).map(e=>e.evidenceId);
function compare(a,b,keys,refs){return keys.map(k=>({dimension:k,past:a?.[k]??null,current:b?.[k]??null,state:state(a?.[k],b?.[k]),delta:delta(a?.[k],b?.[k]),refs}));}
const refFields={gate:['gate_number'],weightG:['weight_grams']};
function rowContrast(p,d,c,h){
 const a=d.rows.find(r=>r.nativeId===h),b=c.rows.find(r=>r.nativeId===h);
 return ownDims.flatMap(k=>compare(a,b,[k],uniq([...sourceRefs(p,d.eventId,h,refFields[k]),...sourceRefs(p,c.eventId,h,refFields[k])])));
}
// Use actual verified shared pair intervals; do not infer response to a change
// simply from its sign. Each change has its own observable contrast.
function localScenarios(x,docs){
 const card=docs.find(d=>d.kind==='TARGET_CARD'),p=x.source_packet,roster=x.roster.possible_active;
 return x.historical_scenarios.map(s=>{
  const d=docs.find(d=>d.eventId===eventOf(s));assert.ok(d);
  const shared=compare(d.conditions,card.conditions,dims,uniq([...sourceRefs(p,d.eventId,null,['conditions']),...sourceRefs(p,card.eventId,null,['conditions'])])).concat(compare(d.geometry,card.geometry,geo,uniq([...sourceRefs(p,d.eventId,null,['geometry']),...sourceRefs(p,card.eventId,null,['geometry'])])));
  const individual=Object.fromEntries(roster.map(h=>[h,rowContrast(p,d,card,idOf(h))]));
  const fieldChanged=roster.filter(h=>individual[h].some(q=>q.state!=='MATCHED'));
  const pastRoster=d.rows.map(r=>r.nativeId).sort(),nowRoster=card.rows.filter(r=>r.status!=='CANCELLED').map(r=>r.nativeId).sort();
  const rosterMatched=eq(pastRoster,nowRoster);
  const sourceValid=s.valid&&s.edges.some(e=>e.interval_ms);
  const sharedHeld=shared.filter(q=>q.state!=='MATCHED');
  const edges=s.edges.map(e=>{
   const local=[...individual[e.a],...individual[e.b]],unresolved=local.filter(q=>q.state!=='MATCHED');
   const measured=sourceValid&&!!e.interval_ms&&!!e.refs.length;
   const unaffected=measured&&!sharedHeld.length&&!unresolved.length;
   const interaction=fieldChanged.filter(h=>h!==e.a&&h!==e.b);
   const scope=!measured?'HISTORICAL_PAIR_UNAVAILABLE':sharedHeld.length?'MEASURED_HISTORY_SHARED_TRANSFER_HELD':unresolved.length?'MEASURED_HISTORY_INDIVIDUAL_TRANSFER_HELD':!rosterMatched||interaction.length||!s.paceUsable?'LOCAL_MATCHED_RESPONSE_SHARED_INTERACTION_UNRESOLVED':'MATCHED_REPORTED_HISTORICAL_RESPONSE';
   return {...e,measured,unaffected,scope,local,sharedHeld,interaction,rosterMatched,
    historical_order:measured?e.order:'UNKNOWN',
    // These are conditional bounds on local response, not current finishing order.
    order:unaffected?e.order:'UNKNOWN',
    transfer:unaffected?'CONDITIONAL_LOCAL_RESPONSE':'HELD_DEPENDENT_TRANSFER',
    refs:uniq([...e.refs,...local.flatMap(q=>q.refs),...shared.flatMap(q=>q.refs)])};
  });
  const field=jointField(roster,edges.map(e=>({a:e.a,b:e.b,order:e.order})),x.placeThreshold??2);
  const roles=d.rows.filter(r=>roster.includes(p.issuer+'|'+r.nativeId)).map(r=>({horse:p.issuer+'|'+r.nativeId,firstRank:r.checkpointRanks?.[0]??null,firstMs:r.checkpointMs?.[0]??null,refs:sourceRefs(p,d.eventId,r.nativeId,['checkpoint_ms','ranks'])}));
  return {id:s.id,event:s.event,checkpoint:s.checkpoint_m,distance:d.conditions?.distance_m??null,precision:d.precisionMs??null,shared,individual,fieldChanged,rosterMatched,roles,leader:s.leader??null,sourceValid,edges,conditionalField:field,actual_current:'UNPROVEN',formal:false};
 });
}
// Search for a measured direction change on the SAME pair across different
// recorded conditions. Do not call a multifactor contrast a single-factor effect.
function responseContrast(history,horse){
 const rows=history.flatMap(s=>s.edges.filter(e=>e.measured&&(e.a===horse||e.b===horse)).map(e=>{
  const sign=e.a===horse?1:-1;
  return {event:s.event,checkpoint:s.checkpoint,remaining:s.distance-s.checkpoint,rival:sign===1?e.b:e.a,finish:sign===1?e.interval_ms:[-e.interval_ms[1],-e.interval_ms[0]],scope:e.scope,shared:s.shared,individual:e.local,refs:e.refs};
 }));
 return rows.flatMap((a,i)=>rows.slice(i+1).filter(b=>a.rival===b.rival&&a.checkpoint===b.checkpoint&&a.remaining===b.remaining).flatMap(b=>{
  const changed=a.shared.flatMap((q,j)=>eq(q.past,b.shared[j].past)?[]:[q.dimension]).concat(a.individual.flatMap((q,j)=>eq(q.past,b.individual[j].past)?[]:[q.dimension]));
  if(!changed.length)return [];
  return [{rival:a.rival,checkpoint:a.checkpoint,remaining:a.remaining,events:[a.event,b.event],changed,finish:[a.finish,b.finish],
   reversal:a.finish[0]>0&&b.finish[1]<0||a.finish[1]<0&&b.finish[0]>0,
   scope:'OBSERVED_ASSOCIATION_NOT_ISOLATED_CAUSAL_EFFECT',refs:uniq([...a.refs,...b.refs])}];
 }));
}
// Separate observed early competition from a future pace prediction. One
// event contributes one role vector regardless of how many checkpoints exist.
function roleReview(history,horse){
 const seen=new Set();
 return history.flatMap(s=>{
  if(seen.has(s.event))return [];seen.add(s.event);
  const own=s.roles.find(r=>r.horse===horse),others=s.roles.filter(r=>r.horse!==horse);
  const valid=s.sourceValid&&Number.isFinite(s.precision)&&Number.isFinite(own?.firstMs)&&own.refs.length;
  const peers=valid?others.filter(r=>Number.isFinite(r.firstMs)&&r.refs.length).map(r=>({rival:r.horse,gap_ms:r.firstMs-own.firstMs,bound_ms:2*s.precision,refs:uniq([...own.refs,...r.refs])})):[];
  const sharedMatch=s.shared.every(q=>q.state==='MATCHED'),ownMatch=(s.individual[horse]??[]).every(q=>q.state==='MATCHED');
  const targetRivals=peers.filter(p=>p.gap_ms>=-p.bound_ms&&p.gap_ms<=p.bound_ms);
  const observedFront=valid&&own.firstRank===1;
  return [{event:s.event,firstRank:own?.firstRank??null,firstMs:own?.firstMs??null,
   state:!valid?'UNKNOWN':observedFront?(targetRivals.length?'FRONT_CLOCK_OVERLAP':'FRONT_CLOCK_SEPARATED'):'OBSERVED_NONLEADING_POSITION',
   clockOverlap:targetRivals,peers,sharedMatch,ownMatch,fieldChanged:s.fieldChanged,
   relevance:valid&&sharedMatch&&ownMatch?'POSSIBLE_ROLE_ANTECEDENT_NOT_CURRENT_PACE':'TRANSFER_HELD_DEPENDENT_CONDITIONS',refs:uniq([...(own?.refs??[]),...peers.flatMap(p=>p.refs)]),formal:false}];
 });
}
// All 15 canonical categories, every horse. Existing common findings are
// consumed; unsupported categories remain explicitly held, not guessed.
function eyeAudit(h,p,history){
 const byId=new Map(p.evidence.map(e=>[e.evidenceId,e]));
 return Array.from({length:15},(_,i)=>{
  const item='EYE'+String(i+1).padStart(2,'0'),base=h.items.find(q=>q.item===item);assert.ok(base,item);
  const feedback=(h.eye_feedback??[]).filter(q=>q.item===item),refs=uniq([...(base.refs??[]),...feedback.flatMap(q=>q.refs??[])]);
  const incidentIds=uniq(refs.flatMap(id=>{const e=byId.get(id);return e?[p.issuer+'|'+e.event]:[]}));
  const rootKeys=uniq(refs.flatMap(id=>{const e=byId.get(id);return e?[e.root]:[]}));
  const positive=feedback.filter(q=>q.state==='CONDITIONAL_RESEARCH_RETURN'&&q.returned_to_current_analysis&&q.observation?.measurements?.some(m=>m.supported));
  const counter=positive.flatMap(q=>q.observation?.counterexamples??[]);
  return {item,commonState:base.state,refs,incidentIds,rootKeys,
    returned:positive.map(q=>({id:q.id,targets:q.targets,events:q.observation.events,refs:q.refs})),
    counter:counter.map(q=>({event:q.event,gain:q.gain,refs:q.refs})),
    state:positive.length?'CONDITIONAL_DISCOVERY_RETURNED':refs.length?'MATERIAL_PRESENT_RELEVANCE_UNPROVEN':'NO_VERIFIED_MATERIAL',
    canonical_positive:false,formal:false};
 });
}
function gradeTrace(h,history,eye,threshold){
 const routes=h.routes_v40??[];
 const win=routes.filter(p=>p.decision==='WIN_SUPPORT'),place=routes.filter(p=>p.decision==='PLACE_SUPPORT'||p.decision==='WIN_SUPPORT');
 const counter=routes.filter(p=>p.decision==='PLACE_COUNTER');
 // Held alternatives are material when no supported bound excludes a reversal.
 const held=routes.filter(p=>p.decision==='HELD');
 const local=history.flatMap(s=>s.edges.filter(e=>(e.a===h.slot||e.b===h.slot)&&e.measured));
 const unknown=history.flatMap(s=>s.edges.filter(e=>(e.a===h.slot||e.b===h.slot)&&e.transfer==='HELD_DEPENDENT_TRANSFER'));
 const axis=[
  {axis:'A',support:local.map(e=>({scope:e.scope,refs:e.refs})),counter:[],unknown:!local.length},
  {axis:'B',support:local.filter(e=>e.unaffected).map(e=>({scope:e.scope,refs:e.refs})),counter:[],unknown:true,missing:['CURRENT_FORM','CURRENT_ROLE_PACE']},
  {axis:'C',support:place.map(p=>p.id),counter:counter.map(p=>p.id),unknown:unknown.length>0||!routes.length},
  {axis:'D',support:win.filter(p=>p.axes.find(a=>a.axis==='D')?.support?.length).map(p=>p.id),counter:counter.map(p=>p.id),unknown:held.length>0||!routes.length},
  {axis:'E',support:eye.flatMap(e=>e.returned),counter:eye.flatMap(e=>e.counter),unknown:eye.some(e=>e.state!=='CONDITIONAL_DISCOVERY_RETURNED')}
 ];
 // Evaluate each claim against all applicable/held alternatives sharing the
 // observed start. A counter does not erase another supported start.
 const review=(p,claim)=>{
  const thresholdClaim=claim==='WIN'?1:threshold;
  const same=(h.history_v40??[]).find(q=>q.event===p.start_event);
  const alternatives=routes.filter(q=>q.start_event===p.start_event);
  const adverse=alternatives.filter(q=>q.applicable&&q.env?.min>thresholdClaim);
  const unresolved=alternatives.filter(q=>!q.applicable||!q.env||q.env.min<=thresholdClaim&&q.env.max>thresholdClaim);
  const a=p.axes.find(q=>q.axis==='A'),b=p.axes.find(q=>q.axis==='B'),cc=p.axes.find(q=>q.axis==='C'),d=p.axes.find(q=>q.axis==='D'),e=p.axes.find(q=>q.axis==='E');
  const axisUse={A:!!a?.support.length,B:!!b?.support.length,C:!!cc?.support.length,D:!!d?.support.length,E:!e?.counter.length||!!e?.refs.length};
  const sameCounter=!!same&&same.env.min>thresholdClaim;
  const sameSupport=!!same&&same.env.max<=thresholdClaim;
  const basis=Object.values(axisUse).every(Boolean)&&p.applicable&&sameSupport&&!sameCounter;
  return {route:p.id,start:p.start_event,response:p.response_event,claim,axisUse,sameSupport,sameCounter,counter:adverse.map(q=>q.id),held:unresolved.map(q=>q.id),basis,
   coherent:basis&&!adverse.length&&!unresolved.length,refs:uniq(p.axes.flatMap(q=>q.refs??[])),scope:'CONDITIONAL_HISTORICAL_ANTECEDENT'};
 };
 const winReviews=win.map(p=>review(p,'WIN')),placeReviews=place.map(p=>review(p,'PLACE'));
 const supportedWin=winReviews.filter(p=>p.coherent),supportedPlace=placeReviews.filter(p=>p.coherent);
 // No historical event count or point tally decides this. Actual current
 // applicability is distinct from the conditional historical candidate.
 const research_grade=supportedWin.length?'A':supportedPlace.length?'B':null;
 const currentEvidence={rolePace:false,form:false,scenarioCoverage:false};
 return {axes:axis,priorConditionalCandidate:h.research_grade??null,conditionalCandidate:research_grade,research_grade,current_grade:null,formal_grade:null,
  decisions:{S:'HELD_CURRENT_ROUTE_COVERAGE',A:supportedWin.length?'SUPPORTED_CONDITIONAL_WIN':win.length?'WIN_ALTERNATIVES_UNRESOLVED':'NO_SUPPORTED_WIN_ROUTE',B:supportedPlace.length?'SUPPORTED_CONDITIONAL_PLACE':place.length?'PLACE_ALTERNATIVES_UNRESOLVED':'NO_SUPPORTED_PLACE_ROUTE',C:counter.length?'COUNTER_ROUTE_NOT_GLOBAL_DISADVANTAGE':'NO_AFFIRMATIVE_DISADVANTAGE'},
  currentEvidence,winReviews,placeReviews,
  decisiveUnknown:['CURRENT_FORM','CURRENT_ROLE_PACE','CURRENT_ROUTE_COVERAGE',...(unknown.length?['DEPENDENT_CONDITION_TRANSFER']:[])],
  heldRoutes:held.map(p=>p.id),winRoutes:win.map(p=>p.id),placeRoutes:place.map(p=>p.id),counterRoutes:counter.map(p=>p.id),threshold,formal:false};
}
export function analyze(V,id){
 const x=analyzeV40(V,id),f=V.C.fixtures.find(f=>f.id===id),history=localScenarios(x,f.docs);
 const runners=x.runners.map(h=>{
  const contrast=responseContrast(history,h.slot),eye=eyeAudit(h,x.source_packet,history),decision=gradeTrace(h,history,eye,x.placeThreshold);
  return {horse:h.slot,items:h.items,contrast,role:roleReview(history,h.slot),eye,decision,grade:null,formal:false};
 });
 return {...x,history_v41:history,runners_v41:runners,formal:false};
}
// Generic event availability review over exact verified master. Selection is
// source availability/validity, NOT a predicted benefit or expected grade.
export function admission(V,available){
 const packet=V.master.out.packet,docs=V.master.f.docs,base=V.generated.find(g=>g.f.id==='W36_BASE').f.docs;
 const baseIds=new Set(base.map(d=>d.eventId));
 const candidateDocs=docs.filter(d=>d.kind==='HISTORICAL_RESULT'&&!baseIds.has(d.eventId));
 const card=docs.find(d=>d.kind==='TARGET_CARD'),ids=candidateDocs.map(d=>d.eventId);
 assert.equal(new Set(ids).size,ids.length,'DUPLICATE_EVENT');
 assert.equal(new Set(available).size,available.length,'DUPLICATE_AVAILABILITY');
 assert.ok(available.every(e=>ids.includes(e)));
 const reviewed=candidateDocs.map(d=>{
  const rows=d.rows.map(r=>{
   const refs=sourceRefs(packet,d.eventId,r.nativeId,['checkpoint_ms','finish_clock','finish']);
   return {horse:packet.issuer+'|'+r.nativeId,refs,complete:refs.length===3&&new Set(refs).size===3};
  });
  const valid=d.updatedAt<=card.scheduledPost&&d.publishedAt<=card.scheduledPost&&d.eventAt<card.scheduledPost&&rows.some(r=>r.complete);
  return {event:d.eventId,available:available.includes(d.eventId),valid,rows};
 });
 const admitted=reviewed.filter(r=>r.available&&r.valid).map(r=>r.event);
 const W={...V,C:{...V.C,admission:{candidateEvents:ids,admittedEvents:admitted}}};
 const x=analyze(W,V.master.f.id);
 assert.equal(x.source_digest,V.master.out.digest);
 assert.equal(sha(JSON.stringify(x.source_packet)),V.master.out.digest);
 return {x,reviewed,admitted};
}
// Audit known excluded source AND derived alias identifiers in every returned
// decision branch, including nested findings and scenarios. Raw source packet,
// explicit admission audit and immutable source digest are provenance exemptions.
export function leakAudit(x){
 const a=x.admissionTrace;assert.ok(a,'ADMISSION_TRACE_REQUIRED');
 const excluded=new Set(a.excluded.map(e=>e.id)),retained=new Set(a.retained.map(e=>e.id)),denied=new Set(a.deniedEvents);
 const leaks=[],events=[];
 function walk(v,path){
  if(typeof v==='string'){if(excluded.has(v))leaks.push({path,id:v});if(denied.has(v))events.push({path,event:v});return;}
  if(Array.isArray(v)){v.forEach((q,i)=>walk(q,path+'.'+i));return;}
  if(v&&typeof v==='object')for(const [k,q] of Object.entries(v))walk(q,path+'.'+k);
 }
 const {source_packet,source_envelope,admissionTrace,...analysis}=x;walk(analysis,'analysis');
 const broken=a.retained.flatMap(e=>e.depends.filter(d=>!retained.has(d)).map(d=>({id:e.id,dependency:d})));
 return {excluded:excluded.size,retained:retained.size,leaks,events,broken};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const V=await loadV40();
const all=V.C.fixtures.filter(f=>f.id!=='W36_MASTER_IMMUTABLE').map(f=>analyze(V,f.id));
const by=id=>all.find(x=>x.id===id);
t('F41-01',()=>{
 assert.equal(all.length,25);assert.equal(all.reduce((n,x)=>n+x.source_packet.evidence.length,0),8190);
 for(const x of all){assert.equal(x.source_digest,V.fixed.get(x.id).pin.source_digest);assert.equal(x.groups,118);assert.equal(x.held,826);assert.equal(x.runners_v41.length,5);assert.ok(x.runners_v41.every(h=>h.items.length===115&&h.eye.length===15&&h.grade===null));}
});
t('F41-02',()=>{
 for(const dim of ['GOING','WEIGHT','GATE','COURSE','DISTANCE','JOINT']){
  const x=by('W36_CONTEXT_'+dim);assert.ok(x.history_v41.some(s=>s.edges.some(e=>e.measured)),'HISTORICAL_MEASUREMENT_MUST_SURVIVE_'+dim);
  assert.ok(x.history_v41.some(s=>s.shared.some(q=>q.state==='CHANGED')||s.fieldChanged.length));
 }
 for(const [dim,affected] of [['WEIGHT',[H(1)]],['GATE',[H(1),H(2)]]]){
  const x=by('W36_CONTEXT_'+dim);
  const s=x.history_v41.find(s=>s.edges.some(e=>e.unaffected));assert.ok(s);
  for(const e of s.edges.filter(e=>e.measured)){
   assert.equal(e.unaffected,!affected.includes(e.a)&&!affected.includes(e.b));
   if(e.unaffected)assert.equal(e.scope,'LOCAL_MATCHED_RESPONSE_SHARED_INTERACTION_UNRESOLVED');
  }
 }
});
t('F41-03',()=>{
 const a=by('W36_BASE'),b=by('W36_CONTEXT_WEIGHT');
 for(const s of b.history_v41){const q=a.history_v41.find(z=>z.id===s.id);assert.ok(q);for(const e of s.edges.filter(e=>e.measured))assert.deepEqual(e.interval_ms,q.edges.find(z=>z.a===e.a&&z.b===e.b).interval_ms);}
 const x=by('W36_OTHER_COUNTER');
 assert.ok(x.runners_v41.some(h=>h.contrast.some(q=>q.changed.includes('going')&&q.reversal)));
 assert.ok(x.runners_v41.every(h=>h.contrast.every(q=>q.scope==='OBSERVED_ASSOCIATION_NOT_ISOLATED_CAUSAL_EFFECT')));
});
const baseIds=new Set(V.generated.find(g=>g.f.id==='W36_BASE').f.docs.map(d=>d.eventId));
const candidates=V.master.f.docs.filter(d=>d.kind==='HISTORICAL_RESULT'&&!baseIds.has(d.eventId)).map(d=>d.eventId);
const masks=[[],candidates.slice(0,2),[candidates[2]],candidates.slice(0,3),[...candidates.slice(0,2),candidates[3]]].map(a=>admission(V,a));
const audits=masks.map(m=>leakAudit(m.x));
t('F41-04',()=>{
 assert.ok(masks.every(m=>m.x.source_digest===masks[0].x.source_digest));
 assert.ok(masks.every(m=>m.reviewed.every(r=>r.rows.length===5)));
 assert.throws(()=>admission(V,[candidates[0],candidates[0]]),/DUPLICATE_AVAILABILITY/);
 for(const q of audits){assert.equal(q.broken.length,0);assert.equal(q.leaks.length,0,JSON.stringify(q.leaks.slice(0,3)));assert.equal(q.events.length,0,JSON.stringify(q.events.slice(0,3)));}
});
t('F41-05',()=>{
 for(const x of [...all,...masks.map(m=>m.x)])for(const h of x.runners_v41){
  assert.equal(new Set(h.eye.map(e=>e.item)).size,15);
  assert.ok(h.eye.every(e=>!e.canonical_positive&&!e.formal));
  assert.ok(h.decision.axes.length===5&&h.decision.current_grade===null);
  assert.ok(h.decision.decisiveUnknown.includes('CURRENT_ROUTE_COVERAGE'));
 }
 const b=masks[0].x.runners_v41.find(h=>h.horse===H(4)),p=masks[1].x.runners_v41.find(h=>h.horse===H(4));
 assert.ok(p.eye.find(e=>e.item==='EYE03').returned.length>b.eye.find(e=>e.item==='EYE03').returned.length);
});
t('F41-06',()=>{
 for(const x of [...all,...masks.map(m=>m.x)])for(const h of x.runners_v41){
  const d=h.decision;
  if(d.research_grade==='A')assert.ok(d.winReviews.some(p=>p.coherent&&Object.values(p.axisUse).every(Boolean)&&!p.held.length&&!p.counter.length));
  if(d.research_grade==='B'){assert.ok(!d.winReviews.some(p=>p.coherent));assert.ok(d.placeReviews.some(p=>p.coherent));}
  assert.ok(d.winReviews.every(p=>!p.coherent||!p.sameCounter));
  assert.ok(d.current_grade===null&&d.formal_grade===null);
 }
 const unknown=by('FK34_UNKNOWN');assert.ok(unknown.runners_v41.every(h=>h.decision.research_grade===null));
 const bad=by('W36_SHARED_CONFLICT');assert.ok(bad.runners_v41.every(h=>h.decision.current_grade===null));
});
t('F41-07',()=>{
 const x=by('FK34_FULL'),h=x.runners_v41.find(h=>h.horse===H(2));
 const a=h.role.find(q=>q.event.endsWith('TEST:CONTEST')),b=h.role.find(q=>q.event.endsWith('TEST:LONE'));
 assert.ok(a&&b);assert.equal(a.state,'FRONT_CLOCK_OVERLAP');assert.equal(b.state,'FRONT_CLOCK_SEPARATED');
 assert.ok(a.clockOverlap.some(q=>q.rival===H(5)&&q.gap_ms===100));
 assert.equal(b.clockOverlap.length,0);
 assert.ok(h.role.every(q=>q.relevance!=='CURRENT_PACE_OBSERVED'));
});
const compact=x=>({id:x.id,digest:x.source_digest,history:x.history_v41.map(s=>({id:s.id,shared:s.shared.filter(q=>q.state!=='MATCHED'),fieldChanged:s.fieldChanged,measured:s.edges.filter(e=>e.measured).length,local:s.edges.filter(e=>e.unaffected).length,edges:s.edges.map(e=>({a:e.a,b:e.b,scope:e.scope,interval:e.interval_ms,transfer:e.transfer})),bounds:s.conditionalField.envelopes.map(e=>[e.slot,e.min,e.max])})),runners:x.runners_v41.map(h=>({horse:h.horse,contrast:h.contrast,role:h.role,eye:h.eye.map(e=>({item:e.item,state:e.state,returned:e.returned.length,counter:e.counter.length,incidents:e.incidentIds})),decision:{...h.decision,axes:h.decision.axes.map(a=>({axis:a.axis,support:a.support.length,counter:a.counter.length,unknown:a.unknown}))}}))});
for(const x of all)console.log('V41_CASE '+JSON.stringify(compact(x)));
for(let i=0;i<masks.length;i++)console.log('V41_MASK '+JSON.stringify({available:masks[i].reviewed,admitted:masks[i].admitted,audit:audits[i],result:compact(masks[i].x)}));

}
