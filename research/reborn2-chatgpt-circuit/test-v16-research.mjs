import assert from 'node:assert/strict';
import {generateFixture} from './synthetic-generator-v15.mjs';
import {generateV16,validateV16,toCommonV16,abnormalVariants} from './synthetic-generator-v16.mjs';
import {analyzeV16,synthesizeV16} from './conditional-judgment-v16.mjs';
import {workInput,workDiagnostics,candidateChronology,candidate37Eye05} from './work15-v16-diagnostics.mjs';
const t=(id,f)=>{f();console.log(id+' PASS (V16 research)')};
const seeds=[...Array.from({length:17},(_,i)=>20261127+i),...Array.from({length:16},(_,i)=>i+1),0,4294967295];
const c=generateV16(),result=analyzeV16(c),w=workDiagnostics(workInput());
const badOld=seeds.slice(0,17).map(s=>generateFixture(s).history.flatMap(r=>r.rows.filter(h=>h.clock_tenths-h.final3f_tenths<r.lap_tenths.slice(0,4).reduce((a,b)=>a+b,0))).length);
t('F16-01',()=>{assert.deepEqual(generateV16(),c);assert.notDeepEqual(generateV16(20261128),c);assert.equal(badOld.reduce((a,b)=>a+b,0),45);assert.equal(badOld.filter(n=>n>0).length,16);for(const seed of seeds)assert.equal(validateV16(generateV16(seed)).valid,true,String(seed));});
t('F16-02',()=>{for(const [k,v] of Object.entries(abnormalVariants(c)))assert.equal(validateV16(v).valid,false,k);const v=structuredClone(c),r=v.history[0];r.rows[1].final3f_tenths=r.rows[1].clock_tenths-r.lap_tenths.slice(0,4).reduce((a,b)=>a+b,0)+1;assert.ok(validateV16(v).errors.some(e=>e.includes('FINAL600_LEADER_BOUND')));assert.throws(()=>toCommonV16(v),/V16_INVALID/);});
t('F16-03',()=>{const v=structuredClone(c);v.history[0].rows[1].checkpoint_tenths[3]++;assert.equal(validateV16(v).valid,false);const u=structuredClone(c);u.target.entrants[0].future_result=1;assert.ok(validateV16(u).errors.includes('SCHEMA'));});
t('F16-04',()=>{assert.equal(result.common.ledger.length,460);assert.ok(result.decisions.every(d=>Object.keys(d.perspectives).length===5&&d.current_strength===null&&d.candidate_rank===null));assert.ok(result.decisions.some(d=>d.winning_conditional.length));});
t('F16-05',()=>{const a=result.decisions.find(d=>d.winning_conditional.length),base=structuredClone(result.common);const h=base.merged.find(x=>x.horse_id===a.id);h.items['78']={facts:[],hypotheses:[],counterevidence:[],unknowns:['WITHHELD_FOR_CONTROL']};assert.deepEqual(synthesizeV16(c,base).find(d=>d.id===a.id).winning_conditional,a.winning_conditional);h.items['35']={facts:[],hypotheses:[],counterevidence:[],unknowns:['WITHHELD_FOR_CONTROL']};assert.equal(synthesizeV16(c,base).find(d=>d.id===a.id).winning_conditional.length,0);});
t('F16-06',()=>{const v=structuredClone(c);v.target.conditions.going='重';const a=analyzeV16(v);assert.ok(a.decisions.every(d=>!d.winning_conditional.length&&!d.placing_conditional.length));assert.deepEqual(a.decisions.map(d=>d.observed),result.decisions.map(d=>d.observed));});
// Controlled full-packet change: permute already generated crossing clocks at a
// chosen checkpoint, then recompute all dependent quantities. No target outcome.
const alt=structuredClone(c),names=['FIXTURE-A','FIXTURE-B','FIXTURE-C','FIXTURE-D'];
function reorder(r,j,order){
 const clocks=r.rows.map(h=>h.checkpoint_tenths[j]).sort((a,b)=>a-b);
 order.forEach((id,k)=>r.rows.find(h=>h.id===id).checkpoint_tenths[j]=clocks[k]);
 for(const h of r.rows){const rank=k=>1+r.rows.filter(x=>x.checkpoint_tenths[k]<h.checkpoint_tenths[k]).length;h.corners=[0,1,3,5].map(rank);h.finish=rank(6);h.clock_tenths=h.checkpoint_tenths[6];h.final3f_tenths=h.clock_tenths-h.checkpoint_tenths[3];h.margin_tenths=h.finish===1?null:h.clock_tenths-clocks[0];}
 const leader=Math.min(...r.rows.map(h=>h.clock_tenths));for(const h of r.rows)h.margin_tenths=h.finish===1?null:h.clock_tenths-leader;
}
for(const [i,r] of alt.history.entries())reorder(r,6,[names[i],names[3],...names.slice(0,3).filter(x=>x!==names[i])]);
reorder(alt.history[0],0,[names[3],names[0],names[1],names[2]]);
reorder(alt.history[1],0,[names[0],names[1],names[2],names[3]]);
reorder(alt.history[1],5,[names[1],names[3],names[0],names[2]]);
const v=analyzeV16(alt),subject=v.decisions.find(d=>d.id===names[3]),noEye=analyzeV16(alt,{useEye:false}).decisions.find(d=>d.id===names[3]);
t('F16-07',()=>{assert.equal(validateV16(alt).valid,true);assert.ok(subject.observed.every(x=>x.finish!==1));assert.ok(subject.routes.some(r=>r.kind==='WIN'&&r.state==='CONDITIONAL_HYPOTHESIS'));assert.equal(subject.winning_conditional.length,0);assert.ok(subject.placing_conditional.length);});
t('F16-08',()=>{assert.ok(subject.routes.some(r=>r.kind==='WIN'&&r.mechanism==='LEAD'&&r.state==='COUNTER_CONTEXT'));assert.ok(subject.routes.some(r=>r.kind==='PLACE'&&r.mechanism==='NON_LEAD'&&r.state==='CONDITIONAL_SUPPORT'));assert.ok(subject.routes.some(r=>r.scenario==='CONTEST'&&r.state==='UNKNOWN'));});
t('F16-09',()=>{assert.ok(subject.routes.some(r=>r.kind==='PLACE'&&r.mechanism==='ADVANCE'&&r.root_reused&&r.state==='CONDITIONAL_SUPPORT'));assert.equal(noEye.routes.some(r=>r.mechanism==='ADVANCE'),false);assert.ok(subject.placing_conditional.length>noEye.placing_conditional.length);assert.equal(subject.winning_conditional.length,noEye.winning_conditional.length);});
t('F16-10',()=>{assert.equal(w.patches,52);assert.equal(w.originals,12);assert.equal(w.relations,137);assert.equal(w.roots,65);assert.deepEqual(w.counts,{AFTER_DATE_ONLY:84,BEFORE_REFERENCE:41,SAME_EVENT:12,SAME_DATE_UNRESOLVED:0});assert.equal(w.mixed_roots,28);assert.equal(w.formal_admissions,0);});
t('F16-11',()=>{const x=workInput();x.patches[0].expected_old='2026-01-01';assert.throws(()=>workDiagnostics(x),/PATCH_TUPLE/);const y=workInput();y.relations.push(y.relations[0]);assert.throws(()=>workDiagnostics(y),/RELATION_SCOPE/);const z=workInput();z.relations[0].date_order='SAME_EVENT';assert.throws(()=>workDiagnostics(z),/RELATION_SCOPE/);});
t('F16-12',()=>{assert.equal(candidateChronology({later_race:'LOCAL:2026-09-10:川崎:11',reference_race:'LOCAL:2026-09-10:川崎:10'}),'SAME_DATE_UNRESOLVED');const all=w.root_rows.flatMap(r=>r.relations.map(e=>({subject:e.reference_subject_id,reference:e.reference_race})));for(const q of all){const links=candidate37Eye05(w,q.subject,q.reference);assert.equal(new Set(links.map(r=>r.root)).size,links.length);assert.ok(links.every(r=>r.formal===false&&r.current_effect===null));}assert.equal(w.official_replay_eligible,0);});
console.log('F16_META '+JSON.stringify({seeds:seeds.length,old_violations:badOld,new_valid:seeds.filter(s=>validateV16(generateV16(s)).valid).length,subject,without_eye:noEye,work:{patches:w.patches,relations:w.relations,roots:w.roots,counts:w.counts,mixed_roots:w.mixed_roots},formal:false}));
