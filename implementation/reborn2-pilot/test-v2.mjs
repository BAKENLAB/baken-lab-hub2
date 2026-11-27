import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executeFixture,assertFrozenEngine,ENGINE,sha} from './adapter.mjs';
import {saveCompact,readManifest,restoreSnapshot,readField} from './compact-store.mjs';
import {startPreview,renderList} from './mobile-preview.mjs';
import {prepareSupplyPlan,mappings,WORK02} from './work02-supply-plan.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const dir=await mkdtemp(join(tmpdir(),'reborn2-codex02-'));
try{
 for(const [name,expected] of [['FK34_FULL',['B','A','UNASSESSED','A','C']],['WORK44_PARTIAL',['UNASSESSED','UNASSESSED']],['FK34_UNKNOWN',Array(5).fill('UNASSESSED')]]){
  const s=await executeFixture(name),root=join(dir,name),out=await saveCompact(root,s),m=await readManifest(root,out.manifestDigest);
  assert.deepEqual(m.summary.runners.map(h=>h.grade),expected);
  const restored=await restoreSnapshot(root,out.manifestDigest);
  assert.equal(sha(restored),sha(s));assert.equal(restored.snapshotDigest,s.snapshotDigest);
  assert.ok(out.objectBytes<out.rawBytes);assert.ok(out.summaryBytes<50000);
  await assert.rejects(()=>saveCompact(root,s),e=>e.code==='EEXIST');
  const first=m.rows[0],p=await readField(root,m,first.horseId,'analysisItems');
  assert.equal(sha(p),sha(s.runners[0].analysisItems));
  const preview=await startPreview(root,out.manifestDigest);
  try{
   const html=await (await fetch(preview.url)).text(),initialBytes=Buffer.byteLength(html);
   assert.ok(initialBytes<80000);assert.equal(preview.detailReads(),0);assert.equal((html.match(/<article data-horse=/g)||[]).length,expected.length);
   assert.ok(html.includes('LAB EYE')&&html.includes('保留理由')&&html.includes('5観点'));
   assert.ok(!html.includes('TEST:NAR|TEST:RECOVERY')&&!html.includes('<pre>'));
   for(const f of m.summary.runners.flatMap(h=>h.findings.map(f=>({h,f})))){const q=f.f.link,params=new URLSearchParams({horse:f.h.horseId,field:q.field,...(q.route?{route:q.route}:q.item?{item:q.item}:{})});const resp=await fetch(preview.url+'/detail?'+params);assert.equal(resp.status,200);assert.ok(Buffer.byteLength(await resp.text())<100000);}
   assert.ok(preview.detailReads()>0);
   assert.equal((await fetch(preview.url+'/detail?horse=alien&field=paths')).status,400);
   if(name==='WORK44_PARTIAL'){assert.ok(html.includes('37.0秒')&&html.includes('37.5秒')&&html.includes('0.5秒')&&html.includes('出走状態未確認'));}
   console.log('CODEX02_METRICS '+JSON.stringify({name,rawBytes:out.rawBytes,archiveObjectBytes:out.objectBytes,manifestBytes:out.manifestBytes,summaryBytes:out.summaryBytes,initialHtmlBytes:initialBytes,objects:out.objectCount,grades:expected,detailReads:preview.detailReads(),comments:m.summary.runners.map(h=>h.findings.map(f=>f.text))}));
   if(process.env.PILOT_ARTIFACT_DIR){await mkdir(process.env.PILOT_ARTIFACT_DIR,{recursive:true});await writeFile(join(process.env.PILOT_ARTIFACT_DIR,name+'.html'),html);}
  }finally{await new Promise(ok=>preview.server.close(ok));}
  const f=first.fields.find(f=>f.key==='analysisItems'),file=join(root,'objects',f.digest+'.json.gz'),data=await readFile(file);await writeFile(file,Buffer.concat([data,Buffer.from('x')]));await assert.rejects(()=>readField(root,m,first.horseId,'analysisItems'));await writeFile(file,data);
 }
 console.log('CODEX02_LOSSLESS_LAZY_MOBILE PASS');
 const m={schema:'REBORN2_REAL_SUPPLY_MANIFEST_1',circuit:'JRA',race:{nativeRaceId:'JRA-DEMO-METADATA',scheduledPost:'2026-11-28T06:00:00.000Z',startLower:'2026-11-28T05:59:00.000Z'},cutoff:'2026-11-28T05:45:00.000Z',sourceDigest:'a'.repeat(64),sourceDocuments:[{documentId:'D1',role:'TARGET_CARD',nativeRaceId:'JRA-DEMO-METADATA',version:1,publishedAt:'2026-11-28T05:10:00.000Z',updatedAt:'2026-11-28T05:10:00.000Z',capturedAt:'2026-11-28T05:20:00.000Z',uncertaintyMs:1000,sha256:'b'.repeat(64),sourcePermissionRef:'UNVERIFIED_TEST_REF'}],permissionEvidence:[],custodyEvidence:[]};
 for(const circuit of ['JRA','LOCAL']){const p=prepareSupplyPlan({...m,circuit});assert.equal(p.work02Commit,WORK02);assert.ok(p.fields.length&&p.engineInput===null&&p.projectionAllowed===false&&!p.realAdmission);}
 assert.throws(()=>prepareSupplyPlan({...m,realAdmission:true}));
 console.log('CODEX02_WORK02_GATE PASS');
}finally{await rm(dir,{recursive:true,force:true});}
