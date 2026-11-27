import assert from 'node:assert/strict';
import {loadV40,acceptedRequest,analyzeVerified} from './v43-generic.mjs';
import {makeEnvelope} from '../../reborn2-work42/validate-v0.4.mjs';
import {prepareSupply} from '../../reborn2-work42/codex-contract-v0.4.mjs';
const V=await loadV40(),id='FK34_FULL',docs=V.C.fixtures.find(f=>f.id===id).docs;
const {request,receipt}=acceptedRequest(V,id),envelope=makeEnvelope(docs);
const p=await prepareSupply(envelope,{id});
assert.deepEqual(p.request,request);
const run=(options={})=>analyzeVerified(V,request,receipt,{work42Envelope:envelope,...options});
const on=await run(),off=await run({eyeEnabled:false}),none=await run({work42Selection:{}});
assert.equal(on.digest,off.digest);assert.equal(on.digest,none.digest);assert.equal(on.evidence,537);
assert.equal(on.groups,118);assert.equal(on.held,826);
assert.ok(on.runners.every(h=>h.itemConsumption.length===115&&h.grade===null&&h.current_grade===null));
assert.ok(on.work42.otherCategories==='ROUTED_NOT_YET_SEMANTICALLY_CONSUMED');
console.log('V45_NATIVE_SUPPLY PASS');
const differences=on.runners.map(h=>{
 const b=none.runners.find(q=>q.horse===h.horse),o=off.runners.find(q=>q.horse===h.horse);
 const changes=h.itemConsumption.filter(i=>i.item.startsWith('RANK')&&JSON.stringify(i.semantic)!==JSON.stringify(b.itemConsumption.find(q=>q.item===i.item).semantic)).map(i=>i.item);
 const rank100=h.itemConsumption.find(i=>i.item==='RANK100').routeFacts,base=b.itemConsumption.find(i=>i.item==='RANK100').routeFacts;
 const routes=rank100.flatMap(q=>{const x=base.find(r=>r.id===q.id);return x&&x.decision!==q.decision?[{id:q.id,before:x.decision,after:q.decision,original:q.conditionalDecision,reviews:q.recoveryReviews}]:[]});
 const axes=h.axes.filter(a=>JSON.stringify(a)!==JSON.stringify(b.axes.find(q=>q.axis===a.axis))).map(a=>a.axis);
 return {horse:h.horse,changes,routes,axes,feedback:h.feedback.map(f=>({id:f.id,before:f.before,after:f.after,bounds:f.bounds})),grade:[b.research_grade,h.research_grade],offGrade:o.research_grade};
});
assert.ok(differences.some(h=>h.changes.includes('RANK18')&&h.changes.includes('RANK21')&&h.feedback.length));
assert.ok(differences.some(h=>h.routes.length&&h.axes.some(a=>a!=='E')));
assert.ok(differences.flatMap(h=>h.routes).every(r=>r.after==='HELD'&&r.reviews.length&&r.original===r.before));
console.log('V45_EYE03_RECOMPUTED PASS '+JSON.stringify(differences));
const all=Object.fromEntries(p.supply.runners.map(h=>[h.horse_id,h.categories.flatMap(c=>c.claims.map(q=>q.claim_id))]));
const dup=Object.fromEntries(Object.entries(all).map(([h,ids])=>[h,[...ids,ids[0],'UNVERIFIED']]));
const d=await run({work42Selection:dup});
assert.deepEqual(d.runners,on.runners);
assert.ok(Object.values(d.work42.returns).every(q=>q.rejected.length===2));
const irrelevant=await run({work42Selection:Object.fromEntries(Object.keys(all).map(h=>[h,['UNVERIFIED']]))});
assert.deepEqual(irrelevant.runners,none.runners);
console.log('V45_DUPLICATE_IRRELEVANT PASS');
const altered=structuredClone(envelope);altered.documents[1].raw+=' ';
await assert.rejects(()=>analyzeVerified(V,request,receipt,{work42Envelope:altered}),/RAW_HASH/);
console.log('V45_SOURCE_BINDING PASS');
console.log('V45_FIELD '+JSON.stringify(on.runners.map(h=>({horse:h.horse,grade:h.research_grade,formal:h.grade,axes:h.axes.map(a=>[a.axis,a.state]),acceptedWin:h.acceptedWinRoutes,acceptedPlace:h.acceptedPlaceRoutes,summary:h.summary,reasons:h.gradeReasons}))));

