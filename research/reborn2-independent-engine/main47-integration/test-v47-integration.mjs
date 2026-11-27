import assert from 'node:assert/strict';
import {loadV40,acceptedRequest,analyzeVerified} from './v43-generic.mjs';
import {makeEnvelope} from '../../reborn2-work42/validate-v0.4.mjs';
import {prepareSupply,compileReturn} from '../../reborn2-work42/codex-contract-v0.4.mjs';
import {semanticItems} from '../../reborn2-chatgpt-circuit/work42-v46-semantic.mjs';
const V=await loadV40(),id='FK34_FULL',docs=V.C.fixtures.find(f=>f.id===id).docs,{request,receipt}=acceptedRequest(V,id),envelope=makeEnvelope(docs),p=await prepareSupply(envelope,{id});
const run=(o={})=>analyzeVerified(V,request,receipt,{semanticVersion:47,work42Envelope:envelope,...o});
const on=await run(),off=await run({work42Selection:{}});
assert.equal(on.digest,off.digest);assert.equal(on.groups,118);assert.equal(on.held,826);
assert.ok(on.runners.every(h=>h.itemConsumption.length===115&&h.grade===null&&h.current_grade===null));
const summary=on.runners.map(h=>({horse:h.horse,grade:h.v47.conditionalCurrentResearchGrade,prior:h.v46.conditionalCurrentResearchGrade,categories:h.v47.categories.map(c=>({id:c.category,state:c.state,reviews:c.reviewStates})),states:h.v47.cardRoutes.reduce((a,p)=>(a[p.state]=(a[p.state]??0)+1,a),{}),win:h.v47.decisionBasis.win.length,place:h.v47.decisionBasis.place.length}));
console.log('V47_FIELD '+JSON.stringify(summary));
assert.ok(on.runners.every(h=>h.v47.categories.filter(c=>['EYE04','EYE06','EYE14','EYE15'].includes(c.category)).every(c=>c.required.length===2&&c.state==='INSUFFICIENT_EVIDENCE')));
assert.ok(off.runners.every(h=>h.v47.categories.find(c=>c.category==='EYE03').state==='NO_SELECTED_CLAIM'));
assert.ok(off.runners.every(h=>h.v47.cardRoutes.every(p=>!p.eyeReviews.length)));
console.log('V47_HOLDS_AND_SELECTION PASS');
const reviews=on.runners.flatMap(h=>h.v47.cardRoutes.flatMap(p=>p.eyeReviews));
const executed=[...new Set(reviews.filter(q=>!q.state.startsWith('HELD')).map(q=>q.category))].sort();
console.log('V47_REVIEW_CATEGORIES '+JSON.stringify(executed));
assert.ok(executed.includes('EYE01')&&executed.includes('EYE02'));
assert.ok(on.runners.every(h=>h.v47.cardRoutes.every(p=>p.axisJudgments.length===5)));
assert.ok(reviews.every(r=>r.independent_vote===false&&r.refs.every(k=>request.envelope.packet.evidence.some(e=>e.evidenceId===k))));
console.log('V47_ROUTE_EVIDENCE PASS');
const all=Object.fromEntries(p.supply.runners.map(h=>[h.horse_id,h.categories.flatMap(c=>c.claims.map(q=>q.claim_id))]));
const dupe=await run({work42Selection:Object.fromEntries(Object.entries(all).map(([h,v])=>[h,[...v,v[0],'UNVERIFIED']]))});
assert.deepEqual(dupe.runners,on.runners);
// Internal alias-only control: public API accepts IDs, not claims. Clone one
// verified claim under a new ID and verify identical semantic output.
const h=p.supply.runners[0],claim=h.categories[0].claims[0],compiled=compileReturn(p.supply,h.horse_id,[claim.claim_id]);
const alias=structuredClone(compiled);for(const item of alias.items)item.claims.push({...claim,claim_id:'ALIAS_DIFFERENT_ID'});
assert.deepEqual(semanticItems(compiled,docs,request.envelope.packet,h.horse_id,{strict:true}),semanticItems(alias,docs,request.envelope.packet,h.horse_id,{strict:true}));
console.log('V47_ALIAS_DEDUP PASS');
const u='FK34_UNKNOWN',q=acceptedRequest(V,u),ue=makeEnvelope(V.C.fixtures.find(f=>f.id===u).docs);
const unknown=await analyzeVerified(V,q.request,q.receipt,{semanticVersion:47,work42Envelope:ue});
assert.ok(unknown.runners.every(h=>h.v47.conditionalCurrentResearchGrade===null&&h.v47.cardRoutes.every(p=>p.state==='HELD'&&p.decisiveUnknown.length)));
console.log('V47_DECISIVE_UNKNOWN PASS');
const sealed=[{request,hidden:{winner:'TEST:H1'}},{request:structuredClone(request),hidden:{winner:'TEST:H5'}}];
const z=await analyzeVerified(V,sealed[1].request,receipt,{semanticVersion:47,work42Envelope:envelope});
assert.deepEqual(z,on);
await assert.rejects(()=>analyzeVerified(V,{...request,sealedResult:sealed[1].hidden},receipt,{semanticVersion:47,work42Envelope:envelope}));
console.log('V47_RESULT_BOUNDARY PASS');

