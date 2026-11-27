import assert from 'node:assert/strict';
import {loadV40,acceptedRequest,analyzeVerified} from './v43-generic.mjs';
import {prepareSupply} from '../../reborn2-work42/codex-contract-v0.4.mjs';
import {makeEnvelope} from '../../reborn2-work42/validate-v0.4.mjs';
const V=await loadV40(),id='FK34_FULL',docs=V.C.fixtures.find(f=>f.id===id).docs;
const {request,receipt}=acceptedRequest(V,id),envelope=makeEnvelope(docs);
const p=await prepareSupply(envelope,{id});
const run=(options={})=>analyzeVerified(V,request,receipt,{semanticVersion:46,work42Envelope:envelope,...options});
const on=await run(),none=await run({work42Selection:{}});
assert.equal(on.digest,none.digest);assert.equal(on.groups,118);assert.equal(on.held,826);
assert.ok(on.runners.every(h=>h.itemConsumption.length===115&&h.grade===null&&h.current_grade===null&&h.v46.categoryReview.length===15));
const summary=on.runners.map(h=>({horse:h.horse,prior:h.research_grade,currentResearch:h.v46.conditionalCurrentResearchGrade,items:h.itemConsumption.filter(i=>i.semanticV46.length).map(i=>i.item),categories:h.v46.categoryReview.map(c=>({id:c.category,state:c.state,predicates:[...new Set(c.facts.map(f=>f.state))]})),routes:h.v46.cardRoutes.reduce((a,p)=>(a[p.state]=(a[p.state]??0)+1,a),{}),recovery:h.v46.cardRoutes.some(p=>p.recovery),retained:h.v46.cardRoutes.some(p=>p.retained)}));
console.log('V46_FIELD '+JSON.stringify(summary));
const cats=[...new Set(on.runners.flatMap(h=>h.v46.categoryReview.filter(c=>c.facts.length).map(c=>c.category)))];
assert.deepEqual(cats.sort(),['EYE01','EYE02','EYE05','EYE07','EYE08','EYE09','EYE10','EYE11','EYE12','EYE13']);
assert.ok(on.runners.every(h=>h.v46.categoryReview.filter(c=>['EYE04','EYE06','EYE14','EYE15'].includes(c.category)).every(c=>!c.facts.length)));
assert.ok(none.runners.every(h=>h.itemConsumption.every(i=>!i.semanticV46.length)));
console.log('V46_CATEGORY_KERNELS PASS');
const routes=on.runners.flatMap(h=>h.v46.cardRoutes);
assert.ok(routes.some(p=>p.state==='SUPPORTED_CONDITIONAL_WIN'&&p.recovery));assert.ok(routes.some(p=>p.state==='SUPPORTED_CONDITIONAL_WIN'&&p.retained));
assert.ok(routes.every(p=>p.own.every(e=>e.physicalLoad==='NOT_OBSERVED')));
assert.ok(routes.filter(p=>p.state==='SUPPORTED_CONDITIONAL_WIN').every(p=>Object.values(p.axes).every(Boolean)&&p.matchedCard&&p.sourceValid));
console.log('V46_CARD_ROUTE_BASIS PASS');
const all=Object.fromEntries(p.supply.runners.map(h=>[h.horse_id,h.categories.flatMap(c=>c.claims.map(q=>q.claim_id))]));
const dup=await run({work42Selection:Object.fromEntries(Object.entries(all).map(([h,v])=>[h,[...v,v[0],'UNVERIFIED']]))});
assert.deepEqual(dup.runners,on.runners);
console.log('V46_DUPLICATE_CONTROL PASS');
const u='FK34_UNKNOWN',q=acceptedRequest(V,u),ue=makeEnvelope(V.C.fixtures.find(f=>f.id===u).docs);
const unknown=await analyzeVerified(V,q.request,q.receipt,{semanticVersion:46,work42Envelope:ue});
assert.ok(unknown.runners.every(h=>h.v46.conditionalCurrentResearchGrade===null&&h.v46.cardRoutes.every(p=>p.state==='HELD')));
console.log('V46_UNKNOWN_HOLD PASS');

