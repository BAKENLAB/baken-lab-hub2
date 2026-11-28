import assert from 'node:assert/strict';
import {prepareWork40,analyzeWork40} from '../reborn2-independent-engine/main47-integration/work40-common.mjs';
import {loadV40} from '../reborn2-chatgpt-circuit/work36-v40-integrated.mjs';
import {analyze} from '../reborn2-chatgpt-circuit/work36-v41-local-decision.mjs';
import {integrate} from '../reborn2-chatgpt-circuit/work36-v42-propagation.mjs';
const records=[];
async function probe(id,fn){let row;try{row={id,status:'PASS',detail:await fn()};}catch(e){row={id,status:e.code==='ERR_ASSERTION'?'FAIL':'EXECUTION_ERROR',name:e.name,code:e.code??null,message:e.message};}records.push(row);console.log(JSON.stringify(row));}
const blocked=(id,reason)=>{const r={id,status:'NOT_EXECUTABLE',reason};records.push(r);console.log(JSON.stringify(r));};
const clean=({analysis,analysisSha256})=>({analysis,analysisSha256});
const base=prepareWork40(),sealed=prepareWork40([{evidence_id:'SEALED2',raw_sha256:'b'.repeat(64)}]);
const a=await analyzeWork40(clean(base)),b=await analyzeWork40(clean(sealed)),off=await analyzeWork40(clean(base),{eyeEnabled:false});
const V=await loadV40(),cache=new Map();
function run(id){if(!cache.has(id)){const f=V.C.fixtures.find(f=>f.id===id);assert.ok(f);cache.set(id,integrate(analyze(V,id),f.docs));}return cache.get(id);}
const canon=h=>({horse:h.horse,current:h.current_grade,conditional:h.conditional_grade,reasons:h.reasons,items:h.items.map(({v42,...i})=>i),paths:h.paths.map(p=>({id:p.id,decision:p.decision,basis:p.basis,field:p.field,local:p.local,axes:p.axes.filter(q=>q.axis!=='E').map(q=>({axis:q.axis,support:q.support,counter:q.counter,unknown:q.unknown}))}))});
await probe('R48-01-isolated-result-same-flag',()=>{assert.notDeepEqual(base.sealedResults,sealed.sealedResults);assert.deepEqual(a,b);return {scope:'pinned input equality; not process isolation'};});
await probe('R48-02-eye-semantic-positive-witness',()=>{assert.ok(a.decision.runners.some(h=>h.eye.length));assert.equal(a.analysisSha256,off.analysisSha256);assert.notDeepEqual(a.decision.runners.map(canon),off.decision.runners.map(canon),'No change in canonical item or downstream route/grade/axis semantics in this pinned control');return {scope:'single fixed case; change still needs attribution to verified discovery, not proof of all categories'};});
await probe('R48-03-eye-no-fabricated-route',()=>{for(const h of off.decision.runners){assert.equal(h.eye.length,0);assert.ok(h.paths.every(p=>p.axes.find(x=>x.axis==='E').support.length===0));}return {scope:'disabled-discovery control'};});
await probe('R48-04-current-output-completion',()=>{const z=a.decision;assert.ok(z.runners.some(h=>h.current_grade!==null),'No present-race grade witness');for(const h of z.runners){assert.ok(['S','A','B','C',null].includes(h.current_grade));if(h.current_grade===null)assert.ok(h.reasons.unknown?.length);else assert.ok(h.paths.some(p=>p.actual_current!=='UNPROVEN'));}return {scope:'necessary condition, not sufficient'};});
await probe('R48-05-applicable-recovery-retention',()=>{const own=a.decision.runners.flatMap(h=>h.paths.flatMap(p=>p.own)).filter(q=>q.local&&q.full);assert.ok(own.some(q=>q.recovered),'No full applicable recovery witness');assert.ok(own.some(q=>q.retained),'No full applicable retention witness');return {scope:'historical measured position response; no causal burden claim'};});
await probe('R48-06-conditional-AB-witness',()=>{const all=V.C.fixtures.filter(f=>f.id!=='W36_MASTER_IMMUTABLE').flatMap(f=>run(f.id).runners);const A=all.filter(h=>h.conditional_grade==='A'),B=all.filter(h=>h.conditional_grade==='B');assert.ok(A.length&&B.length,'Missing nonvacuous conditional A/B witness');assert.ok(A.every(h=>h.reasons.win.some(q=>q.supported)));assert.ok(B.every(h=>!h.reasons.win.some(q=>q.supported)&&h.reasons.place.some(q=>q.supported)));return {A:A.length,B:B.length,scope:'historical candidates only'};});
for(const [id,reason] of [
 ['R48-07-nonwinner-current-win','Requires corrected generic packet and supported current scenario, not just hypothetical arithmetic'],
 ['R48-08-peer-strength','Requires matched strength change with same conditions and subject evidence'],
 ['R48-09-burden','Requires verified burden measurements and matched alternatives; deficit alone insufficient'],
 ['R48-10-S-multiple-and-none','Current S decision not available; require supported current alternatives, no grade quotas'],
 ['R48-11-current-AB','Current judgment missing; historical candidates insufficient'],
 ['R48-12-C-vs-unknown','Current C decision not available; require affirmative disadvantage vs insufficient data'],
 ['R48-13-root-alias','Pinned intake cannot admit different valid IDs for same root; require generic corrected intake and trace'],
 ['R48-14-missing-decisive-vs-irrelevant','Need same-source bounded and unbounded missing controls with same unaffected decisions'],
 ['R48-15-target-result-process-isolation','Need separate filesystem/capability boundary and generic alias/time validation'],
 ['R48-16-eye15-causal','Need category-specific positive/counter/no-effect, common item kernel and five-axis causal trace']
])blocked(id,reason);
console.log(JSON.stringify({schema:'MAIN48_REVISED_DIAGNOSTIC_V1',records,formal:false}));
process.exitCode=records.some(r=>r.status==='EXECUTION_ERROR')?2:records.some(r=>r.status==='FAIL')?1:records.some(r=>r.status==='NOT_EXECUTABLE')?3:0;
