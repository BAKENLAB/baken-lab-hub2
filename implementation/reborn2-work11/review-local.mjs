// Private local operator, approved materials only. No network, DB, or analysis.
// Replay exact original HTML before Codex08 review. Neither source trust nor
// the resulting draft is admission authority. Output is local and exclusive.
// node review-local.mjs signed-manifest.json source-trust.json index.json review.json
// index: {documentId:{projectionPath,originalPath}} for new projections;
// existing Work08 formats: {documentId:{projectionPath}}.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,statSync,mkdtempSync,rmSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyApprovedManifest} from './offline-converter.mjs';
import {prepareNativeReviewOffline} from '../reborn2-pilot/native-graph-issuance.mjs';
const extractor=fileURLToPath(new URL('./extract_official.py',import.meta.url));
const extractorBytes=readFileSync(extractor);
assert.equal(createHash('sha1').update('blob '+extractorBytes.length+'\0').update(extractorBytes).digest('hex'),'f8ac393101023614a146aaa286fe58df49b55188');
const [manifest,trust,index,out,...extra]=process.argv.slice(2);
if(!manifest||!trust||!index||!out||extra.length)throw Error('LOCAL_ARGUMENTS_REQUIRED');
const raw=p=>{assert.equal(typeof p,'string');const s=statSync(p);assert.ok(s.isFile()&&s.size>0&&s.size<=16*1024*1024,'FILE_LIMIT');return readFileSync(p);};
const json=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
const signedManifest=json(raw(manifest)),sourceTrust=json(raw(trust));
const approved=verifyApprovedManifest(signedManifest,sourceTrust); // before opening source files
const paths=json(raw(index)),ids=approved.documents.map(d=>d.id).sort();
assert.deepEqual(Object.keys(paths).sort(),ids,'RAW_INVENTORY');
const formats=new Set(['NAR_DEBA_HTML_PROJECTION_1','NAR_HISTORY_HTML_PROJECTION_1','JRA_CORNER_HTML_PROJECTION_1','NAR_RESULT_HTML_PROJECTION_1']);
const sha=b=>createHash('sha256').update(b).digest('hex');
const raws=new Map(),originals=new Map(),replayed=[];
const dir=mkdtempSync(join(dirname(resolve(out)),'.reborn2-work11-'));
try{
 for(const d of approved.documents){
  const rec=paths[d.id],projected=formats.has(d.format);
  assert.deepEqual(Object.keys(rec).sort(),projected?['originalPath','projectionPath']:['projectionPath']);
  const b=raw(rec.projectionPath);
  assert.equal(sha(b),d.sha256,'PROJECTION_HASH');raws.set(d.id,b);
  if(!projected)continue;
  const p=json(b),original=raw(rec.originalPath);
  assert.equal(p.metadata.sourceRef,d.sourceRef);
  assert.equal(sha(original),p.metadata.originalSha256,'ORIGINAL_HASH');originals.set(d.id,original);
  const metaFile=join(dir,'meta.json'),htmlFile=join(dir,'original.html'),outputFile=join(dir,'replayed.json');
  writeFileSync(metaFile,JSON.stringify(p.metadata),{mode:0o600});writeFileSync(htmlFile,original,{mode:0o600});
  const run=spawnSync('python3',['-I',extractor,metaFile,htmlFile,outputFile],{encoding:'utf8',timeout:30000,maxBuffer:65536});
  assert.equal(run.status,0,'OFFLINE_EXTRACTOR_FAILED');
  assert.deepEqual(json(raw(outputFile)),p,'ORIGINAL_PROJECTION_REPLAY_MISMATCH');
  rmSync(outputFile);rmSync(metaFile);rmSync(htmlFile);replayed.push({documentId:d.id,originalSha256:p.metadata.originalSha256,projectionSha256:d.sha256});
 }
 const draft=prepareNativeReviewOffline({version:'11',signedManifest,raws,sourceTrust,originals});
 assert.equal(draft.analysisExecuted,false);assert.equal(draft.approvalIssued,false);assert.equal(draft.realAdmission,false);
 writeFileSync(out,JSON.stringify({draft,replayed},null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({scope:draft.scope,replayed:replayed.length,documents:draft.documents.length,facts:draft.facts.length,closure:draft.closure,analysisExecuted:false,realAdmission:false}));
}finally{rmSync(dir,{recursive:true,force:true});}
