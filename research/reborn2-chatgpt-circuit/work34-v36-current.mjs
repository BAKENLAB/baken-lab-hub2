// V36: research-only admission of fixed Work34 into the existing shared analyzer.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadControlledWork33} from './work32-v33-current.mjs';
import {analyzeV34,analyzeV35} from './work33-v34-synthesis.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const read=n=>readFileSync(new URL('./work34-pinned/'+n,import.meta.url));
const uniq=a=>[...new Set(a)];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export async function loadV36(){
 const bytes=read('stage34-final-handoff-v0.2.json');
 assert.equal(blob(bytes),'8615fcf19e2de1002200a43c5c668a16162b9403');
 const m=JSON.parse(bytes);
 assert.equal(m.scope,'SYNTHETIC_ONLY');assert.equal(m.canonical,115);assert.equal(m.groups,118);assert.equal(m.held,826);
 for(const f of m.files){const b=read(f.path.split('/').at(-1));assert.equal(blob(b),f.blob);assert.equal(sha(b),f.sha256);assert.equal(b.length,f.bytes);}
 const raw=JSON.parse(read('stage34-raw-fixtures-v0.2.json'));
 const {make34}=await import('./work34-pinned/stage34-five-field-v0.2.mjs');
 const prior=await loadControlledWork33();
 assert.deepEqual(raw.canonical,prior.canonical);
 assert.deepEqual(raw.fixtures,make34());
 assert.equal(raw.fixtures.length,5);
 const C={...prior,fixtures:raw.fixtures,receipt:{summary:m.cases}};
 const fixed=new Map(m.cases.map(p=>[p.id,{raw:{raw:raw.fixtures.find(f=>f.id===p.id).docs},pin:{...p,blob:m.files.find(f=>f.path.endsWith('stage34-raw-fixtures-v0.2.json')).blob}}]));
 return {C,fixed,manifest:m};
}
// Route alternatives start from the verified observed joint role/pace vectors.
// They are hypothetical transfers, not today's observed trajectory or probabilities.
export function analyzeV36(V,id,{withdraw=null,eyeEnabled=true,placeThreshold=2}={}){
 const hist=analyzeV34(V,id,{withdraw,eyeEnabled,placeThreshold});
 const observations=hist.scenarios.filter(s=>s.kind==='OBSERVED_FIELD_RESPONSE_SCENARIO');
 const comparable=observations.filter(s=>s.applicability==='COMPARABLE_SYNTHETIC_RESPONSE'&&s.valid);
 const branches=comparable.filter(s=>s.checkpoint_m===Math.min(...comparable.filter(x=>x.event===s.event).map(x=>x.checkpoint_m))).map(s=>({id:s.id,checkpoint_m:s.checkpoint_m,response_event:s.event,starts:s.starts}));
 const shared=analyzeV35(V,id,{withdraw,eyeEnabled,placeThreshold,branches});
 const runners=shared.runners.map(h=>{
  const routes=shared.conditional_scenarios.map(s=>{
   const env=s.field.envelopes.find(x=>x.slot===h.slot), old=comparable.find(x=>x.id===s.id);
   const pairs=s.edges.filter(x=>x.a===h.slot||x.b===h.slot).map(e=>{
    const sign=e.a===h.slot?1:-1,rival=sign===1?e.b:e.a,own=s.starts[h.slot],other=s.starts[rival];
    const start=own&&other?[other[0]-own[1],other[1]-own[0]]:null;
    const finish=e.interval_ms?(sign===1?e.interval_ms:[-e.interval_ms[1],-e.interval_ms[0]]):null;
    const gain=e.change_ms===null?null:sign*e.change_ms, bound=e.change_bound_ms;
    let response='UNKNOWN';
    if(start&&finish&&Number.isFinite(gain)&&Number.isFinite(bound)){
     if(start[1]<0&&finish[0]>0)response='OVERCAME_MEASURED_DEFICIT';
     else if(start[1]<0&&gain>bound)response='CLOSED_GAP_NOT_PROVEN_OVERTAKE';
     else if(start[0]>0&&gain>bound)response='EXPANDED_LEAD';
     else if(start[0]>0&&gain< -bound)response='LOST_LEAD_MARGIN';
     else response='MEASURED_NO_CLEAR_CHANGE';
    }
    return {rival,start,finish,gain,bound,response,refs:e.refs};
   });
   const known=h.status==='ACTIVE'&&h.identity_known, applicable=known&&s.comparable&&s.complete&&s.valid&&!s.roleConflicts.length;
   const positive=pairs.filter(p=>['OVERCAME_MEASURED_DEFICIT','EXPANDED_LEAD','CLOSED_GAP_NOT_PROVEN_OVERTAKE'].includes(p.response));
   const losses=pairs.filter(p=>p.response==='LOST_LEAD_MARGIN');
   const measured=pairs.filter(p=>p.response!=='UNKNOWN');
   const win=applicable&&env?.max===1,place=applicable&&env?.max<=placeThreshold;
   const relevant=hist.feedback.filter(f=>f.subject===h.slot&&f.checkpoint_m===s.checkpoint_m&&f.refs.some(ref=>pairs.some(p=>p.refs.includes(ref))));
   const counter=relevant.filter(f=>f.counter_refs.length||f.state==='RECOVERY_ROUTE_COUNTERED');
   // Local loss/counter evidence is retained; no historical placing gate.
   // Without a proven decisive counter or current coverage, do not claim unconditional support.
   const axes=[
    {axis:'A',state:measured.length?'MEASURED_COMPARATIVE_RESPONSE':'UNKNOWN',facts:measured,refs:uniq(measured.flatMap(p=>p.refs))},
    {axis:'B',state:applicable?'COMPARABLE_HYPOTHESIS':'UNKNOWN',facts:{role_conflicts:s.roleConflicts,leader:old?.leader??null,actual_current:'UNPROVEN'},refs:uniq([...s.condition_refs,...s.historical_role_refs])},
    {axis:'C',state:!applicable?'UNKNOWN':win||place?'CONDITIONAL_SUPPORT':env.min>placeThreshold?'CONDITIONAL_COUNTER':'UNKNOWN',facts:env??null,refs:uniq(pairs.flatMap(p=>p.refs))},
    {axis:'D',state:positive.length&&losses.length?'MIXED':positive.length?'SUPPORT':losses.length?'LOCAL_COUNTER':measured.length?'MEASURED':'UNKNOWN',facts:{positive,losses},refs:uniq([...positive,...losses].flatMap(p=>p.refs))},
    {axis:'E',state:counter.length?'LOCAL_COUNTER_REVIEW':relevant.length?'DISCOVERY_REVIEW':'UNKNOWN',facts:relevant,refs:uniq(relevant.flatMap(f=>[...f.refs,...f.counter_refs]))}
   ];
   const supported=applicable&&measured.length===pairs.length&&!counter.length;
   return {id:s.id,event:s.response_event,axes,pairs,envelope:env??null,WIN:supported&&win?'CONDITIONALLY_SUPPORTED':applicable&&env?.min>1?'CONDITIONAL_COUNTER':'UNRESOLVED',PLACE:supported&&place?'CONDITIONALLY_SUPPORTED':applicable&&env?.min>placeThreshold?'CONDITIONAL_COUNTER':'UNRESOLVED',prediction:false,actual_current:'UNPROVEN'};
  });
  const wins=routes.filter(p=>p.WIN==='CONDITIONALLY_SUPPORTED'),places=routes.filter(p=>p.PLACE==='CONDITIONALLY_SUPPORTED');
  // A/B are research transfer candidates only. S/C require current scope coverage
  // not provided by this fixed ledger. Missing is never a negative grade.
  return {...h,conditional_paths_v36:routes,research_grade:wins.length?'A':places.length?'B':null,grade:null,formal:false,WIN:{overall:'UNRESOLVED',conditional_paths:wins},PLACE:{overall:'UNRESOLVED',conditional_paths:places},unresolved:['CURRENT_ROLE_PACE','CURRENT_FORM','ALTERNATIVE_COVERAGE','OPPONENT_CLASS_TRANSFER','S_C_BOUNDARY']};
 });
 return {...shared,schema:'REBORN2_V36_PARTIAL_FIXED_WORK34',runners,grade:null,formal:false,policy:'RESEARCH_ONLY_CONDITIONAL_NO_FORMAL_SABC'};
}
export function reviewAdmission(V,id,root,opts={}){
 // Same fixed source, root withheld vs restored. Discovery is evaluated in a
 // separate run; restoration is permitted only when a real positive feedback references it.
 const before=analyzeV36(V,id,{...opts,withdraw:root,eyeEnabled:false});
 const discovered=analyzeV36(V,id,{...opts,withdraw:null,eyeEnabled:true});
 const evidence=discovered.feedback.filter(f=>f.state==='CONDITIONAL_RECOVERY_SUPPORTED_AFTER_COUNTER_REVIEW'&&f.refs.includes(root));
 const admitted=evidence.length>0;
 const after=admitted?discovered:before;
 const changes=before.runners.flatMap(b=>{
  const a=after.runners.find(x=>x.slot===b.slot);
  return b.items.flatMap(i=>{const j=a.items.find(x=>x.item===i.item);
   // Actual upstream item payload, excluding V34 output annotation/decision refs.
   const core=x=>Object.fromEntries(Object.entries(x).filter(([k])=>!['v34_reanalysis','decision_refs','decision_effect','grade_effect_proven'].includes(k)));
   return equal(core(i),core(j))?[]:[{horse:b.slot,item:i.item,before:core(i),after:core(j)}];
  });
 });
 return {root,admitted,evidence:evidence.map(f=>f.id),changes,decisions:before.runners.map(b=>({horse:b.slot,before:b.research_grade,after:after.runners.find(x=>x.slot===b.slot).research_grade})),scope:'FIXED_ROOT_WITHDRAWAL_REPLAY_NOT_NEW_OFFICIAL_ADMISSION',formal:false};
}
