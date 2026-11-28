// Operator-controlled offline review, NOT admission or analysis.
// Run only inside authorized restricted directory. No network/DB access.
// Usage: node review-local.mjs signed-manifest.json source-trust.json raw-index.json private-review.json
import {readFileSync,statSync,writeFileSync} from 'node:fs';
import {verifyApprovedManifest} from '../reborn2-work08/offline-converter.mjs';
import {prepareNativeReviewOffline} from '../reborn2-pilot/native-graph-issuance.mjs';
const [manifest,trust,index,out,...extra]=process.argv.slice(2);
if(!manifest||!trust||!index||!out||extra.length)throw Error('LOCAL_ARGUMENTS_REQUIRED');
const read=p=>{if(statSync(p).size>16*1024*1024)throw Error('JSON_LIMIT');return JSON.parse(readFileSync(p,'utf8'));};
const signedManifest=read(manifest),sourceTrust=read(trust),paths=read(index);
const approved=verifyApprovedManifest(signedManifest,sourceTrust);
const ids=approved.documents.map(d=>d.id).sort();
if(JSON.stringify(Object.keys(paths).sort())!==JSON.stringify(ids))throw Error('RAW_INVENTORY_MISMATCH');
const raws=new Map(Object.entries(paths).map(([id,p])=>{
 if(typeof p!=='string'||!statSync(p).isFile()||statSync(p).size>16*1024*1024)throw Error('LOCAL_RAW_FILE_LIMIT');
 return [id,readFileSync(p)];
}));
const draft=prepareNativeReviewOffline({version:'08',signedManifest,raws,sourceTrust});
if(draft.analysisExecuted!==false||draft.realAdmission!==false||draft.approvalIssued!==false)throw Error('UNEXPECTED_REVIEW_STATE');
writeFileSync(out,JSON.stringify(draft,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({scope:draft.scope,closure:draft.closure,documentCount:draft.documents.length,factCount:draft.facts.length,analysisExecuted:false,realAdmission:false}));