function scenario(name,time,first,end){
 const d=structuredClone(docs[1]);d.eventId='TEST:'+name;d.eventAt=time;d.publishedAt=time+1;d.updatedAt=time+2;
 const starts=[48000,48050,49000,49200,49400];
 d.rows=d.rows.map((r,i)=>({...r,clockMs:end[i],final600Ms:end[i]-starts[i],checkpointMs:[first[i],starts[i],starts[i]+Math.round((end[i]-starts[i])*2/3)]}));
 for(const r of d.rows){r.finish=1+d.rows.filter(q=>q.clockMs<r.clockMs).length;r.officialMargin=r.finish===1?null:'TEST_LITERAL';r.checkpointRanks=r.checkpointMs.map((v,j)=>1+d.rows.filter(q=>q.checkpointMs[j]<v).length);}
 const v=[0,...[0,1,2].map(j=>Math.min(...d.rows.map(r=>r.checkpointMs[j]))),Math.min(...end)];d.leaderLaps.valuesMs=v.slice(1).map((x,i)=>x-v[i]);
 d.passing.groups=[...d.rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]);
 return d;
}
const card=structuredClone(docs[0]);card.eventId='TEST:V46_TARGET';
const overlap=[12000,12050,12400,12600,12800],separate=[12000,12150,12400,12600,12800];
const aw=[84000,85000,86500,87000,87500],bw=[85000,84000,86500,87000,87500];
const sd=[card,scenario('V46_OA',10,overlap,aw),scenario('V46_OB',20,overlap,bw),scenario('V46_SA',30,separate,aw),scenario('V46_SB',40,separate,bw)];
async function synthetic(name,docs,options={}){
 const envelope=makeEnvelope(docs),p=await prepareSupply(envelope,{id:name});
 return analyzeVerified(V,p.request,p.receipt,{semanticVersion:47,work42Envelope:envelope,...options});
}

const multi=await synthetic('V47_MULTI',sd);
const labels=z=>z.runners.map(h=>h.v47.conditionalCurrentResearchGrade);
console.log('V47_BOUNDARY_DETAIL '+JSON.stringify({baseline:labels(on),multi:labels(multi),unknown:labels(unknown)}));
assert.deepEqual(labels(on),['B','A',null,'A','C']);
assert.deepEqual(labels(multi),['S','S','C','C','C']);
assert.ok(labels(unknown).every(x=>x===null));
console.log('V47_SABC_BOUNDARIES PASS');
const cats=['EYE01','EYE02','EYE05','EYE07','EYE08','EYE09','EYE10','EYE11','EYE12'];
const effect=[];
for(const cat of cats){
 const selection=Object.fromEntries(p.supply.runners.map(h=>[h.horse_id,h.categories.filter(c=>c.category!==cat).flatMap(c=>c.claims.map(q=>q.claim_id))]));
 const z=await run({work42Selection:selection});
 assert.equal(z.digest,on.digest);
 const before=on.runners.flatMap(h=>h.v47.cardRoutes.flatMap(p=>p.eyeReviews.filter(r=>r.category===cat).map(r=>({horse:h.horse,route:p.id,...r}))));
 assert.ok(before.some(r=>!r.state.startsWith('HELD')),cat+' no witness');
 assert.ok(z.runners.every(h=>h.v47.cardRoutes.every(p=>p.eyeReviews.every(r=>r.category!==cat))));
 const touched=on.runners.flatMap(h=>h.v47.cardRoutes.filter(p=>p.eyeReviews.some(r=>r.category===cat&&!r.state.startsWith('HELD'))));
 const changes=on.runners.flatMap(h=>h.v47.cardRoutes.flatMap(p=>{const q=z.runners.find(x=>x.horse===h.horse).v47.cardRoutes.find(x=>x.id===p.id);return p.state!==q.state?[p.id]:[]}));
 const example=before.find(r=>['MEASURED_PEER_REVERSAL_COUNTER','SECTION_BETTER_THAN_FINISH','OBSERVED_ROLE_ALTERNATIVE_OUTSIDE_LAST_PROXY','OBSERVED_FLANK_ROLE_ALTERNATIVE','OBSERVED_RIVAL_COUNT_LOWER','BETTER_OBSERVED_START_ALTERNATIVE'].includes(r.state))??before.find(r=>!r.state.startsWith('HELD'));
 effect.push({cat,axes:[...new Set(touched.flatMap(p=>p.eyeReviews.filter(r=>r.category===cat).map(r=>r.axis)))],reviewedRoutes:touched.length,changedRouteState:changes.length,labels:labels(z),example:{horse:example.horse,state:example.state,value:example.value}});
}
console.log('V47_CATEGORY_ABLATION PASS '+JSON.stringify(effect));
