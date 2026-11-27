import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewPacket,sha,canonical,csvRows,heldEYE} from '../../reborn2-work44/offline-intake-v0.2.mjs';
import {preparePartial,verifyPartial,availability} from '../../reborn2-work44/partial-bridge.mjs';

const checks=[],copy=structuredClone,t=(n,f)=>{f();checks.push(n);console.log('WORK44 '+n+' PASS');};
const reject=(n,f,pattern)=>t(n,()=>assert.throws(f,pattern));
const authority=generateKeyPairSync('ed25519'),custody=generateKeyPairSync('ed25519');
const signed=(payload,key)=>({payload,signature:sign(null,Buffer.from(JSON.stringify(payload)),key.privateKey).toString('base64')});
const tm=(day,h,m=0)=>'2026-11-'+day+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00.000Z';
const raceIdentity=day=>({issuer:'LOCAL',venueId:'TEST:VENUE',venueLiteral:'架空競馬場',dateJst:'202611'+day,raceNo:1});
const target={issuer:'LOCAL',eventId:'TEST:T',scheduledPost:tm('28',6),raceIdentity:raceIdentity('28')};
const url='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop';
const row=(day,no,historical)=>{const a=Array(36).fill('');Object.assign(a,{0:'架空競馬場',1:'202611'+day,2:'1',3:String(no),5:String(no),6:'架空馬'+no,7:'牡',8:'4',10:'20220501',16:'56.5',22:'480',23:'-2'});if(historical)Object.assign(a,{31:String(no),32:no===1?'1240':'1245',33:no===1?'':'クビ',34:no===1?'37.0':'37.5',35:'3'});return a;};
const race=(day,historical)=>{const a=Array(66).fill('');Object.assign(a,{0:'架空競馬場',1:'202611'+day,2:'1',3:'1500',21:'ダート',22:'右',23:'1400',25:'良',26:'2',27:'架空同クラス'});if(historical)Object.assign(a,{33:'49.0',34:'37.0',35:'12.0',36:'12.1',37:'12.3',38:'12.6',39:'12.0',40:'12.0',41:'13.0',50:'１角',51:'４角',58:'1,2',59:'2,1'});return a;};
const encode=rs=>Buffer.from(rs.map(r=>r.map(s=>s.includes(',')?'"'+s.replaceAll('"','""')+'"':s).join(',')).join('\r\n')+'\r\n');
const docs=[],rawFiles=[],identRows=[];
for(const [eventId,day,history] of [['TEST:T','28',false],['TEST:H','27',true]]){
 for(const [kind,rs] of [['HORSELIST',[row(day,1,history),row(day,2,history)]],['RACELIST',[race(day,history)]]]){
 const raw=encode(rs),did='TEST:D'+docs.length;rawFiles.push({id:did,base64:raw.toString('base64')});docs.push({id:did,issuer:'LOCAL',kind,role:history?'HISTORICAL_RESULT':'TARGET_CARD',eventId,eventKey:'架空競馬場|202611'+day+'|1',eventAt:tm(day,6),version:1,publishedAt:tm(day,history?7:5),updatedAt:tm(day,history?7:5),capturedAt:tm('28',5,20),uncertaintyMs:1000,url,format:kind==='HORSELIST'?'NAR_HORSELIST_36':'NAR_RACELIST_66',encoding:'UTF8',sha256:sha(raw)});
 }
 for(const no of [1,2])identRows.push({eventId,no,displayName:'架空馬'+no,horseId:'TEST:HORSE_'+no,raceIdentity:raceIdentity(day)});
}
const manifest={target,cutoff:tm('28',5,45),startLower:tm('28',5,59),sealedAt:tm('28',5,30),documents:docs};
const rights={issuer:'LOCAL',validFrom:tm('26',0),validUntil:tm('29',0),revokedAt:null,purposes:['ACQUIRE','RETAIN','LOCAL_RESEARCH'],formats:['NAR_HORSELIST_36','NAR_RACELIST_66'],sourceUrls:[url]};
const inventory={asOf:manifest.cutoff,complete:true,observedAt:tm('28',5,45),sealedAt:tm('28',5,46),uncertaintyMs:1000,raceRegistry:[{eventId:'TEST:T',raceIdentity:raceIdentity('28'),eventAt:tm('28',6)},{eventId:'TEST:H',raceIdentity:raceIdentity('27'),eventAt:tm('27',6)}],versions:docs.map(({eventId,kind,version,publishedAt,updatedAt,sha256})=>({eventId,kind,version,publishedAt,updatedAt,sha256}))};
const identity={issuer:'LOCAL',rows:identRows,observedAt:tm('28',5,20),uncertaintyMs:1000};
function packageOf({m=manifest,p=rights,i=inventory,ids=identity,files=rawFiles}={}){
 const b={scope:'SYNTHETIC_OFFICIAL_FORMAT_TEST',manifest:signed(m,custody),rights:signed(p,authority),inventory:signed(i,authority),identity:signed(ids,authority),rawFiles:files};
 const trust={scope:'LOCAL_TEST_KEYS_ONLY',authorityKey:authority.publicKey,custodyKey:custody.publicKey,expectedManifestSha256:sha(JSON.stringify(m)),expectedRightsSha256:sha(JSON.stringify(p)),expectedInventorySha256:sha(JSON.stringify(i)),expectedIdentitySha256:sha(JSON.stringify(ids)),now:tm('28',5,50)};return {b,trust};
}

