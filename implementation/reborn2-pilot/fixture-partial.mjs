import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewPacket,sha,canonical,csvRows,heldEYE} from '../../research/reborn2-work44/offline-intake-v0.2.mjs';
import {preparePartial,verifyPartial,availability} from '../../research/reborn2-work44/partial-bridge.mjs';

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

export function partialFixture(){return packageOf();}
