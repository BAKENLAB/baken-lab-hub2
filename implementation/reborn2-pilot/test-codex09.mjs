import assert from 'node:assert/strict';
import {ENGINE,assertFrozenEngine,sha} from './adapter.mjs';
import {exerciseExistingGraph,runNormalReview,readIssuedGraph} from './native-graph-issuance.mjs';
import {startGraphPreview} from './graph-preview.mjs';
import {decideNormalGrade} from './normal-engine.mjs';
import {submitAnalysis} from './work04-intake.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const cap=exerciseExistingGraph('08'),x=readIssuedGraph(cap),n=runNormalReview(cap);
assert.equal(n.sourceGraphDigest,sha(x.packet));assert.equal(n.runners.length,2);
assert.equal(n.field.completeField,false);assert.equal(n.field.paceCovered,false);assert.equal(n.field.scenarios.length,0);
const root=new Map(x.packet.roots.map(r=>[r.id,r]));
for(const h of n.runners){
 assert.equal(h.items.length,115);assert.equal(h.items.filter(i=>i.item.startsWith('EYE')).length,15);
 assert.equal(h.candidateGrade,'UNASSESSED');assert.equal(h.formalGrade,null);assert.equal(h.winPaths.length,0);
 assert.ok(h.items.filter(i=>['M','S'].includes(i.category)).every(i=>i.state==='HELD'));
 const f=h.items.find(i=>i.item==='RANK35').findings[0];
 assert.equal(f.value.final600DifferenceMs,h.horseNo===1?-500:500);
 assert.equal(h.items.find(i=>i.item==='RANK05').state,'HELD');
 assert.equal(h.items.find(i=>i.item==='RANK19').findings.length,1);
 assert.equal(h.items.find(i=>i.item==='RANK78').findings[0].value.days,1);
 for(const i of h.items)for(const f of i.findings){const seen=new Set();function visit(id){if(seen.has(id))return;assert.ok(root.has(id));seen.add(id);root.get(id).depends.forEach(visit);}f.directRefs.forEach(visit);assert.deepEqual([...seen].sort(),f.refs);}
}
assert.throws(()=>runNormalReview({...cap}),/ISSUED_GRAPH_CAPABILITY_REQUIRED/);
await assert.rejects(()=>submitAnalysis({schema:'REBORN2_NORMAL_CANDIDATE_REQUEST_1',request:null}),/MAIN_NATIVE_APPROVAL_NOT_CONFIGURED/);
// Decision truth-table only, not invented racing observations or a new race.
// Exercise each explicit policy branch independent of the data extractor.
const support=['A','B','C','D','E'].map(axis=>({axis,state:'SUPPORT'}));
const w={eligible:true,completeField:true,allHistory:true,paceCovered:true,axes:support,winPaths:[{}],placePaths:[],against:false,allPeersAhead:true,allScenarioWin:true,eyeFeedback:true};
assert.equal(decideNormalGrade(w).grade,'S');
assert.equal(decideNormalGrade({...w,eyeFeedback:false}).grade,'A');
assert.equal(decideNormalGrade({...w,winPaths:[],placePaths:[{}]}).grade,'B');
assert.equal(decideNormalGrade({...w,axes:['A','B','C','D','E'].map(axis=>({axis,state:axis==='B'?'SUPPORT':axis==='E'?'HELD':'COUNTER'})),winPaths:[],against:true}).grade,'C');
assert.equal(decideNormalGrade({...w,completeField:false}).grade,'UNASSESSED');
assert.equal(decideNormalGrade({...w,against:true}).grade,'UNASSESSED');
const p=await startGraphPreview(cap,{normal:true});try{const h=await (await fetch(p.url)).text();assert.ok(h.includes('NORMAL候補')&&h.includes('開発候補'));const horse=new URL(h.match(/href="([^"]+)"[^>]*>全115項目を見る/)[1].replaceAll('&amp;','&'),p.url);const d=await(await fetch(horse)).text();assert.ok(d.includes('CURRENT_FIELD_OR_COMPARABLE_HISTORY_INCOMPLETE'));}finally{await new Promise(ok=>p.server.close(ok));}
console.log('CODEX09_NORMAL_EXISTING_GRAPH PASS '+JSON.stringify({items:n.runners.map(h=>h.items.filter(i=>i.findings.length).length),findings:n.runners.map(h=>h.items.flatMap(i=>i.findings).length),grades:n.runners.map(h=>h.candidateGrade),formal:false}));
console.log('CODEX09_NORMAL_DECISION_TRUTH_TABLE PASS');