// Targeted independent arithmetic control: a never-winner with a measured
// closing section in a defeat, plus a separate observed smaller-deficit
// vector. Synthetic intervention only; no claim that the reference's
// hypothetical 35.5 s was measured in the original Work42 packet.
function controlHistory(template,event,time,starts,ends){
 const d=structuredClone(template);d.eventId='TEST:'+event;d.eventAt=time;d.publishedAt=time+1;d.updatedAt=time+2;
 d.rows=d.rows.map((r,i)=>({...r,nativeId:'TEST:'+'ABCDE'[i],weightG:56000,clockMs:ends[i],final600Ms:ends[i]-starts[i],checkpointMs:[Math.round(starts[i]*.27),starts[i],starts[i]+Math.round((ends[i]-starts[i])*2/3)]}));
 for(const row of d.rows){
  row.finish=1+d.rows.filter(q=>q.clockMs<row.clockMs).length;row.officialMargin=row.finish===1?null:'TEST_LITERAL';
  row.checkpointRanks=row.checkpointMs.map((v,j)=>1+d.rows.filter(q=>q.checkpointMs[j]<v).length);
 }
 const c=[0,...[0,1,2].map(j=>Math.min(...d.rows.map(r=>r.checkpointMs[j]))),Math.min(...ends)];
 d.leaderLaps.valuesMs=c.slice(1).map((v,i)=>v-c[i]);
 d.passing.groups=[...d.rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]);
 return d;
}
const card=structuredClone(docs[0]);card.eventId='TEST:V45_TARGET';card.rows=card.rows.map((r,i)=>({...r,nativeId:'TEST:'+'ABCDE'[i],weightG:56000}));
const start=[48200,47800,48300,48500,48800],end=[84300,84700,84500,85400,85900];
const responseStart=[48400,47700,49500,49700,49800],responseEnd=[84500,84800,85000,85800,86100];
const response=controlHistory(docs[1],'V45_RESPONSE',10,responseStart,responseEnd);
const source=controlHistory(docs[1],'V45_START',20,start,end);
const strongEnd=responseEnd.map((v,i)=>i===1?83200:v),strongResponse=controlHistory(docs[1],'V45_RESPONSE_STRONG',10,responseStart,strongEnd);
const cross=(ends)=>start.map((v,i)=>v+ends[i]-responseStart[i]);
const baselineVector=cross(responseEnd),counterVector=cross(strongEnd);
assert.equal(baselineVector[2],83800);assert.equal(Math.min(...baselineVector),baselineVector[2]);assert.equal(Math.min(...counterVector),counterVector[1]);
assert.ok([response,strongResponse,source].every(d=>d.rows[2].finish>1));
async function syntheticCase(name,docs){
 const envelope=makeEnvelope(docs),p=await prepareSupply(envelope,{id:name});
 // Newly authored fixture: self-replayed synthetic receipt, not external custody.
 const z=await analyzeVerified(V,p.request,p.receipt,{work42Envelope:envelope});
 return z;
}
const normal=await syntheticCase('V45_NONWINNER',[card,response,source]),strong=await syntheticCase('V45_PEER_COUNTER',[card,strongResponse,source]);
const find=(z)=>z.runners.find(h=>h.horse.endsWith('|TEST:C'));
const cn=find(normal),cs=find(strong),route=(h,ev)=>h.paths.find(p=>p.start.endsWith('|TEST:V45_START')&&p.response.endsWith('|TEST:'+ev)&&p.checkpoint===800);
const pn=route(cn,'V45_RESPONSE'),ps=route(cs,'V45_RESPONSE_STRONG');
const compact=(h,p)=>({grade:h.research_grade,path:p?{id:p.id,decision:p.decision,claimSupport:p.claimSupport,historicalReplay:p.historicalReplayDecision}:null,acceptedWin:h.acceptedWinRoutes,summary:h.summary});
console.log('V45_NONWINNER_DETAIL '+JSON.stringify({normal:compact(cn,pn),stronger:compact(cs,ps),baselineVector,counterVector,scope:'NEW_SYNTHETIC_CONTROL_ONLY'}));
assert.ok(pn&&pn.decision==='CONDITIONAL_WIN'&&pn.historicalReplayDecision!=='CONDITIONAL_WIN'&&cn.acceptedWinRoutes.includes(pn.id));
assert.ok(ps&&ps.decision!=='CONDITIONAL_WIN'&&!cs.acceptedWinRoutes.includes(ps.id));
assert.ok(normal.runners.every(h=>h.grade===null&&h.current_grade===null)&&strong.runners.every(h=>h.grade===null&&h.current_grade===null));
console.log('V45_NONWINNER_PEER_CONTRAST PASS');
// Known pair contradiction must remain rejected even if an unrelated row
// is missing; V43 must not skip validation merely because field is partial.
const contradicted=structuredClone([card,response,source]);contradicted[1].rows[4].checkpointMs=null;contradicted[1].rows[4].checkpointRanks=null;
const swap=contradicted[1].rows[0].checkpointRanks[1];contradicted[1].rows[0].checkpointRanks[1]=contradicted[1].rows[1].checkpointRanks[1];contradicted[1].rows[1].checkpointRanks[1]=swap;
await assert.rejects(()=>syntheticCase('V45_PARTIAL_CONFLICT',contradicted),/KNOWN_PAIR_CHECKPOINT_CONFLICT|TEST_PACKET|VERIFIED_SYNTHETIC_ENVELOPE/);
console.log('V45_PARTIAL_CONTRADICTION PASS');