// Same synthetic control domain as V45: two competitive horses, two
// observed early-role contexts, four independent past response events.
// Expected labels are assertions only, never engine inputs.
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
 return analyzeVerified(V,p.request,p.receipt,{semanticVersion:46,work42Envelope:envelope,...options});
}
const multi=await synthetic('V46_MULTI',sd);
const compact=h=>({horse:h.horse,old:h.research_grade,grade:h.v46.conditionalCurrentResearchGrade,roles:h.v46.decisionBasis.roles,complete:h.v46.decisionBasis.complete,allCompetitive:h.v46.decisionBasis.allCompetitive,unknown:h.v46.decisionBasis.materialUnknown.length,excluded:h.v46.decisionBasis.excluded.length,win:h.v46.decisionBasis.win.length,place:h.v46.decisionBasis.place.length,responseChanges:h.v46.decisionBasis.responseSensitivity.map(q=>({before:q.before,after:q.after,earlier:q.earlier,later:q.later,materialCounter:q.materialCounter}))});
console.log('V46_BOUNDARY_DETAIL '+JSON.stringify({baseline:on.runners.map(compact),multi:multi.runners.map(compact)}));
assert.ok(multi.runners.filter(h=>h.v46.conditionalCurrentResearchGrade==='S').length>=2,'S_MULTIPLE_WITNESS');
assert.ok(multi.runners.some(h=>h.v46.conditionalCurrentResearchGrade==='C'),'AFFIRMATIVE_C_WITNESS');
assert.ok(on.runners.every(h=>h.v46.conditionalCurrentResearchGrade!=='S'),'S_ABSENT_WITNESS');
assert.ok(unknown.runners.every(h=>h.v46.conditionalCurrentResearchGrade===null));
assert.ok(multi.runners.every(h=>h.grade===null&&h.current_grade===null));
console.log('V46_GRADE_BOUNDARIES PASS');

const without13=await run({work42Selection:Object.fromEntries(p.supply.runners.map(h=>[h.horse_id,h.categories.filter(c=>c.category!=='EYE13').flatMap(c=>c.claims.map(q=>q.claim_id))]))});
assert.equal(without13.digest,on.digest);
assert.ok(without13.runners.every(h=>h.v46.decisionBasis.responseSensitivity.length===0));
const h2=on.runners.find(h=>h.horse.endsWith('|TEST:H2')),h2off=without13.runners.find(h=>h.horse===h2.horse);
const witness=h2.v46.decisionBasis.responseSensitivity.find(q=>q.before[0]===1&&q.before[1]===1&&q.after[0]===4&&q.after[1]===4&&q.materialCounter);
assert.ok(witness,'NO_EYE13_MATERIAL_RESPONSE_WITNESS');
assert.ok(h2.v46.cardRoutes.some(p=>p.responseReview.some(q=>q.earlier===witness.earlier)&&p.robustAcrossReviewedResponses===false));
assert.ok(h2.itemConsumption.find(i=>i.item==='RANK100').responseSensitivity.length);
assert.ok(h2off.itemConsumption.find(i=>i.item==='RANK100').responseSensitivity.length===0);
assert.deepEqual(h2.v46.cardRoutes.map(p=>[p.id,p.state]),h2off.v46.cardRoutes.map(p=>[p.id,p.state]));
console.log('V46_EYE13_SAME_PACKET_RESPONSE_REVIEW PASS '+JSON.stringify({horse:h2.horse,before:witness.before,after:witness.after,delta:witness.delta,materialCounter:witness.materialCounter,grade:[h2off.v46.conditionalCurrentResearchGrade,h2.v46.conditionalCurrentResearchGrade],scope:'ROBUSTNESS_JUDGMENT_NOT_NEW_WIN_ROUTE'}));
