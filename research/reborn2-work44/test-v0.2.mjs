import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewPacket,sha,canonical,csvRows,heldEYE} from './offline-intake-v0.2.mjs';
import {preparePartial,verifyPartial,availability} from './partial-bridge.mjs';

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
const run=x=>{const {b,trust}=packageOf(x);return reviewPacket(b,trust);};
const out=run(),{b,trust}=packageOf(),partial=preparePartial(b,trust);
t('BIDIRECTIONAL_IDENTITY_AND_PARTIAL_PACKET',()=>{assert.equal(out.runners.length,2);assert.equal(partial.packet.events.length,2);assert.equal(partial.packet.items[0].items.length,115);assert.deepEqual(verifyPartial(b,trust,partial),partial);assert.equal(partial.engineInput,null);assert.equal(partial.packet.realAdmission,false);});
reject('TARGET_NATIVE_RACE_ALIAS',()=>{const m=copy(manifest),i=copy(inventory),ids=copy(identity);i.raceRegistry[1].raceIdentity=copy(target.raceIdentity);i.raceRegistry[1].eventAt=target.scheduledPost;return run({m,i,ids});},/RACE_ID_ALIAS/);
reject('SAME_ID_WRONG_RACE_KEY',()=>{const m=copy(manifest);m.documents[2].eventKey=m.documents[0].eventKey;return run({m});},/NATIVE_EVENT_KEY_BINDING/);
reject('VENUE_ALIAS',()=>{const i=copy(inventory);i.raceRegistry[1].raceIdentity.venueId='TEST:OTHER';return run({i});},/VENUE_ALIAS/);
reject('HISTORICAL_DATE_FALSE',()=>{const i=copy(inventory);i.raceRegistry[1].eventAt=tm('26',6);return run({i});},/RACE_DATE_TIME_BINDING/);
reject('HORSE_IDENTITY_WRONG_RACE',()=>{const ids=copy(identity);ids.rows[2].raceIdentity=copy(target.raceIdentity);return run({ids});},/HORSE_RACE_ID_BINDING/);
reject('INVENTORY_TIME_AFTER_START',()=>{const i=copy(inventory);i.sealedAt=tm('28',5,59);return run({i});},/INVENTORY_TIME_BOUND/);
reject('INVENTORY_TIME_BEFORE_ASOF',()=>{const i=copy(inventory);i.observedAt=tm('28',5,44);return run({i});},/INVENTORY_TIME_BOUND/);
reject('IDENTITY_TIME_AFTER_SEAL',()=>{const ids=copy(identity);ids.observedAt=tm('28',5,31);return run({ids});},/IDENTITY_TIME_BOUND/);
reject('RIGHTS_NOT_VALID_AT_CAPTURE',()=>{const p=copy(rights);p.validFrom=tm('28',5,25);return run({p});},/SOURCE_CHRONOLOGY/);
reject('RIGHTS_REVOKED_AT_USE',()=>{const p=copy(rights);p.revokedAt=tm('28',5,40);return run({p});},/RIGHTS_NOT_ACTIVE/);
reject('UNBOUND_EXTRA_INVENTORY',()=>{const i=copy(inventory);i.versions.push({...i.versions[0],eventId:'TEST:ALIEN'});return run({i});},/VERSION_INVENTORY_SCHEMA/);
function replaceRaw(index,raw){const m=copy(manifest),i=copy(inventory),files=copy(rawFiles),d=m.documents[index];d.sha256=sha(raw);files[index].base64=raw.toString('base64');i.versions.find(q=>q.eventId===d.eventId&&q.kind===d.kind).sha256=d.sha256;return {m,i,files};}
reject('HISTORICAL_WRONG_POST',()=>{const a=race('27',true);a[3]='1501';return run(replaceRaw(3,encode([a])));},/HISTORICAL_POST_MISMATCH/);
reject('HISTORICAL_ROSTER_SHORT',()=>run(replaceRaw(2,encode([row('27',1,true)]))),/EVENT_ROSTER_INCOMPLETE/);
reject('TARGET_RESULT_COLUMNS_STILL_REJECT',()=>{const a=row('28',1,false);a[31]='1';return run(replaceRaw(0,encode([a,row('28',2,false)])));},/TARGET_RESULT_OR_MARKET_PRESENT/);
t('BLANK_LAP_AND_CORNER_SLOTS',()=>{const a=race('27',true);a[36]='';a[51]='';const p=packageOf(replaceRaw(3,encode([a]))),z=preparePartial(p.b,p.trust).packet.events.find(e=>e.role==='HISTORICAL_RESULT');assert.equal(z.observations.leaderLapSlots.value.length,15);assert.equal(z.observations.leaderLapSlots.value[1].literal,null);assert.equal(z.observations.leaderLapSlots.value[2].literal,'12.3');assert.equal(z.observations.cornerGroupSlots.value.length,8);assert.equal(z.observations.cornerGroupSlots.value[1].corner,null);});
t('FULL_PROVENANCE_GRAPH',()=>{const roots=new Map(out.roots.map(q=>[q.id,q]));for(const o of out.observations){assert.equal(roots.get(o.evidenceId).kind,'FIELD');assert.equal(roots.get(o.rowRoot).kind,'RAW_ROW');assert.equal(roots.get(o.sourceRoot).kind,'RAW_SOURCE');for(const kind of ['MANIFEST','RIGHTS','INVENTORY','IDENTITY','PARSER'])assert.ok(o.depends.some(id=>roots.get(id)?.kind===kind));}});
t('NO_INDIVIDUAL_CLOCK_FABRICATION',()=>{for(const e of partial.packet.events)for(const r of e.rows){assert.equal(r.unavailable.checkpointMs.value,null);assert.equal(r.unavailable.checkpointRanks.value,null);assert.equal(r.unavailable.clockMs.value,null);assert.ok(!('checkpointMs' in r.observations));}const h=partial.packet.events.find(e=>e.role==='HISTORICAL_RESULT').rows[0];assert.equal(h.observations.final600Ms.value,37000);assert.equal(h.observations.finishClockLiteral.value,'1240');});
reject('TAMPERED_PARTIAL_REPLAY',()=>{const p=copy(partial);p.packet.events[1].rows[0].unavailable.checkpointMs.value=[10000,30000,60000];return verifyPartial(b,trust,p);},/PARTIAL_PACKET_NOT_SOURCE_BOUND/);
reject('REAL_INTAKE_STILL_DISABLED',()=>reviewPacket({...b,scope:'REAL'},trust),/REAL_INTAKE_DISABLED/);
const summary={priorAccepted:864,addedAccepted:0,checks,events:partial.packet.events.map(e=>({eventId:e.eventId,role:e.role,rows:e.rows.length,eventFields:Object.keys(e.observations),rowFields:Object.keys(e.rows[0].observations)})),roots:out.roots.length,observations:out.observations.length,items:115,groups:118,held:826,availability,digest:partial.digest,realAdmission:false,engineInput:null,formal:false};
console.log('WORK44_SUMMARY '+JSON.stringify(summary));if(process.env.WORK44_RECEIPT)writeFileSync(process.env.WORK44_RECEIPT,JSON.stringify({summary,partial},null,2));