import {analyzePartialVerified,loadV40,acceptedRequest,analyzeVerified} from './v43-generic.mjs';
import {prepareSupply,compileReturn} from '../../reborn2-work42/codex-contract-v0.4.mjs';
import {makeEnvelope} from '../../reborn2-work42/validate-v0.4.mjs';
import {semanticItems} from '../../reborn2-chatgpt-circuit/work42-v46-semantic.mjs';
const {b,trust}=packageOf(),partial=preparePartial(b,trust),z=analyzePartialVerified(b,trust,partial);
assert.equal(z.sourceDigest,partial.digest);assert.deepEqual(z.sourcePacket,partial.packet);assert.equal(z.sourcePacket.roots.length,77);
assert.equal(z.groups,118);assert.equal(z.held,826);assert.ok(z.runners.every(h=>h.analysisItems.length===115&&h.grade==='UNASSESSED'&&h.currentStatus===null&&h.winPaths.length===0&&h.placePaths.length===0));
assert.equal(z.realAdmission,false);assert.equal(z.engineInput,null);
console.log('FINAL_WORK44_NATIVE_PARTIAL PASS');
const first=z.runners[0],second=z.runners[1];
const find=(h,item)=>h.analysisItems.find(i=>i.item===item).partialFindings;
assert.equal(find(first,'RANK02')[0].value.finish,1);assert.equal(find(second,'RANK02')[0].value.finish,2);
assert.equal(find(first,'RANK06')[0].value.ms,37000);assert.equal(find(second,'RANK06')[0].value.ms,37500);
assert.equal(find(first,'RANK35')[0].value.final600DifferenceMs,-500);
assert.equal(find(second,'RANK35')[0].value.final600DifferenceMs,500);
assert.equal(find(first,'RANK45')[0].value.state,'REPORTED_CONTEXT_MATCH');
assert.equal(find(first,'RANK54')[0].value.deltaG,0);
assert.ok(z.runners.every(h=>h.analysisItems.find(i=>i.item==='RANK100').state==='HELD'&&h.analysisItems.find(i=>i.item==='RANK05').state==='HELD'));
const roots=new Map(z.sourcePacket.roots.map(r=>[r.id,r]));
for(const h of z.runners)for(const i of h.analysisItems)for(const f of i.partialFindings){assert.ok(f.directRefs.length&&f.directRefs.every(k=>roots.has(k)));assert.ok(f.refs.every(k=>roots.has(k)&&roots.get(k).depends.every(d=>f.refs.includes(d))));}
console.log('FINAL_PARTIAL_DETAIL '+JSON.stringify(z.runners.map(h=>({horse:h.horse,grade:h.grade,status:h.currentStatus,items:h.analysisItems.filter(i=>i.partialFindings.length).map(i=>i.item),finish:find(h,'RANK02')[0].value,final600:find(h,'RANK06')[0].value,direct:find(h,'RANK35')[0].value,section:find(h,'RANK25')[0].value,axes:h.ability.axes.map(a=>({axis:a.axis,state:a.state})),held:h.analysisItems.filter(i=>i.state==='HELD').length}))));
console.log('FINAL_WORK44_NONCLOCK_ANALYSIS PASS');
const bad=copy(partial);bad.packet.events[1].rows[0].unavailable.checkpointMs.value=[10000,30000,60000];
assert.throws(()=>analyzePartialVerified(b,trust,bad),/PARTIAL_PACKET_NOT_SOURCE_BOUND/);
assert.throws(()=>analyzePartialVerified({...b,scope:'REAL'},trust,partial),/REAL_INTAKE_DISABLED/);
assert.ok(z.sourcePacket.events.every(e=>e.rows.every(r=>r.unavailable.checkpointMs.value===null&&r.unavailable.clockMs.value===null&&r.unavailable.status.value===null)));
console.log('FINAL_WORK44_ADMISSION_BOUNDARY PASS');
const V=await loadV40(),fid='FK34_FULL',raw=V.C.fixtures.find(f=>f.id===fid).docs,{request,receipt}=acceptedRequest(V,fid),env=makeEnvelope(raw),supply=(await prepareSupply(env,{id:fid})).supply;
const packet=request.envelope.packet;
let claimsN=0,holdsN=0;for(const h of supply.runners){
 const claims=h.categories.flatMap(c=>c.claims),compiled=compileReturn(supply,h.horse_id,claims.map(q=>q.claim_id)),alias=copy(compiled);
 for(const item of alias.items)item.claims.push(...item.claims.map(q=>({...q,claim_id:'ALIAS_'+q.claim_id})));
 const a=semanticItems(compiled,raw,packet,h.horse_id,{strict:true}),v=semanticItems(alias,raw,packet,h.horse_id,{strict:true});
 assert.deepEqual(a,v);claimsN+=claims.length;holdsN+=a.holds.length;
 // A distinct context must not collapse even when the same root and hold
 // reason are shared: use two internal no-positive EYE04 claim contexts.
 const one=claims.find(q=>q.eye_item_id==='EYE04');if(one){
  const c=compileReturn(supply,h.horse_id,[one.claim_id]),x=copy(c);
  for(const i of x.items)i.claims.push(...i.claims.map(q=>({...q,claim_id:'DISTINCT_'+q.claim_id,observed_facts:{...q.observed_facts,context_control:'DISTINCT_CONTEXT_TEST'}})));
  const orig=semanticItems(c,raw,packet,h.horse_id,{strict:true}),distinct=semanticItems(x,raw,packet,h.horse_id,{strict:true});
  assert.equal(distinct.holds.length,orig.holds.length+1);
 }
}
assert.ok(claimsN&&holdsN);console.log('FINAL_HOLD_ALIAS_ALL_HORSES PASS '+JSON.stringify({claims:claimsN,holds:holdsN,distinctContextsRetained:true}));
const full=await analyzeVerified(V,request,receipt,{semanticVersion:48,work42Envelope:env});
assert.deepEqual(full.candidate.runners.map(h=>h.grade),['B','A','UNASSESSED','A','C']);
console.log('FINAL_V48_BASELINE PASS');
