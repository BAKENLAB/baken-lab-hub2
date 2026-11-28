import assert from 'node:assert/strict';
import {ENGINE,assertFrozenEngine} from './adapter.mjs';
import {exerciseExistingGraph,exerciseExistingReviewPreparation,readIssuedGraph,reviewHorseItem,reviewHorseItems,issueNativeGraph,prepareNativeReviewOffline,inspectExistingOriginalField} from './native-graph-issuance.mjs';
import {startGraphPreview} from './graph-preview.mjs';
assert.equal(assertFrozenEngine(),ENGINE);
const cap=exerciseExistingGraph('08'),x=readIssuedGraph(cap),draft=exerciseExistingReviewPreparation('08');
for(const [k,v] of Object.entries(draft.approvalPayloadBase))assert.equal(x.receipt[k],v);
assert.equal(draft.analysisExecuted,false);assert.equal(draft.approvalIssued,false);assert.equal(draft.closure.roots,104);
assert.throws(()=>issueNativeGraph(draft),/MAIN_NATIVE_APPROVAL_NOT_CONFIGURED/);
assert.throws(()=>prepareNativeReviewOffline({version:'08',signedManifest:{payload:{}},sourceTrust:{authorityPublicKeyPem:'invalid',expectedManifestSha256:'0'.repeat(64)},raws:new Map()}),/REVIEW_SOURCE_PIN/);
for(const h of x.roster){
 const items=reviewHorseItems(cap,h.horseId);assert.equal(items.length,115);
 for(const i of items){const d=reviewHorseItem(cap,h.horseId,i.item);assert.ok(d.materialTrace.group);assert.ok(d.materialTrace.trace.every(t=>t.subject===null||t.subject===h.horseId));}
 const clock=reviewHorseItem(cap,h.horseId,'RANK05');
 assert.ok(clock.materialTrace.trace.some(t=>t.state==='HELD'&&t.sourcePresent&&t.value===null));
 assert.ok(clock.materialTrace.roots.some(n=>n.kind.endsWith('_SOURCE_DOCUMENT')));
 assert.ok(clock.materialTrace.roots.some(n=>n.kind.endsWith('_SOURCE_FIELD')));
 const status=reviewHorseItem(cap,h.horseId,'RANK02');
 assert.ok(status.materialTrace.trace.some(t=>t.field==='status'&&t.state==='MISSING'&&!t.sourcePresent));
}
const held=draft.roots.filter(n=>n.kind.endsWith('_SOURCE_FIELD')&&n.payload.field==='finishClockLiteral'&&n.payload.state==='HELD');
assert.equal(held.length,2);
const literals=held.map(n=>inspectExistingOriginalField(n.id).original[0].literal).sort();
assert.deepEqual(literals,['1240','1245']);
assert.throws(()=>inspectExistingOriginalField('unbound'),/SOURCE_FIELD_NOT_IN_REVIEW/);
console.log('CODEX08_OFFLINE_REVIEW_DIGEST_AND_115_TRACE PASS '+JSON.stringify({roots:draft.closure.roots,heldOriginalLiterals:literals}));
const p=await startGraphPreview(cap);
try{
 const root=await fetch(p.url);assert.equal(root.status,200);const html=await root.text();assert.equal((html.match(/<article /g)||[]).length,2);assert.equal(p.detailReads(),0);
 const horse=new URL(html.match(/href="([^"]+)"[^>]*>全115項目を見る/)[1].replaceAll('&amp;','&'),p.url);
 const h=await (await fetch(horse)).text();assert.ok(h.includes('全115項目'));assert.equal((h.match(/<li><a /g)||[]).length,115);
 const item=new URL(h.match(/href="([^"]+)"[^>]*>RANK05 /)[1].replaceAll('&amp;','&'),horse);
 const d=await (await fetch(item)).text();assert.ok(d.includes('原本参照あり')&&d.includes('保留')&&d.includes('SOURCE_FIELD'));assert.equal(p.detailReads(),1);
 assert.equal((await fetch(new URL('/horse',p.url))).status,404);
 assert.equal((await fetch(p.url,{method:'POST'})).status,403);
 console.log('CODEX08_GRAPH_HTTP_REVIEW PASS');
}finally{await new Promise(ok=>p.server.close(ok));}
