// V38 research-only fixed Work35 intake and upstream localized comparison.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadV36} from './work34-v36-current.mjs';
import {analyzeV34,analyzeV35} from './work33-v34-synthesis.mjs';
import {fixtures35,branches35} from './work35-pinned/stage35-current-evidence-v0.2.mjs';
import {jointField} from './work29-v30-terminal.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const read=n=>readFileSync(new URL('./work35-pinned/'+n,import.meta.url));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const H=n=>'TEST:NAR|TEST:H'+n;
export async function loadV38(){
 const V=await loadV36(), bytes=read('stage35-final-handoff-v0.2.json');
 assert.equal(blob(bytes),'e01b7936b78c9b348fb8478ce7d9eec5573f067d');
 const m=JSON.parse(bytes);assert.equal(m.scope,'SYNTHETIC_ONLY');
 assert.equal(m.parent,'e193a22a0d6f36020dffbc96fd4b518f64d802b8');
 assert.equal(m.canonical,115);assert.equal(m.groups,118);assert.equal(m.held,826);
 const p=m.files.find(x=>x.path.endsWith('/stage35-current-evidence-v0.2.mjs'));
 const b=read('stage35-current-evidence-v0.2.mjs');assert.equal(blob(b),p.blob);assert.equal(sha(b),p.sha256);
 const raw={fixtures:V.C.fixtures},fixtures=[...raw.fixtures,...fixtures35(raw)];
 assert.equal(fixtures.length,10);assert.equal(new Set(fixtures.map(f=>f.id)).size,10);
 for(const f of V.manifest.cases){
  const a=m.cases.find(c=>c.id===f.id);
  assert.equal(a.source_digest,f.source_digest);assert.equal(a.bundle_sha256,f.bundle_sha256);
 }
 assert.equal(m.cases.reduce((n,c)=>n+c.evidence,0),4434);
 const C={...V.C,fixtures,receipt:{summary:m.cases.map(c=>({...c,itemRows:575}))}};
 const fixed=new Map(m.cases.map(p=>[p.id,{raw:{raw:fixtures.find(f=>f.id===p.id).docs},pin:{...p,blob:p.id.startsWith('FK34')?V.fixed.get(p.id).pin.blob:blob(b)}}]));
 return {C,fixed,manifest:m};
}
export function analyzeV38(V,id,{withdraw=null,eyeEnabled=true,placeThreshold=2,gapStress=false,evidenceCross=false}={}){
 const f=V.C.fixtures.find(x=>x.id===id);assert.ok(f);
 const common=analyzeV34(V,id,{withdraw,eyeEnabled,placeThreshold,localize:true});
 // Preserve local observed bounds even when there is no independent current
 // pace evidence. V35 shared numeric solver still consumes the actual pair edges.
 const observed=common.scenarios.filter(s=>s.valid&&['COMPARABLE_SYNTHETIC_RESPONSE','LOCAL_OBSERVED_RESPONSE_ONLY'].includes(s.applicability));
 const branches=[...branches35(f),...observed.map(s=>({id:'OBS:'+s.id,checkpoint_m:s.checkpoint_m,response_event:s.event,starts:s.starts}))];
 // Optional, explicitly hypothetical gap-width contrast. No current observations
 // are created. All eligible 800m vectors receive the same scale grid.
 if(gapStress)for(const s of observed.filter(s=>s.checkpoint_m===800&&s.applicability==='COMPARABLE_SYNTHETIC_RESPONSE')){
  const v=Object.entries(s.starts);if(v.length!==common.roster.possible_active.length)continue;
  const center=x=>(x[0]+x[1])/2,origin=Math.min(...v.map(([,a])=>center(a)));
  for(const k of [0.25,0.5,1.5]){
   const starts=Object.fromEntries(v.map(([h,a])=>{const m=origin+k*(center(a)-origin),u=(a[1]-a[0])/2;return [h,[m-u,m+u]];}));
   branches.push({id:'GAP_STRESS:'+k+':'+s.id,checkpoint_m:s.checkpoint_m,response_event:s.event,starts});
  }
 }
 // V40: use an independent observed starting vector and the entire measured
 // response of another comparable event. No guessed gap compression.
 if(evidenceCross){
  const eligible=observed.filter(s=>s.checkpoint_m===800&&s.applicability==='COMPARABLE_SYNTHETIC_RESPONSE');
  for(const a of eligible)for(const b of eligible){
   if(a.event===b.event)continue;
   branches.push({id:'EVIDENCE_CROSS:'+a.id+'>'+b.id,checkpoint_m:b.checkpoint_m,response_event:b.event,starts:a.starts});
  }
 }
 const shared=analyzeV35(V,id,{withdraw,eyeEnabled,placeThreshold,branches,localize:true});
 const runners=shared.runners.map(h=>{
  const paths=shared.conditional_scenarios.map(s=>{
   const e=s.field.envelopes.find(x=>x.slot===h.slot),own=s.edges.filter(x=>x.a===h.slot||x.b===h.slot);
   const localConflicts=s.roleConflicts.filter(x=>x.a===h.slot||x.b===h.slot);
   const measured=own.filter(x=>x.interval_ms&&x.refs.length);
   // These are bounded historical/conditional responses, not current grades.
   const valid=s.valid&&shared.roster.known_active.includes(h.slot)&&!!e;
   const bound=t=>!valid||t===null?'UNKNOWN':e.max<=t?'SUPPORT':e.min>t?'COUNTER':'UNRESOLVED';
   const relevant=common.feedback.filter(f=>f.subject===h.slot&&f.checkpoint_m===s.checkpoint_m&&f.after.edges.some(x=>x.observations?.some(o=>o.event===s.response_event)));
   const missing=own.filter(x=>!x.interval_ms).map(x=>x.a===h.slot?x.b:x.a);
   return {id:s.id,event:s.response_event,envelope:e??null,WIN:bound(1),PLACE:bound(placeThreshold),missing,possible_winner:valid&&e.min===1,measured:measured.length,localConflicts,context:s.comparable?'MATCHED_FULL_HISTORY':s.partial?'LOCAL_HISTORY_ONLY':'HELD',discovery:relevant.map(f=>({id:f.id,state:f.state,counter_refs:f.counter_refs})),current:'UNPROVEN'};
  });
  return {...h,historical_candidate:h.research_grade,research_grade:null,grade:null,formal:false,paths_v38:paths};
 });
 return {...shared,runners,source_digest:common.source_digest,formal:false,grade:null,policy:'PARTIAL_RESEARCH_OBSERVED_BOUNDS_NOT_CURRENT_GRADE'};
}
function compact(x){
 return {id:x.id,source_digest:x.source_digest,evidence:x.source_packet.evidence.length,groups:x.groups,held:x.held,
  observed:x.historical_scenarios.map(s=>({id:s.id,valid:s.valid,applicability:s.applicability,edges:s.edges.filter(e=>e.interval_ms).length,envelopes:s.field.envelopes.map(e=>[e.slot,e.min,e.max])})),
  scenarios:x.conditional_scenarios.map(s=>({id:s.id,valid:s.valid,partial:s.partial,edges:s.edges.filter(e=>e.interval_ms).length,envelopes:s.field.envelopes.map(e=>[e.slot,e.min,e.max])})),
  runners:x.runners.map(h=>({horse:h.slot,grade:h.research_grade,paths:h.paths_v38.map(p=>({id:p.id,WIN:p.WIN,PLACE:p.PLACE,missing:p.missing,possible_winner:p.possible_winner}))})),
  feedback:x.feedback.map(f=>({id:f.id,state:f.state,checkpoint:f.checkpoint_m,after:f.after.envelope,refs:f.refs.length}))};
}
// Work35 introduces a distinct historical event. Gate a single root on
// the same immutable verified packet, with EYE enabled in all executions.
// This is a controlled candidate-root experiment, not evidence of actual current
// role/pace or full independent incident admission.
function rootContrast(V,after,event){
 const root=after.source_packet.evidence.find(e=>e.event===event&&e.subject==='TEST:H4'&&e.field==='checkpoint_ms')?.evidenceId;
 assert.ok(root,'NEW_EVENT_ROOT');
 const baseline=analyzeV38(V,after.id,{withdraw:root,eyeEnabled:true});
 assert.equal(baseline.source_digest,after.source_digest,'IMMUTABLE_SNAPSHOT');
 const before=baseline.historical_scenarios.filter(x=>x.event==='TEST:NAR|'+event),admitted=after.historical_scenarios.filter(x=>x.event==='TEST:NAR|'+event);
 const edges=x=>x.edges.map(e=>({a:e.a,b:e.b,interval:e.interval_ms,order:e.order}));
 const comparisons=admitted.map(x=>{const b=before.find(y=>y.id===x.id);return {id:x.id,changed:!eq(edges(b),edges(x)),before:edges(b),after:edges(x)};});
 const itemChanges=after.runners.flatMap(h=>h.items.flatMap(i=>{
  const b=baseline.runners.find(q=>q.slot===h.slot).items.find(q=>q.item===i.item);
  return eq(i,b)?[]:[{horse:h.slot,item:i.item}];
 }));
 const untouched=after.historical_scenarios.filter(x=>x.event!=='TEST:NAR|'+event).every(x=>{const b=baseline.historical_scenarios.find(y=>y.id===x.id);return b&&eq(edges(x),edges(b));});
 const paths=after.runners.flatMap(h=>h.paths_v38.flatMap(p=>{
  const b=baseline.runners.find(q=>q.slot===h.slot).paths_v38.find(q=>q.id===p.id);
  return !b||!eq([p.envelope,p.WIN,p.PLACE],[b.envelope,b.WIN,b.PLACE])?[{horse:h.slot,id:p.id,before:b?{WIN:b.WIN,PLACE:b.PLACE,envelope:b.envelope}:null,after:{WIN:p.WIN,PLACE:p.PLACE,envelope:p.envelope}}]:[];
 }));
 return {root,event,snapshot:after.source_digest,eyeEnabled:true,comparisons,itemChanges,untouched,paths,gradeChanged:after.runners.some(h=>h.research_grade!==baseline.runners.find(q=>q.slot===h.slot).research_grade),scope:'CANDIDATE_ROOT_SENSITIVITY_NOT_FULL_EYE_ADMISSION'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const V=await loadV38(),t=(id,fn)=>{fn();console.log(id+' PASS');};
const all=V.manifest.cases.map(c=>analyzeV38(V,c.id));
t('F38-01',()=>{assert.equal(all.length,10);assert.equal(all.reduce((n,x)=>n+x.source_packet.evidence.length,0),4434);for(const x of all){const c=V.manifest.cases.find(c=>c.id===x.id);assert.equal(x.source_digest,c.source_digest);assert.equal(x.source_packet.evidence.length,c.evidence);assert.equal(x.runners.length,5);assert.ok(x.runners.every(h=>h.items.length===115&&h.grade===null));assert.equal(x.groups,118);assert.equal(x.held,826);}});
const full=all.find(x=>x.id==='FK34_FULL'),local=all.find(x=>x.id==='FK35_ACTIVE_NO_CHECKPOINT'),missing=all.find(x=>x.id==='FK35_ACTIVE_MISSING');
const byId=(a,id)=>a.historical_scenarios.find(s=>s.id===id);
t('F38-02',()=>{
 const s=local.historical_scenarios.find(s=>s.valid&&s.edges.filter(e=>e.interval_ms).length===6);
 assert.ok(s,'LOCAL_SIX_PAIR_OBSERVATIONS');const f=byId(full,s.id);assert.ok(f);
 for(const e of s.edges.filter(e=>e.interval_ms)){assert.ok(e.a!==H(5)&&e.b!==H(5));assert.deepEqual(e.interval_ms,f.edges.find(q=>q.a===e.a&&q.b===e.b).interval_ms);}
 assert.ok(s.field.envelopes.some(e=>e.slot!==H(5)&&e.max<5));assert.deepEqual(s.field.envelopes.find(e=>e.slot===H(5))&&[s.field.envelopes.find(e=>e.slot===H(5)).min,s.field.envelopes.find(e=>e.slot===H(5)).max],[1,5]);
 const reversed=jointField([...local.roster.possible_active].reverse(),[...s.edges].reverse(),2);
 for(const e of s.field.envelopes){const q=reversed.envelopes.find(x=>x.slot===e.slot);assert.deepEqual([e.min,e.max],[q.min,q.max]);}
});
t('F38-03',()=>{
 const s=local.conditional_scenarios.find(x=>x.valid&&x.partial&&x.edges.filter(e=>e.interval_ms).length===6);
 assert.ok(s,'LOCAL_RESPONSE_TRANSFER');assert.ok(local.runners.find(h=>h.slot===H(5)).paths_v38.find(p=>p.id===s.id).possible_winner);
 assert.ok(local.runners.filter(h=>h.slot!==H(5)).some(h=>h.paths_v38.some(p=>p.id===s.id&&p.WIN==='COUNTER')));
 const bad=jointField(['A','B','C'],[{a:'A',b:'B',order:'AHEAD'},{a:'B',b:'C',order:'AHEAD'},{a:'A',b:'C',order:'BEHIND'}],2);assert.equal(bad.state,'CONTRADICTED_SHARED_ORDER');
 const m=missing.historical_scenarios.find(s=>s.valid&&s.edges.filter(e=>e.interval_ms).length===6);
 assert.ok(m,'LOCAL_INDIVIDUAL_PERFORMANCE_WITHOUT_COMPLETE_CLASSIFICATION');
 const original=byId(full,m.id);assert.ok(original);
 for(const e of m.edges.filter(e=>e.interval_ms)){assert.equal(e.pair_context,'PARTIAL_LITERAL_RANK_CLOCK_ONLY');assert.deepEqual(e.interval_ms,original.edges.find(q=>q.a===e.a&&q.b===e.b).interval_ms);}
 assert.equal(m.applicability,'LOCAL_OBSERVED_RESPONSE_ONLY');
 const mh=m.field.envelopes.find(e=>e.slot===H(5));assert.deepEqual([mh.min,mh.max],[1,5]);
 assert.ok(missing.runners.every(h=>h.grade===null));
});
t('F38-04',()=>{const e=all.find(x=>x.id==='FK35_EYE'),c=all.find(x=>x.id==='FK35_EYE_COUNTER');assert.ok(e.source_packet.evidence.some(r=>r.event==='TEST:DISCOVERED'));assert.ok(c.source_packet.evidence.some(r=>r.event==='TEST:NEW_COUNTER'));assert.ok(e.runners.every(h=>h.research_grade===null));assert.ok(c.runners.every(h=>h.research_grade===null));});
const eye=all.find(x=>x.id==='FK35_EYE'),counter=all.find(x=>x.id==='FK35_EYE_COUNTER');
const positiveContrast=rootContrast(V,eye,'TEST:DISCOVERED'),counterContrast=rootContrast(V,counter,'TEST:NEW_COUNTER');
t('F38-05',()=>{assert.ok(positiveContrast.comparisons.some(c=>c.changed));assert.ok(counterContrast.comparisons.some(c=>c.changed));assert.ok(positiveContrast.untouched&&counterContrast.untouched);assert.ok(positiveContrast.paths.length&&counterContrast.paths.length);assert.equal(positiveContrast.gradeChanged,false);assert.equal(counterContrast.gradeChanged,false);});
console.log('V38_RECEIPT '+JSON.stringify(all.map(compact)));
console.log('V38_ROOT_CONTRAST '+JSON.stringify({positive:positiveContrast,counter:counterContrast}));

}
