import assert from 'node:assert/strict';
import {validateEnvelope,eyeSupply,sha} from './supply-v0.3.mjs';
import {loadV40} from '../reborn2-chatgpt-circuit/work36-v40-integrated.mjs';
import {analyze} from '../reborn2-chatgpt-circuit/work36-v41-local-decision.mjs';
import {integrate} from '../reborn2-chatgpt-circuit/work36-v42-propagation.mjs';
import {run31,pipeline31,verifier31} from '../reborn2-chatgpt-circuit/work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
let loaded;
export async function analyzeSupply(envelope,{eyeEnabled=true}={}){
 const validated=validateEnvelope(envelope),{docs,roots,analysisSha256}=validated;
 const V=await (loaded??=loadV40()),id='GENERIC_'+analysisSha256.slice(0,24);
 const {input,registry,out}=run31(docs,V.C.canonical,sha);
 assert.equal(out.state,'TEST_PACKET',JSON.stringify(out));
 const txt=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:V.C.canonical,cases:[{n:id,input,registry,expectedDigest:out.digest}]})+'\n';
 const bundle=sha(txt),verified=V.C.verify32(txt,id,out,sha,pipeline31,verifier31,bundle);
 assert.equal(verified.state,'VERIFIED_SYNTHETIC_ENVELOPE');
 const pin={id,source_digest:out.digest,bundle_sha256:bundle,evidence:out.packet.evidence.length,itemRows:docs[0].rows.length*115,blob:null};
 const W={...V,C:{...V.C,fixtures:[...V.C.fixtures,{id,docs}],receipt:{summary:[...V.C.receipt.summary,pin]}},fixed:new Map([...V.fixed,[id,{raw:{raw:docs},pin}]])};
 const common=analyze(W,id,{eyeEnabled}),decision=integrate(common,docs,{eyeEnabled});
 assert.equal(decision.digest,out.digest);assert.equal(common.groups,118);assert.equal(common.held,826);
 assert.equal(decision.runners.length,docs[0].rows.length);assert.ok(decision.runners.every(h=>h.items.length===115&&h.grade===null));
 const evidence=out.packet.evidence.map(e=>{
  const doc=roots.find(r=>r.eventId===e.event&&r.pointer==='/'),row=roots.find(r=>r.eventId===e.event&&r.horseId===e.subject);
  // Native producer has event-level rows and peer followups; never silently assign a wrong horse.
  assert.ok(doc,'COMMON_EVENT_ROOT:'+e.event);return {id:e.evidenceId,event:e.event,subject:e.subject,field:e.field,commonRoot:e.root,depends:e.dependencies,sourceRoot:doc.id,rowRoot:row?.id??null};
 });
 const rootIds=new Set(roots.map(r=>r.id));assert.ok(roots.every(r=>r.depends.every(x=>rootIds.has(x))));
 const categories=eyeSupply(validated);
 assert.equal(categories.length,docs[0].rows.length);assert.ok(categories.every(h=>h.categories.length===15&&h.categories.every(c=>c.observations.every(o=>o.refs.length&&o.refs.every(r=>rootIds.has(r))))));
 return {scope:'SYNTHETIC_ONLY',analysisSha256,commonSha256:out.digest,groups:common.groups,held:common.held,roots,evidence,categories,common,decision,formal:false,eyeEnabled};
}
