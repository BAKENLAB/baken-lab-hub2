import assert from 'node:assert/strict';
import {loadV34,analyzeV34,analyzeV35} from '../reborn2-chatgpt-circuit/work33-v34-synthesis.mjs';
const V=await loadV34(), r=analyzeV34(V,'DISTANCE',{eyeEnabled:false});
const slots=r.roster.possible_active,h1=slots.find(h=>h.endsWith('|TEST:H1')),h3=slots.find(h=>h.endsWith('|TEST:H3'));
const source=r.scenarios.find(s=>s.event.endsWith('|TEST:BASE')&&s.checkpoint_m===600);
const starts=Object.fromEntries(slots.map(h=>[h,[10000,10000]]));
const branch={id:'LEVEL',response_event:source.event,checkpoint_m:600,starts};
let failures=0;
function probe(id,fn){try{const detail=fn();console.log(JSON.stringify({id,status:'PASS',detail}));}catch(e){failures++;console.log(JSON.stringify({id,status:'FAIL',error:e.message}));}}
const q=analyzeV35(V,'DISTANCE',{branches:[branch],eyeEnabled:false});
const path=(q,h)=>q.runners.find(x=>x.slot===h).conditional_paths_v35[0];
probe('IT35-01-no-false-prediction',()=>{assert.equal(q.conditional_scenarios[0].actual_current_applicability,'UNPROVEN');assert.ok(q.runners.every(h=>h.grade===null));});
probe('IT35-02-historical-place-gate',()=>{const p=path(q,h3);assert.equal(p.axes.find(a=>a.axis==='C').state,'CONDITIONAL_SUPPORT');assert.ok(!p.blocked.includes('HISTORICAL_ABILITY_NOT_SUPPORTED_FOR_THIS_ROUTE'),'Historical placing alone vetoes current conditional route');});
probe('IT35-03-response-counter-causal',()=>{const p=path(q,h1);const d=p.axes.find(a=>a.axis==='D');assert.ok(d);return {state:d.state,blocked:p.blocked,limitation:'Requires matched decisive vs local counter fixtures; this is observation only'};});
probe('IT35-04-eye-counter-flip',()=>{const a=analyzeV35(V,'PACE',{branches:[branch]}),b=analyzeV35(V,'PACE',{branches:[branch],eyeEnabled:false});assert.ok(a.runners.some(h=>h.research_grade!==b.runners.find(x=>x.slot===h.slot).research_grade),'No candidate flip under EYE toggle');return {scenarioChanged:JSON.stringify(a.conditional_scenarios)!==JSON.stringify(b.conditional_scenarios)};});
probe('IT35-05-missing-roster',()=>{const w=r.source_packet.evidence.find(e=>e.event==='TEST:T'&&e.subject==='TEST:H3'&&e.field==='current_card_row').evidenceId;const a=analyzeV35(V,'DISTANCE',{branches:[branch],withdraw:w});assert.ok(a.roster.possible_active.includes(h3));assert.ok(a.runners.every(h=>h.research_grade===null));});
probe('IT35-06-branch-order-invariance',()=>{const second={...branch,id:'DEFICIT',starts:{...starts,[h1]:[30000,30000]}};const a=analyzeV35(V,'DISTANCE',{branches:[branch,second],eyeEnabled:false}),b=analyzeV35(V,'DISTANCE',{branches:[second,branch],eyeEnabled:false});assert.deepEqual(a.runners.map(h=>[h.slot,h.research_grade]),b.runners.map(h=>[h.slot,h.research_grade]));});
console.log(JSON.stringify({failures,scope:'diagnostic only; positive EYE, S/C and current pace require additional fixtures'}));process.exitCode=failures?1:0;
