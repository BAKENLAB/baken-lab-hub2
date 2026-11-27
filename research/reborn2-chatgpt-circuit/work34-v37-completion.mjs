// Research only. Preserve V36 and all inherited version-scoped tests.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadV36} from './work34-v36-current.mjs';
import {analyzeV34,analyzeV35} from './work33-v34-synthesis.mjs';
const unique=x=>[...new Set(x)];
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const observed=x=>x.scenarios.filter(s=>s.kind==='OBSERVED_FIELD_RESPONSE_SCENARIO'&&s.valid&&s.applicability==='COMPARABLE_SYNTHETIC_RESPONSE');
// Whole vector transfer, never assemble cherry-picked pair responses.
// A start vector from another historical event is NOT a current observation.
export function buildBranches(common){
 const obs=observed(common), branches=[];
 for(const s of obs)branches.push({id:'SELF:'+s.id,checkpoint_m:s.checkpoint_m,response_event:s.event,starts:s.starts,start_event:s.event,kind:'HISTORICAL_REPLAY'});
 // At each checkpoint, contrast the same starting vector under a different
 // response; both start and response can be independently traced to source events.
 for(const start of obs)for(const response of obs){
  if(start.checkpoint_m!==response.checkpoint_m||start.event===response.event)continue;
  branches.push({id:'CROSS:'+start.id+'>'+response.id,checkpoint_m:start.checkpoint_m,response_event:response.event,starts:start.starts,start_event:start.event,kind:'CROSS_EVENT_STRESS'});
 }
 return branches;
}
function verdict(e,threshold){
 if(!e||threshold===null)return 'UNKNOWN';
 return e.max<=threshold?'SUPPORTED_BOUND':e.min>threshold?'COUNTER_BOUND':'UNRESOLVED_BOUND';
}
// Localize mathematical uncertainty; preserve possible unknown winner. No
// full-field-complete gate for reporting bounds, and no promotion from stress
// arithmetic to actual current ability. All roots are deduplicated, not votes.
export function scopeRoute(s,horse,threshold,source,common){
 const env=s.field.envelopes.find(h=>h.slot===horse);
 const own=s.edges.filter(e=>e.a===horse||e.b===horse);
 const known=own.filter(e=>e.interval_ms&&e.refs.length);
 const conflicts=s.roleConflicts??[];
 const oriented=known.map(e=>{
  const sign=e.a===horse?1:-1,rival=sign===1?e.b:e.a, a=s.starts?.[horse],b=s.starts?.[rival];
  const start=a&&b?[b[0]-a[1],b[1]-a[0]]:null;
  const end=sign===1?e.interval_ms:[-e.interval_ms[1],-e.interval_ms[0]];
  const gain=Number.isFinite(e.change_ms)?sign*e.change_ms:null;
  const bound=Number.isFinite(e.change_bound_ms)?e.change_bound_ms:null;
  const recovery=start&&start[1]<0&&end[0]>0;
  return {rival,start,end,gain,bound,recovery,refs:e.refs};
 });
 const roots=unique(known.flatMap(e=>e.refs));
 const contextRoots=unique(s.condition_refs??[]);
 const localLoss=oriented.filter(e=>e.gain!==null&&e.bound!==null&&e.gain< -e.bound);
 const recovery=oriented.filter(e=>e.recovery);
 const missing=own.filter(e=>!known.includes(e)).map(e=>e.a===horse?e.b:e.a);
 const valid=s.valid&&s.comparable&&env&&common.roster.known_active.includes(horse);
 const context=valid&&contextRoots.length>0&&!conflicts.length;
 const ability=known.length>0;
 const response=oriented.some(e=>e.gain!==null&&e.bound!==null);
 const support=(t)=>!valid?'UNKNOWN':verdict(env,t);
 const gates=(t)=>{
  const bound=support(t);
  if(!ability||!context||!response)return 'HELD';
  // A local loss of margin is not a decisive counter if the whole-field bound
  // still supports the claim. A bound that excludes the claim is a counter
  // in this stipulated branch, not in every possible current race.
  return bound==='SUPPORTED_BOUND'?'CONDITIONAL_SUPPORT':bound==='COUNTER_BOUND'?'CONDITIONAL_COUNTER':'UNRESOLVED';
 };
 const related=common.feedback.filter(f=>f.subject===horse&&f.checkpoint_m===s.checkpoint_m);
 // EYE alternative remains its own recomputed scenario. Do not transfer a
 // broad feedback counter to every branch sharing a checkpoint.
 return {horse,branch:s.id,kind:source.kind,start_event:source.start_event,response_event:s.response_event,
  checkpoint_m:s.checkpoint_m,envelope:env??null,missing,possible_winner:!!env&&env.min===1,
  mathematical_WIN:support(1),mathematical_PLACE:support(threshold),
  conditional_WIN:gates(1),conditional_PLACE:gates(threshold),
  axes:[
   {axis:'A',state:ability?'MEASURED_PAIR_RESPONSE':'UNKNOWN',refs:roots},
   {axis:'B',state:context?'CONDITIONAL_CONTEXT_AND_ROLE':'UNKNOWN',refs:unique([...contextRoots,...(s.historical_role_refs??[]),...(source.start_refs??[])])},
   {axis:'C',state:support(threshold),refs:unique(s.edges.flatMap(e=>e.refs)),envelope:env??null},
   {axis:'D',state:!response?'UNKNOWN':localLoss.length&&recovery.length?'MIXED':localLoss.length?'LOCAL_LOSS':recovery.length?'MEASURED_DEFICIT_OVERTAKEN':'MEASURED_RESPONSE',recovery,localLoss,refs:roots},
   {axis:'E',state:related.length?'SEPARATE_DISCOVERY_ALTERNATIVE':'NO_RELEVANT_DISCOVERY_OBSERVED',ids:related.map(f=>f.id),refs:unique(related.flatMap(f=>f.refs))}
  ],role_conflicts:conflicts,actual_current:'UNPROVEN',prediction:false,formal:false};
}
export function analyzeV37(V,id,{withdraw=null,eyeEnabled=true,placeThreshold=2,omitStart=null}={}){
 const common=analyzeV34(V,id,{withdraw,eyeEnabled,placeThreshold});
 const obs=observed(common),branches=buildBranches(common);
 // Controlled missing-start contrast: never remove the runner from roster.
 if(omitStart&&obs.length){
  assert.ok(common.roster.possible_active.includes(omitStart));
  const s=obs[0],starts={...s.starts};delete starts[omitStart];
  branches.push({id:'MISSING_START:'+s.id,checkpoint_m:s.checkpoint_m,response_event:s.event,starts,start_event:s.event,kind:'MISSING_START_STRESS'});
 }
 const sources=new Map(branches.map(b=>[b.id,{...b,start_refs:obs.find(s=>s.event===b.start_event&&s.checkpoint_m===b.checkpoint_m)?.refs??[]}]));
 const shared=analyzeV35(V,id,{withdraw,eyeEnabled,placeThreshold,branches});
 const routes=shared.conditional_scenarios.flatMap(s=>common.roster.possible_active.map(h=>scopeRoute(s,h,placeThreshold,sources.get(s.id),common)));
 // Use actual recomputed common field and same-checkpoint route, not an
 // annotation on an unrelated 200m replay. Retain counter and uncertainty.
 const discovery=common.feedback.map(f=>({id:f.id,horse:f.subject,rival:f.rival,checkpoint_m:f.checkpoint_m,
  state:f.state,before:f.before.envelope??null,after:f.after.envelope??null,
  before_WIN:verdict(f.before.envelope,1),after_WIN:verdict(f.after.envelope,1),
  before_PLACE:verdict(f.before.envelope,placeThreshold),after_PLACE:verdict(f.after.envelope,placeThreshold),
  interval_changes:f.after.edges.filter(e=>{const b=f.before.edges.find(x=>x.a===e.a&&x.b===e.b);return !eq(b?.interval_ms??null,e.interval_ms??null);}).map(e=>({a:e.a,b:e.b,interval:e.interval_ms,refs:e.refs})),
  refs:unique(f.refs),counter_refs:unique(f.counter_refs),actual_current:'UNPROVEN',formal:false}));
 return {id,source_digest:common.source_digest,roster:common.roster,groups:common.groups,held:common.held,
  routes,discovery,runners:common.runners.map(h=>({...h,historical_research_candidate:h.research_grade,research_grade:null,grade:null,formal:false,current_grade_reason:'NO_INDEPENDENT_CURRENT_ROLE_RESPONSE_COVERAGE'})),
  current_evidence_coverage:'UNPROVEN',formal:false,grade:null,prediction:false};
}
// Same EYE setting, same source, only one fixed root withheld/restored.
// This is a sensitivity experiment, not independent new-root admission.
function stripLineage(x){
 if(Array.isArray(x))return x.map(stripLineage);
 if(!x||typeof x!=='object')return x;
 return Object.fromEntries(Object.entries(x).filter(([k])=>!/(^|_)(refs?|lineage|evidence_ids?|decision_effect|grade_effect_proven|v34_reanalysis)($|_)/i.test(k)).map(([k,v])=>[k,stripLineage(v)]));
}
export function isolateFixedRoot(V,id,root){
 const before=analyzeV34(V,id,{withdraw:root,eyeEnabled:true});
 const after=analyzeV34(V,id,{withdraw:null,eyeEnabled:true});
 const positive=after.feedback.filter(f=>f.state==='CONDITIONAL_RECOVERY_SUPPORTED_AFTER_COUNTER_REVIEW'&&f.refs.includes(root));
 const items=before.runners.flatMap(h=>h.items.flatMap(i=>{
  const j=after.runners.find(a=>a.slot===h.slot).items.find(x=>x.item===i.item);
  return eq(i,j)?[]:[{horse:h.slot,item:i.item,payload_changed:!eq(stripLineage(i),stripLineage(j))}];
 }));
 const changes=after.feedback.flatMap(f=>{
  const b=before.feedback.find(x=>x.id===f.id);
  const compact=x=>x?{state:x.state,envelope:x.after.envelope,intervals:x.after.edges.map(e=>({a:e.a,b:e.b,interval:e.interval_ms}))}:null;
  return eq(compact(b),compact(f))?[]:[{id:f.id,checkpoint_m:f.checkpoint_m,before:compact(b),after:compact(f)}];
 });
 return {root,eyeEnabled_before:true,eyeEnabled_after:true,positive:positive.map(f=>f.id),items,changes,scope:'EXISTING_ROOT_SENSITIVITY_NOT_NEW_ADMISSION',formal:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const V=await loadV36(),t=(id,f)=>{f();console.log(id+' PASS');};
 const full=analyzeV37(V,'FK34_FULL',{omitStart:'TEST:NAR|TEST:H5'});
 const missing=full.routes.filter(r=>r.kind==='MISSING_START_STRESS');
 t('F37-01',()=>{assert.equal(full.groups,118);assert.equal(full.held,826);assert.equal(full.roster.possible_active.length,5);assert.ok(full.runners.every(h=>h.items.length===115&&h.grade===null));assert.ok(missing.length===5);assert.ok(missing.some(r=>r.horse!=='TEST:NAR|TEST:H5'&&r.envelope.max<5&&r.missing.includes('TEST:NAR|TEST:H5')));assert.ok(missing.find(r=>r.horse==='TEST:NAR|TEST:H5').possible_winner);});
 t('F37-02',()=>{const cross=full.routes.filter(r=>r.kind==='CROSS_EVENT_STRESS');assert.ok(cross.length>0);assert.ok(cross.every(r=>r.start_event!==r.response_event&&r.actual_current==='UNPROVEN'));assert.ok(cross.some(r=>r.role_conflicts.length>0||r.mathematical_WIN==='UNRESOLVED_BOUND'||r.conditional_WIN==='CONDITIONAL_COUNTER'));assert.ok(full.routes.some(r=>r.axes[3].recovery.length>0));});
 const raw=analyzeV34(V,'FK34_FULL');
 const root=raw.source_packet.evidence.find(e=>e.event==='TEST:RECOVERY_B'&&e.subject==='TEST:H4'&&e.field==='checkpoint_ms')?.evidenceId;
 assert.ok(root);
 const review=isolateFixedRoot(V,'FK34_FULL',root);
 t('F37-03',()=>{assert.equal(review.eyeEnabled_before,review.eyeEnabled_after);assert.ok(review.positive.length>0);assert.ok(review.changes.length>0);assert.ok(review.items.length>0);assert.ok(full.discovery.some(d=>d.checkpoint_m>200&&d.interval_changes.length>0));});
 t('F37-04',()=>{assert.ok(full.runners.every(h=>h.research_grade===null));assert.ok(full.routes.every(r=>!r.formal&&!r.prediction));assert.ok(full.routes.some(r=>r.conditional_WIN==='CONDITIONAL_SUPPORT'));assert.ok(full.routes.some(r=>r.conditional_WIN==='CONDITIONAL_COUNTER'));});
 console.log('V37_RECEIPT '+JSON.stringify({routes:full.routes.length,cross:full.routes.filter(r=>r.kind==='CROSS_EVENT_STRESS').length,missing:missing.map(r=>({horse:r.horse,envelope:r.envelope,WIN:r.conditional_WIN,PLACE:r.conditional_PLACE,possible_winner:r.possible_winner})),discovery:full.discovery.map(d=>({id:d.id,checkpoint:d.checkpoint_m,state:d.state,before:d.before,after:d.after,interval_changes:d.interval_changes.length})),review:{...review,changes:review.changes.map(c=>({id:c.id,checkpoint:c.checkpoint_m,before:c.before?.state,after:c.after.state}))}}));
}
