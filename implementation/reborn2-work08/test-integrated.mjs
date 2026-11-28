import assert from 'node:assert/strict';
import {partialFixture} from '../reborn2-pilot/fixture-partial.mjs';
import {reviewPacket} from '../../research/reborn2-work44/offline-intake-v0.2.mjs';
import {preparePartial} from '../../research/reborn2-work44/partial-bridge.mjs';
import {exerciseFixtureObservationCompiler,exerciseWork07EndToEnd,exerciseWork08EndToEnd,executeWork08NativePartial} from '../reborn2-pilot/native-partial-runtime.mjs';
import {inspectNativeStructureOffline} from '../reborn2-pilot/native-entry.mjs';
import {cardPost} from './offline-converter.mjs';
import {submitAnalysis} from '../reborn2-pilot/work04-intake.mjs';
const {b,trust}=partialFixture(),original=preparePartial(b,trust).packet,old=exerciseFixtureObservationCompiler(original),w7=exerciseWork07EndToEnd(b,trust),w8=exerciseWork08EndToEnd(b,trust);
assert.equal(old.observationCount,41);assert.equal(w7.package.observations.length,48);assert.equal(w8.package.observations.length,48);
const k=(e,h,f)=>JSON.stringify([e,h,f]);
const a=new Map();
for(const e of old.compiled.events){
 for(const [f,o] of Object.entries(e.observations))if(o.state==='OBSERVED_TEST_FORMAT')a.set(k(e.eventId,null,f),o.value);
 for(const h of e.rows)for(const [f,o] of Object.entries(h.observations))if(f!=='no'&&o.state==='OBSERVED_TEST_FORMAT')a.set(k(e.eventId,h.nativeId,f),o.value);
}
const z=new Map(w8.package.observations.map(o=>[k(o.eventId,o.horseId,o.field),o]));
assert.equal(a.size,41);assert.equal(z.size,48);
const summary={same:[],normalized:[],different:[],oldOnly:[],newOnly:[]};
for(const [id,v] of a){
 const o=z.get(id),f=JSON.parse(id)[2];
 if(!o){summary.oldOnly.push(id);continue;}
 if(o.state!=='OBSERVED'){summary.different.push({id,old:v,newState:o.state,reason:o.reason});continue;}
 if(JSON.stringify(v)===JSON.stringify(o.value)){summary.same.push(id);continue;}
 const normalized=f==='leaderLapSlots'&&Array.isArray(v)?v.map(x=>x.literal):f==='cornerGroupSlots'&&Array.isArray(v)?v.map(x=>x.order):v;
 if(JSON.stringify(normalized)===JSON.stringify(o.value))summary.normalized.push(id);
 else summary.different.push({id,old:v,new:o.value});
}
for(const [id,o] of z)if(!a.has(id))summary.newOnly.push({id,state:o.state});
assert.equal(summary.different.filter(x=>x.newState==='HELD').length,2);
assert.ok(summary.different.every(x=>['HELD','MISSING'].includes(x.newState)));
assert.equal(summary.oldOnly.length,0);
const view=r=>r.analysisItems.flatMap(i=>i.partialFindings.map(f=>({item:f.item,type:f.type,event:f.event,value:f.value})));
for(const h of w8.runners){const p=w7.runners.find(x=>x.horse===h.horse),q=old.runners.find(x=>x.horse===h.horse);assert.deepEqual(view(h),view(p));assert.deepEqual(view(h),view(q));assert.equal(h.grade,'UNASSESSED');assert.equal(h.analysisItems.length,115);assert.equal(h.eye.length,15);assert.equal(h.winPaths.length,0);}
const roots=new Map(w8.sourcePacket.roots.map(x=>[x.id,x]));
for(const root of roots.values())assert.ok(root.kind.startsWith('FIXTURE_')&&root.depends.every(id=>roots.has(id)));
for(const h of w8.runners)for(const f of view(h))assert.ok(f.item);
for(const h of w8.runners)for(const i of h.analysisItems)for(const f of i.partialFindings)assert.ok(f.refs.length&&f.refs.every(id=>roots.has(id)));
// Independently trace the extracted facts back to Work44's original
// verified byte ranges, not only the new graph's self-consistent IDs.
const reviewed=reviewPacket(b,trust), originalRoots=new Map(reviewed.roots.map(r=>[r.id,r]));
const fieldMap={surfaceLiteral:'surface',directionLiteral:'direction',distanceM:'distance_m',goingLiteral:'going',declaredCount:'declared_count',classLiteral:'class_literal',gate:'gate',displayName:'display_name',weightG:'weight_g',bodyWeightKg:'body_weight_kg',bodyWeightDeltaKg:'body_weight_delta_kg',sexAge:'sex',finish:'finish',finishClockLiteral:'clock_literal',officialMarginLiteral:'margin_literal',final600Ms:'final600_ms',leaderLapSlots:'leader_laps_literal',cornerGroupSlots:'corner_groups_literal'};
let originalPointerMatches=0;
for(const o of w8.package.observations){
 if(o.field==='status'){assert.equal(o.state,'MISSING');assert.equal(o.roots.length,0);continue;}
 const fields=o.field==='sexAge'?['sex','age']:[fieldMap[o.field]];
 assert.ok(fields.every(Boolean));
 const prior=reviewed.observations.filter(q=>q.eventId===o.eventId&&q.horseId===o.horseId&&fields.includes(q.field));
 assert.equal(prior.length,fields.length);
 assert.equal(o.roots.length,1);
 const root=o.roots[0],doc=w8.package.documents.find(d=>d.id===root.documentId),pointer=JSON.parse(root.rowPointer);
 const expectedCols=[...new Set(prior.flatMap(q=>q.rowPointer.columns))].sort((a,b)=>a-b);
 if(o.field==='cornerGroupSlots')assert.deepEqual(pointer.columns,[59,60,61,62,63,64,65,66]);
 else assert.deepEqual(pointer.columns,expectedCols);
 for(const q of prior){
  const rawSource=originalRoots.get(q.sourceRoot);
  assert.equal(doc.sha256,rawSource.payload.sha256);
  assert.equal(doc.eventId,q.eventId);
  for(const field of ['record','start','end'])assert.equal(pointer[field],q.rowPointer[field]);
  assert.ok(pointer.columns.every(c=>expectedCols.includes(c)));
 }
 originalPointerMatches++;
}
assert.equal(originalPointerMatches,46);
const corner=w8.package.observations.find(o=>o.field==='cornerGroupSlots');assert.deepEqual(JSON.parse(corner.roots[0].rowPointer).columns,[59,60,61,62,63,64,65,66]);
assert.throws(()=>inspectNativeStructureOffline(w8.package),/RESEARCH_ID_FORBIDDEN/);
assert.throws(()=>executeWork08NativePartial(null,null,null),/MAIN_NATIVE_APPROVAL_NOT_CONFIGURED/);
// Reuse existing fixture scheduled post, not a new race or actual source.
const target=b.manifest.payload.target, date=target.raceIdentity.dateJst.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
assert.equal(cardPost('15時00分',date),target.scheduledPost);
assert.equal(cardPost('15:00',date),target.scheduledPost);
assert.throws(()=>cardPost('25時00分',date),/JRA_POST_LITERAL/);
assert.throws(()=>cardPost(null,date),/JRA_POST_LITERAL/);
await assert.rejects(()=>submitAnalysis({schema:'REBORN2_WORK08_ANALYSIS_REQUEST_1',mode:'PARTIAL',signedManifest:null,raws:null,approval:null}),/MAIN_NATIVE_APPROVAL_NOT_CONFIGURED/);
console.log('WORK08_COMPARISON '+JSON.stringify(summary));
console.log('WORK08_END_TO_END PASS '+JSON.stringify({old:41,new:48,counts:w8.inspection.counts,originalPointerMatches,roots:roots.size,findings:w8.runners.map(h=>view(h).length),realAdmission:false}));
