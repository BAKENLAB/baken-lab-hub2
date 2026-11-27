import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadV40,acceptedRequest,verifyIntake,analyzeVerified} from './v43-generic.mjs';
const V=await loadV40();
const compact=z=>({id:z.id,digest:z.digest,evidence:z.evidence,groups:z.groups,held:z.held,runners:z.runners.map(h=>({horse:h.horse,grade:h.research_grade,current:h.current_grade,summary:h.summary,reasons:h.gradeReasons,axes:h.axes.map(a=>({axis:a.axis,state:a.state,support:a.support.length,counter:a.counter.length,unknown:a.unknown})),feedback:h.feedback.map(f=>({rival:f.rival,before:f.before,after:f.after,bounds:f.bounds,state:f.state,events:f.events})),rootGroups:h.rootGroups.length,items:h.itemConsumption.length,sourceComplete:h.sourceComplete}))});
const receipts=[];
for(const name of ['FK34_FULL','FK34_DISCOVERY','W36_BASE','W36_POSITIVE','W36_CONTEXT_WEIGHT','FK34_UNKNOWN']){
 const {request,receipt}=acceptedRequest(V,name);
 const on=await analyzeVerified(V,request,receipt);
 assert.equal(on.digest,receipt.source_digest);
 assert.equal(on.runners.length,5);
 assert.ok(on.runners.every(h=>h.current_grade===null&&h.grade===null&&h.itemConsumption.length===115));
 assert.ok(on.runners.every(h=>new Set(h.rootGroups.map(q=>q.root)).size===h.rootGroups.length));
 if(name==='FK34_UNKNOWN')assert.ok(on.runners.every(h=>h.research_grade===null));
 receipts.push({request,receipt,on});
 console.log('V43_FIELD '+JSON.stringify(compact(on)));
}
const {request,receipt,on}=receipts[0];
const off=await analyzeVerified(V,request,receipt,{eyeEnabled:false});
assert.equal(off.digest,on.digest);
assert.ok(off.runners.every(h=>h.feedback.length===0));
const deltas=on.runners.map(h=>{
 const b=off.runners.find(x=>x.horse===h.horse);
 const before=new Map(b.paths.map(p=>[p.id,p]));
 return {horse:h.horse,grade:[b.research_grade,h.research_grade],reviews:h.paths.filter(p=>before.get(p.id)?.review!==p.review).map(p=>({id:p.id,before:before.get(p.id)?.review,after:p.review,materialCounter:p.materialCounter})),feedback:h.feedback};
});
assert.ok(deltas.some(h=>h.feedback.length>0));
console.log('V43_SAME_PACKET_EYE '+JSON.stringify({digest:on.digest,deltas}));
// Same flag, same sealed analysis payload, distinct result storage. No result
// payload crosses the analysis API. This is a logical API boundary, not OS isolation.
const separate=[{analysis:request,sealedResult:{winner:'TEST:H1'}},{analysis:structuredClone(request),sealedResult:{winner:'TEST:H5'}}];
const repeat=await analyzeVerified(V,separate[1].analysis,receipt,{eyeEnabled:true});
assert.deepEqual(repeat,on);
assert.notDeepEqual(separate[0].sealedResult,separate[1].sealedResult);
assert.throws(()=>verifyIntake(V,{...request,sealedResult:separate[1].sealedResult},receipt));
const sha=x=>createHash('sha256').update(x).digest('hex');
for(const mutate of [
 q=>q.bundleText+=' ',
 q=>{q.envelope.packet.evidence[0].value={no:999};q.envelope.digest=sha(JSON.stringify(q.envelope.packet));},
 q=>{q.id='OTHER';},
 q=>{const b=JSON.parse(q.bundleText);b.cases[0].input.documents[0].bytes.push(32);q.bundleText=JSON.stringify(b)+'\n';}
]){
 const q=structuredClone(request);mutate(q);assert.throws(()=>verifyIntake(V,q,receipt));
}
console.log('V43_GENERIC_CONTROL PASS '+JSON.stringify({cases:receipts.length,independentReceipts:receipts.length,identicalSameFlagFullOutput:true,sealedResultExcluded:true,formal:false}));
