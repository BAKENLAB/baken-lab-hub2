import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reviewPacket,sha,canonical,csvRows,heldEYE} from './offline-intake.mjs';
import {prepareSupply,compileReturn} from '../reborn2-work42/codex-contract-v0.4.mjs';
import {makeEnvelope} from '../reborn2-work42/validate-v0.4.mjs';
const checks=[],copy=structuredClone,t=(n,f)=>{f();checks.push(n);console.log('WORK43 '+n+' PASS');};
const reject=(n,f,pattern)=>t(n,()=>assert.throws(f,pattern));
const authority=generateKeyPairSync('ed25519'),custody=generateKeyPairSync('ed25519');
const signed=(payload,key)=>({payload,signature:sign(null,Buffer.from(JSON.stringify(payload)),key.privateKey).toString('base64')});
const tm=(day,h,m=0)=>'2026-11-'+day+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00.000Z';
const target={issuer:'LOCAL',eventId:'TEST:T',scheduledPost:tm('28',6)};
const url='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop';
const row=(day,no,historical)=>{const a=Array(36).fill('');Object.assign(a,{0:'架空競馬場',1:'202611'+day,2:'1',3:String(no),5:String(no),6:'架空馬'+no,7:'牡',8:'4',10:'20220501',16:'56.5',22:'480',23:'-2'});if(historical)Object.assign(a,{31:String(no),32:no===1?'1240':'1245',33:no===1?'':'クビ',34:no===1?'37.0':'37.5',35:'3'});return a;};
const race=(day,historical)=>{const a=Array(66).fill('');Object.assign(a,{0:'架空競馬場',1:'202611'+day,2:'1',3:'1500',21:'ダート',22:'右',23:'1400',25:'良',26:'2',27:'架空同クラス'});if(historical)Object.assign(a,{33:'49.0',34:'37.0',35:'12.0',36:'12.1',37:'12.3',38:'12.6',39:'12.0',40:'12.0',41:'13.0',50:'１角',51:'４角',58:'1,2',59:'2,1'});return a;};
const encode=rs=>Buffer.from(rs.map(r=>r.map(s=>s.includes(',')?'"'+s.replaceAll('"','""')+'"':s).join(',')).join('\r\n')+'\r\n');
const docs=[],rawFiles=[],identRows=[];
for(const [eventId,day,history] of [['TEST:T','28',false],['TEST:H','27',true]]){
 for(const [kind,rs] of [['HORSELIST',[row(day,1,history),row(day,2,history)]],['RACELIST',[race(day,history)]]]){
 const raw=encode(rs),did='TEST:D'+docs.length;rawFiles.push({id:did,base64:raw.toString('base64')});docs.push({id:did,issuer:'LOCAL',kind,role:history?'HISTORICAL_RESULT':'TARGET_CARD',eventId,eventKey:'架空競馬場|202611'+day+'|1',eventAt:tm(day,6),version:1,publishedAt:tm(day,history?7:5),updatedAt:tm(day,history?7:5),capturedAt:tm('28',5,20),uncertaintyMs:1000,url,format:kind==='HORSELIST'?'NAR_HORSELIST_36':'NAR_RACELIST_66',encoding:'UTF8',sha256:sha(raw)});
 }
 for(const no of [1,2])identRows.push({eventId,no,displayName:'架空馬'+no,horseId:'TEST:HORSE_'+no});
}
const manifest={target,cutoff:tm('28',5,45),startLower:tm('28',5,59),sealedAt:tm('28',5,30),documents:docs};
const rights={issuer:'LOCAL',validFrom:tm('26',0),validUntil:tm('29',0),revokedAt:null,purposes:['ACQUIRE','RETAIN','LOCAL_RESEARCH'],formats:['NAR_HORSELIST_36','NAR_RACELIST_66'],sourceUrls:[url]};
const inventory={asOf:manifest.cutoff,complete:true,versions:docs.map(({eventId,kind,version,publishedAt,updatedAt,sha256})=>({eventId,kind,version,publishedAt,updatedAt,sha256}))};
const identity={issuer:'LOCAL',rows:identRows};
function packageOf({m=manifest,p=rights,i=inventory,ids=identity,files=rawFiles}={}){
 const b={scope:'SYNTHETIC_OFFICIAL_FORMAT_TEST',manifest:signed(m,custody),rights:signed(p,authority),inventory:signed(i,authority),identity:signed(ids,authority),rawFiles:files};
 const trust={scope:'LOCAL_TEST_KEYS_ONLY',authorityKey:authority.publicKey,custodyKey:custody.publicKey,expectedManifestSha256:sha(JSON.stringify(m)),expectedRightsSha256:sha(JSON.stringify(p)),expectedInventorySha256:sha(JSON.stringify(i)),expectedIdentitySha256:sha(JSON.stringify(ids)),now:tm('28',5,50)};return {b,trust};
}
const run=x=>{const {b,trust}=packageOf(x);return reviewPacket(b,trust);};
const out=run();
const common=JSON.parse(readFileSync(new URL('../reborn2-chatgpt-circuit/work34-pinned/stage34-raw-fixtures-v0.2.json',import.meta.url)));
t('CANONICAL_115_NAMES',()=>{assert.deepEqual(canonical.map(x=>[x.item,x.name]),common.canonical.map(x=>[x.item,x.name]));assert.equal(new Set(canonical.map(x=>x.item)).size,115);});
t('NAR_DOCUMENTED_COLUMN_FIXTURE',()=>{assert.equal(out.runners.length,2);assert.ok(out.runners.every(r=>r.items.length===115&&r.items.every(i=>i.state==='HELD')));assert.equal(out.engineInput,null);assert.equal(out.realAdmission,false);assert.ok(out.observations.some(q=>q.field==='final600_ms'&&q.value===37000));assert.ok(out.observations.some(q=>q.field==='clock_literal'&&q.value==='1240'));assert.ok(!out.observations.some(q=>q.field.includes('popularity')||q.field.includes('odds')));});
t('ROW_BYTES_AND_DEPENDENCIES',()=>{const roots=new Map(out.roots.map(r=>[r.id,r]));assert.equal(new Set(out.observations.map(o=>o.evidenceId)).size,out.observations.length);for(const o of out.observations){const r=roots.get(o.sourceRoot),d=docs.find(q=>q.eventId===r.eventId&&q.kind===r.kind),raw=Buffer.from(rawFiles.find(q=>q.id===d.id).base64,'base64'),p=o.rowPointer;assert.equal(o.rowRoot,sha(JSON.stringify([r.id,p.record,p.start,p.end,sha(raw.subarray(p.start,p.end))])));assert.ok(o.depends.every(id=>roots.has(id)));}});
t('CSV_QUOTES_AND_CP932_BYTES',()=>{assert.deepEqual(csvRows(Buffer.from('"a,b","c""d"\r\n'), 'UTF8')[0].fields,['a,b','c"d']);const x=csvRows(Buffer.from([0x82,0xa0,44,0x31,13,10]),'CP932')[0];assert.deepEqual(x.fields,['あ','1']);assert.equal(x.end,4);});
reject('INVALID_DATE',()=>{const m=copy(manifest);m.cutoff='2026-02-30T00:00:00.000Z';return run({m});},/TIME_FORMAT/);
reject('LATE_CAPTURE_UNCERTAINTY',()=>{const m=copy(manifest);m.documents[0].capturedAt=m.sealedAt;return run({m});},/SOURCE_CHRONOLOGY/);
reject('CUTOFF_AFTER_START',()=>{const m=copy(manifest);m.cutoff=m.startLower;return run({m});},/CUTOFF/);
reject('PUBLICATION_AFTER_CAPTURE',()=>{const m=copy(manifest);m.documents[0].publishedAt=tm('28',5,25);return run({m});},/SOURCE_CHRONOLOGY/);
reject('EXPIRED_OR_REVOKED_RIGHTS',()=>{const p=copy(rights);p.revokedAt=tm('28',5,40);return run({p});},/RIGHTS_NOT_ACTIVE/);
reject('NO_RETENTION_RIGHT',()=>{const p=copy(rights);p.purposes=['ACQUIRE','LOCAL_RESEARCH'];return run({p});},/RIGHTS_NOT_ACTIVE/);
reject('SOURCE_URL_OUTSIDE_SCOPE',()=>{const m=copy(manifest);m.documents[0].url='https://example.com/';return run({m});},/SOURCE_RIGHTS_SCOPE/);
reject('STALE_SIGNED_POLICY',()=>{const {b,trust}=packageOf();b.rights=signed({...rights,validUntil:tm('30',0)},authority);return reviewPacket(b,trust);},/EXTERNAL_PIN_MISMATCH/);
reject('MANIFEST_SIGNATURE_TAMPER',()=>{const {b,trust}=packageOf();b.manifest.payload=copy(b.manifest.payload);b.manifest.payload.cutoff=tm('28',5,44);return reviewPacket(b,trust);},/MANIFEST_SIGNATURE/);
reject('NEWER_VERSION_REQUIRED',()=>{const i=copy(inventory);i.versions.push({...i.versions[0],version:2,sha256:'0'.repeat(64),updatedAt:tm('28',5,40)});return run({i});},/LATEST_VERSION_REQUIRED/);
reject('INCOMPLETE_INVENTORY',()=>run({i:{...inventory,complete:false}}),/INVENTORY_INCOMPLETE/);
reject('RAW_BYTE_CHANGE',()=>{const files=copy(rawFiles);files[0].base64=Buffer.from('changed').toString('base64');return run({files});},/RAW_HASH/);
reject('NO_NATIVE_ID_JOIN',()=>{const ids=copy(identity);ids.rows.shift();return run({ids});},/HORSE_IDENTITY_NOT_BOUND/);
reject('NAME_ONLY_JOIN',()=>{const ids=copy(identity);ids.rows[0].horseId='架空馬1';return run({ids});},/IDENTITY_ROW/);
reject('DUPLICATE_IDENTITY',()=>{const ids=copy(identity);ids.rows[1].horseId=ids.rows[0].horseId;return run({ids});},/IDENTITY_DUPLICATE/);
function replaceRaw(index,raw){const m=copy(manifest),i=copy(inventory),files=copy(rawFiles),d=m.documents[index];d.sha256=sha(raw);files[index].base64=raw.toString('base64');i.versions.find(q=>q.eventId===d.eventId&&q.kind===d.kind).sha256=d.sha256;return {m,i,files};}
reject('TARGET_HORSELIST_RESULT_COLUMNS',()=>{const a=row('28',1,false);a[31]='1';return run(replaceRaw(0,encode([a,row('28',2,false)])));},/TARGET_RESULT_OR_MARKET_PRESENT/);
reject('TARGET_HORSELIST_POPULARITY',()=>{const a=row('28',1,false);a[35]='1';return run(replaceRaw(0,encode([a,row('28',2,false)])));},/TARGET_RESULT_OR_MARKET_PRESENT/);
reject('TARGET_RACELIST_RESULT_LAPS',()=>{const a=race('28',false);a[35]='12.0';return run(replaceRaw(1,encode([a])));},/TARGET_RESULT_OR_MARKET_PRESENT/);
reject('TARGET_RESULT_ROLE_ALIAS',()=>{const m=copy(manifest);m.documents[0].role='HISTORICAL_RESULT';return run({m});},/TARGET_RESULT_LEAK/);
reject('ROSTER_INCOMPLETE',()=>run(replaceRaw(0,encode([row('28',1,false)]))),/ROSTER_INCOMPLETE/);
reject('TARGET_POST_MISMATCH',()=>{const a=race('28',false);a[3]='1501';return run(replaceRaw(1,encode([a])));},/TARGET_POST_MISMATCH/);
reject('REAL_DISABLED',()=>{const {b,trust}=packageOf();return reviewPacket({...b,scope:'REAL'},trust);},/REAL_INTAKE_DISABLED/);
reject('REAL_TRUST_DISABLED',()=>{const {b,trust}=packageOf();return reviewPacket(b,{...trust,scope:'REAL'});},/REAL_TRUST_DISABLED/);
reject('JRA_UNVERIFIED_NATIVE_FORMAT_HELD',()=>{const m=copy(manifest);m.target.issuer='JRA';return run({m});},/JRA_NATIVE_FORMAT_OR_ISSUER_UNAPPROVED/);
t('INSUFFICIENT_EYE_EXPLICIT_HOLD',()=>{for(const r of out.runners)for(const [k,v] of Object.entries(heldEYE)){const q=r.items.find(i=>i.item===k);assert.equal(q.state,'HELD');assert.deepEqual(q.requiredFields,v.needs);assert.equal(q.reason,v.block);}});
const dir=mkdtempSync(join(tmpdir(),'w43-result-'));try{const result=join(dir,'result.json');writeFileSync(result,JSON.stringify({winner:'TEST:HORSE_1'}));const before=sha(readFileSync(result)),a=run();writeFileSync(result,JSON.stringify({winner:'TEST:HORSE_2'}));const after=sha(readFileSync(result)),b=run();t('RESULT_PARTITION_SAME_REVIEW_OUTPUT',()=>{assert.notEqual(before,after);assert.deepEqual(a,b);});reject('RESULT_OBJECT_NOT_ACCEPTED',()=>{const {b,trust}=packageOf();return reviewPacket({...b,result:{winner:'TEST:HORSE_1'}},trust);},/BUNDLE_FIELDS/);}finally{rmSync(dir,{recursive:true,force:true});}
// Existing Work42 path, separate TEST:JRA and TEST:NAR, no real identity translation.
const commonResults=[];
for(const issuer of ['TEST:JRA','TEST:NAR']){
 const docs=copy(common.fixtures.find(f=>f.id==='FK34_FULL').docs);for(const d of docs)d.issuer=issuer;
 const envelope=makeEnvelope(docs),p=await prepareSupply(envelope,{id:'WORK43_'+issuer.replace(':','_')});const h=p.supply.runners[0],claims=h.categories.flatMap(c=>c.claims),ret=compileReturn(p.supply,h.horse_id,claims.map(c=>c.claim_id));
 t('WORK42_CONTRACT_'+issuer,()=>{assert.equal(p.receipt.evidence,537);assert.equal(p.supply.runners.length,5);assert.ok(p.supply.runners.every(r=>r.categories.length===15));assert.ok(ret.items.every(x=>x.dependency_ids.every(id=>p.supply.nativeIds.includes(id))));assert.equal(ret.grade_effect,false);});commonResults.push({issuer,digest:p.receipt.source_digest,evidence:p.receipt.evidence,runners:p.supply.runners.length,returnItems:ret.items.length,formal:false});
}
const summary={scope:'SYNTHETIC_ONLY',priorAccepted:831,addedAccepted:0,checks,offline:{documents:docs.length,roots:out.roots.length,observations:out.observations.length,runners:out.runners.length,items:out.runners[0].items.length,held:out.held,groups:out.groups,analysisSha256:out.analysisSha256},commonResults,heldEYE,officialValues:0,realAdmission:false,formal:false,limitations:['NAR positional parser tested only on generated rows based on public manual; no actual official file, actual header or encoding certification. JRA native parser unavailable and rejected.','Ed25519 synthetic separate keys and pins verify integrity, not independent official origin/time/permission. No real RFC3161 or external authority.','All 115 mapped, all held; partial field mapping not full multi-source semantic requirements. Review packet never enters engine.','Result separation logical API only; earlier Work41 process isolation unchanged.','Work42 TEST:JRA/NAR verified supply is unchanged synthetic interface, not real intake. No real acquisition or race analysis.']};
console.log('WORK43_SUMMARY '+JSON.stringify(summary));
if(process.env.WORK43_RECEIPT)writeFileSync(process.env.WORK43_RECEIPT,JSON.stringify({summary,review:out},null,2));
