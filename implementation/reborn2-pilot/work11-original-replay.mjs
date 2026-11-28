// Work11 original replay at the actual admission boundary. Local, no fetch.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sha} from './adapter.mjs';
const path=fileURLToPath(new URL('../reborn2-work11/extract_official.py',import.meta.url));
const extractor=readFileSync(path),pin='f8ac393101023614a146aaa286fe58df49b55188';
assert.equal(createHash('sha1').update('blob '+extractor.length+'\0').update(extractor).digest('hex'),pin,'WORK11_EXTRACTOR_PIN');
const hash=b=>createHash('sha256').update(b).digest('hex');
const formats=new Set(['NAR_DEBA_HTML_PROJECTION_1','NAR_HISTORY_HTML_PROJECTION_1','JRA_CORNER_HTML_PROJECTION_1','NAR_RESULT_HTML_PROJECTION_1']);
const bytes=b=>{assert.ok(Buffer.isBuffer(b)&&b.length>0&&b.length<=16*1024*1024,'WORK11_BYTES_LIMIT');return b;};
const json=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes(b)));
// Only call AFTER independent source manifest signature/pin verification.
// The caller supplies approved local original bytes; no caller-supplied
// replay receipt accepted. Python runs the exact Work11 pinned extractor.
export function replayOfficialOriginals(manifest,raws,originals){
 assert.ok(raws instanceof Map&&originals instanceof Map,'WORK11_ORIGINAL_MAP_REQUIRED');
 const ds=manifest.documents.filter(d=>formats.has(d.format));
 assert.deepEqual([...originals.keys()].sort(),ds.map(d=>d.id).sort(),'WORK11_ORIGINAL_INVENTORY');
 assert.deepEqual([...raws.keys()].sort(),manifest.documents.map(d=>d.id).sort(),'WORK11_PROJECTION_INVENTORY');
 const results=[];
 for(const d of ds){
  const projected=bytes(raws.get(d.id)),p=json(projected),original=bytes(originals.get(d.id));
  assert.equal(hash(projected),d.sha256,'WORK11_PROJECTION_HASH');
  assert.equal(hash(original),p.metadata.originalSha256,'WORK11_ORIGINAL_HASH');
  assert.equal(p.metadata.sourceRef,d.sourceRef,'WORK11_ORIGINAL_REF');
  const dir=mkdtempSync(join(tmpdir(),'reborn2-work11-'));
  try{
   const meta=join(dir,'meta.json'),html=join(dir,'original.html'),out=join(dir,'projection.json');
   writeFileSync(meta,JSON.stringify(p.metadata),{mode:0o600});writeFileSync(html,original,{mode:0o600});
   const run=spawnSync('python3',['-I',path,meta,html,out],{encoding:'utf8',timeout:30000,maxBuffer:65536});
   assert.equal(run.status,0,'WORK11_ORIGINAL_REPLAY_FAILED');
   assert.deepEqual(json(readFileSync(out)),p,'WORK11_PROJECTION_REPLAY_MISMATCH');
   results.push({documentId:d.id,originalSha256:p.metadata.originalSha256,projectionSha256:d.sha256,format:d.format});
  }finally{rmSync(dir,{recursive:true,force:true});}
 }
 results.sort((a,b)=>a.documentId.localeCompare(b.documentId));
 return {schema:'REBORN2_WORK11_ORIGINAL_REPLAY_1',extractorBlob:pin,documents:results,replayDigest:sha([pin,results]),scope:'LOCAL_REPLAY_NOT_SOURCE_AUTHORITY'};
}
// Verify candidate analysis chronology. No caller supplied clock at the
// admission entry; exported pure check is not approval or trusted timestamp.
export function checkAnalysisTime({mode,cutoff,startLower,scheduledPost,validUntil},now){
 const [c,s,p,u]=[cutoff,startLower,scheduledPost,validUntil].map(Date.parse);
 assert.ok([c,s,p,u,now].every(Number.isFinite)&&c<s&&s<=p,'ANALYSIS_TIME_ORDER');
 assert.ok(c<=now&&now<u,'ANALYSIS_APPROVAL_TIME');
 if(mode==='PROSPECTIVE')assert.ok(now<s,'NATIVE_POST_BOUNDARY');
 else if(mode==='RETROSPECTIVE')assert.ok(now>=p,'RETROSPECTIVE_BEFORE_SCHEDULED_POST');
 else throw Error('ANALYSIS_MODE');
 return {mode,featureCutoff:cutoff,scheduledPost,startLower,analysisAt:new Date(now).toISOString(),prospective:mode==='PROSPECTIVE',publishable:false,externalTimestampVerified:false};
}
