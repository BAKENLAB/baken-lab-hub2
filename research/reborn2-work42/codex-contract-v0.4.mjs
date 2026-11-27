// Codex integration entry: derives the packet exclusively from validated raw
// bytes, verifies it using the exact common producer, returns field-specific
// native dependencies and canonical target items. No self-issued real custody.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateEnvelope,sha} from './validate-v0.4.mjs';
import {buildSupply} from './eye-supply-v0.4.mjs';
import {run31,pipeline31,verifier31} from '../reborn2-chatgpt-circuit/work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
import {loadV40} from '../reborn2-chatgpt-circuit/work36-v40-integrated.mjs';
let loaded;
export async function prepareSupply(envelope,{id}={}){
 const validated=validateEnvelope(envelope),V=await (loaded??=loadV40()),canonical=V.C.canonical;
 const name=id??'WORK42_'+validated.analysisSha256.slice(0,24);
 assert.match(name,/^[A-Za-z0-9_-]+$/);
 const {input,registry,out}=run31(validated.docs,canonical,sha);
 assert.equal(out.state,'TEST_PACKET');assert.equal(out.digest,sha(JSON.stringify(out.packet)));
 const bundleText=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical,cases:[{n:name,input,registry,expectedDigest:out.digest}]})+'\n';
 const receipt={id:name,source_digest:out.digest,bundle_sha256:sha(bundleText),evidence:out.packet.evidence.length,itemRows:validated.docs[0].rows.length*115,blob:null};
 const verified=V.C.verify32(bundleText,name,out,sha,pipeline31,verifier31,receipt.bundle_sha256);
 assert.equal(verified.state,'VERIFIED_SYNTHETIC_ENVELOPE');
 const supply=buildSupply(envelope,out.packet);
 assert.equal(supply.commonSha256,receipt.source_digest);
 return {request:{id:name,bundleText,envelope:out},receipt,supply,scope:'SYNTHETIC_SELF_REPLAY_NOT_EXTERNAL_CUSTODY',formal:false};
}

// Route review inputs to canonical RANK items. This is not a decision engine.
// All directions and unknowns remain attached; aliases cannot add a vote.
export function compileReturn(supply,horse,requestedIds){
 const runner=supply.runners.find(r=>r.horse_id===horse);assert.ok(runner,'HORSE_NOT_IN_SUPPLY');
 const known=new Map(runner.categories.flatMap(c=>c.claims).map(q=>[q.claim_id,q]));
 const chosen=[],rejected=[],seen=new Set();
 for(const id of requestedIds){if(!known.has(id)){rejected.push({id,reason:'IRRELEVANT_OR_UNVERIFIED_CLAIM'});continue;}if(seen.has(id)){rejected.push({id,reason:'DUPLICATE_CLAIM'});continue;}seen.add(id);chosen.push(known.get(id));}
 const itemMap=new Map();
 for(const q of chosen){for(const item of q.upstream_item_ids){const a=itemMap.get(item)??[];a.push(q);itemMap.set(item,a);}}
 const items=[...itemMap].sort(([a],[b])=>a.localeCompare(b)).map(([item,claims])=>({item,claims,dependency_ids:[...new Set(claims.flatMap(q=>q.evidence_ids))].sort(),semantic_root_keys:[...new Set(claims.flatMap(q=>q.semantic_root_keys))].sort(),supporting_antecedents:claims.filter(q=>q.status==='SUPPORT_ANTECEDENT').map(q=>q.claim_id),counter_antecedents:claims.filter(q=>q.status==='COUNTER_ANTECEDENT').map(q=>q.claim_id),unresolved:claims.filter(q=>!['SUPPORT_ANTECEDENT','COUNTER_ANTECEDENT'].includes(q.status)).map(q=>q.claim_id),current_confirmation:false,independent_vote:false}));
 return {schema:'WORK42_CANONICAL_RETURN_REVIEW_0.4',horse_id:horse,source_digest:supply.commonSha256,items,rejected,formal:false,grade_effect:false};
}
