import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executeFixture,inspectRealSupply,validateSnapshot,assertFrozenEngine,sha,ENGINE} from './adapter.mjs';
import {saveFixtureSnapshot,readFixtureSnapshot} from './store.mjs';
import {renderHub} from './hub-preview.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
console.log('CODEX01_FROZEN_ENGINE PASS');
const full=await executeFixture(),partial=await executeFixture('WORK44_PARTIAL'),unknown=await executeFixture('FK34_UNKNOWN');
assert.deepEqual(full.runners.map(h=>h.grade),['B','A','UNASSESSED','A','C']);
assert.equal(full.runners.length,5);assert.equal(partial.runners.length,2);
assert.ok(partial.runners.every(h=>h.grade==='UNASSESSED'&&h.status==='UNKNOWN'&&h.analysisItems.length===115&&h.winPaths.length===0&&h.placePaths.length===0));
assert.ok(unknown.runners.every(h=>h.grade==='UNASSESSED'));
assert.ok(full.runners.every(h=>h.axes.length===5&&h.eye.length===15&&h.analysisItems.length===115));
assert.ok(partial.runners[0].comments.some(s=>s.includes('37.0秒')));assert.ok(partial.runners[1].comments.some(s=>s.includes('37.5秒')));
console.log('CODEX01_ALL_FIELD_ENGINE PASS '+JSON.stringify([full,partial,unknown].map(s=>({mode:s.mode,grades:s.runners.map(h=>h.grade),comments:s.runners.map(h=>h.comments.slice(0,2))}))));
const m={schema:'REBORN2_REAL_SUPPLY_MANIFEST_1',circuit:'JRA',race:{nativeRaceId:'JRA-DEMO-METADATA',scheduledPost:'2026-11-28T06:00:00.000Z',startLower:'2026-11-28T05:59:00.000Z'},cutoff:'2026-11-28T05:45:00.000Z',sourceDigest:'a'.repeat(64),sourceDocuments:[{documentId:'D1',role:'TARGET_CARD',nativeRaceId:'JRA-DEMO-METADATA',version:1,publishedAt:'2026-11-28T05:10:00.000Z',updatedAt:'2026-11-28T05:10:00.000Z',capturedAt:'2026-11-28T05:20:00.000Z',uncertaintyMs:1000,sha256:'b'.repeat(64),sourcePermissionRef:'UNVERIFIED_TEST_REF'}],permissionEvidence:[],custodyEvidence:[]};
for(const circuit of ['JRA','LOCAL'])assert.equal(inspectRealSupply({...m,circuit}).analysisAllowed,false);
const leaked=structuredClone(m);leaked.sourceDocuments[0].role='HISTORICAL_RESULT';assert.throws(()=>inspectRealSupply(leaked),/TARGET_RESULT_FORBIDDEN/);
const late=structuredClone(m);late.sourceDocuments[0].capturedAt=m.cutoff;assert.throws(()=>inspectRealSupply(late),/SOURCE_AFTER_CUTOFF/);
assert.throws(()=>inspectRealSupply({...m,realAdmission:true}));assert.throws(()=>inspectRealSupply({...m,odds:[]}));
console.log('CODEX01_REAL_INTAKE_CLOSED PASS');
const dir=await mkdtemp(join(tmpdir(),'reborn2-pilot-'));
try{
 const f=await saveFixtureSnapshot(dir,full);assert.deepEqual(await readFixtureSnapshot(f),full);
 await assert.rejects(()=>saveFixtureSnapshot(dir,full),e=>e.code==='EEXIST');
 const tamper=structuredClone(full);tamper.runners[0].grade='S';assert.throws(()=>validateSnapshot(tamper),/SNAPSHOT_DIGEST/);
 const legacy=structuredClone(full);legacy.runners[0].score=100;const {snapshotDigest,...body}=legacy;legacy.snapshotDigest=sha(body);assert.throws(()=>validateSnapshot(legacy),/LEGACY_FIELD/);
 console.log('CODEX01_IMMUTABLE_SNAPSHOT PASS');
 for(const [name,s] of [['full',full],['partial',partial],['unknown',unknown]]){
  const html=renderHub(s);assert.equal((html.match(/<article data-horse=/g)||[]).length,s.runners.length);for(const title of ['5観点','勝ち筋','好走筋','LAB EYE','具体的分析コメント','保留理由'])assert.ok(html.includes(title));assert.ok(!html.includes('<script'));assert.ok(html.includes('架空材料のみ'));
  if(process.env.PILOT_ARTIFACT_DIR){await mkdir(process.env.PILOT_ARTIFACT_DIR,{recursive:true});await writeFile(join(process.env.PILOT_ARTIFACT_DIR,name+'.html'),html);}
 }
 const injected=structuredClone(full);injected.runners[0].name='<script>alert(1)</script>';const {snapshotDigest,...body}=injected;injected.snapshotDigest=sha(body);assert.ok(renderHub(injected).includes('&lt;script&gt;'));assert.ok(!renderHub(injected).includes('<script'));
 console.log('CODEX01_HUB_PREVIEW PASS');
}finally{await rm(dir,{recursive:true,force:true});}
