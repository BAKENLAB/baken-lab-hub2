// V44 research bridge: exact Work41 corrected intake -> existing V43 verified entrance.
// Independent receipt must be supplied by a trusted caller; never mint it here.
import assert from 'node:assert/strict';
import {validateEnvelope,eyeSupply,sha} from '../../reborn2-work41-corrected/supply-v0.3.mjs';
import {run31} from '../../reborn2-chatgpt-circuit/work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
import {analyzeVerified} from './v43-generic.mjs';
export async function analyzeWork41Verified(V,envelope,receipt,{eyeEnabled=true}={}){
 const validated=validateEnvelope(envelope);
 assert.equal(validated.analysisSha256,receipt.work41_analysis_sha256,'INDEPENDENT_WORK41_PIN');
 const {docs,roots}=validated;
 const {input,registry,out}=run31(docs,V.C.canonical,sha);
 assert.equal(out.state,'TEST_PACKET');
 const bundleText=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:V.C.canonical,cases:[{n:receipt.id,input,registry,expectedDigest:out.digest}]})+'\n';
 const analysis=await analyzeVerified(V,{id:receipt.id,bundleText,envelope:out},receipt,{eyeEnabled});
 const categories=eyeSupply(validated);
 // Work41 sidecar directions are observations, not reviewed canonical effects.
 // In particular UNKNOWN participation and EYE13 semantics remain quarantined.
 const supplyReview=categories.map(h=>({horse:h.horse,status:h.status,categories:h.categories.map(c=>({...c,canonical_positive:false,decision_effect:false,review:['EYE09','EYE10','EYE11','EYE13'].includes(c.category)?'HELD_KNOWN_SUPPLY_SEMANTIC_DEFECT':'UNREVIEWED_ANTECEDENT'}))}));
 const rootMap=out.packet.evidence.map(e=>{
  const doc=roots.find(r=>r.eventId===e.event&&r.pointer==='/'),row=roots.find(r=>r.eventId===e.event&&r.horseId===e.subject);
  assert.ok(doc,'WORK41_SOURCE_ROOT');
  return {id:e.evidenceId,commonRoot:e.root,sourceRoot:doc.id,rowRoot:row?.id??null,depends:e.dependencies};
 });
 return {...analysis,work41:{analysisSha256:validated.analysisSha256,roots,rootMap,supplyReview,semanticReturn:'NOT_COMPLETED'},formal:false};
}
