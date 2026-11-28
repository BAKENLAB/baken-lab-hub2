// Work07: offline extraction only. No network, database, claim or engine calls.
// Source descriptor is authorized independently by the operator, never by the source itself.
// Native admission / field proof signatures remain Codex05's separate responsibility.
import assert from 'node:assert/strict';
import {createHash,verify,createPublicKey} from 'node:crypto';
import {csvRows,reviewPacket} from '../../research/reborn2-work44/offline-intake-v0.2.mjs';
import {inspectNativeFacts,supplyContract} from '../reborn2-pilot/work06/inspect-native-facts.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(x,k)=>{assert.ok(x&&typeof x==='object'&&!Array.isArray(x));assert.deepEqual(Object.keys(x).sort(),[...k].sort(),'UNKNOWN_DESCRIPTOR_FIELDS');};
const need=(v,m)=>assert.ok(v,m);
const jst=d=>new Date(Date.parse(d)+9*3600000).toISOString().slice(0,10);
const validTime=d=>typeof d==='string'&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString()===d;
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const safe=(v)=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[<>{}\x00-\x1f]/.test(v)&&!/(?:オッズ|人気|TOP5|targetResult|odds)/i.test(v);
const num=(v,l,h)=>{if(v===null||v===undefined||v==='')return null;if(typeof v!=='number'&&!(typeof v==='string'&&/^-?\d+$/.test(v)))return null;const n=Number(v);return Number.isSafeInteger(n)&&n>=l&&n<=h?n:null;};
const scaled=(v,l,h)=>{if(v===null||v===undefined||v==='')return null;const s=String(v);if(!/^\d{1,3}(?:\.\d{1,3})?$/.test(s))return null;const [a,b='']=s.split('.');const n=Number(a)*1000+Number(b.padEnd(3,'0'));return n>=l&&n<=h?n:null;};
const lit=v=>safe(v)?v:null;
const choice=(v,a)=>a.includes(v)?v:null;
const clock=v=>typeof v==='string'&&/^(?:[0-9]{1,2}[:.])?[0-9]{1,2}\.[0-9]{1,3}$/.test(v)?v:null;
const margin=v=>typeof v==='string'&&/^(?:ハナ|アタマ|クビ|大差|同着|[0-9]+(?:\s*[0-9]+\/[0-9]+)?|[0-9]+\/[0-9]+)$/.test(v)?v:null;
const corner=v=>{const s=Array.isArray(v)&&v.length&&v.every(x=>num(x,1,24)!==null)?v.join(','):v;return typeof s==='string'&&s.length<=128&&/^[0-9０-９,，\-ー()（）*＋+\s]+$/.test(s)?s:null;};
const lap=v=>typeof v==='string'&&/^\d{1,3}(?:\.\d{1,3})?$/.test(v)?v:null;
const splitLaps=v=>{const a=Array.isArray(v)?v:typeof v==='string'?v.trim().split(/\s*[-－]\s*/):[];return a.length&&a.length<=32&&a.every(x=>x===null||x===''||lap(String(x))!==null)&&a.some(x=>x!==null&&x!=='')?a.map(x=>x===null||x===''?null:String(x)):null;};
const surface=v=>choice(v,['芝','ダート','ダ','障害','TURF','DIRT']);
const direction=v=>choice(v,['右','左','直線','RIGHT','LEFT','STRAIGHT']);
const going=v=>choice(v,['良','稍重','重','不良','GOOD','YIELDING','SOFT','HEAVY']);
const JRA=['札幌','函館','福島','新潟','東京','中山','中京','京都','阪神','小倉'];
const NAR={'盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20','川崎':'21','金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28','高知':'31','佐賀':'32','門別':'36'};
const jraHorse=v=>typeof v==='string'?v.match(/^\/JRADB\/accessU\.html\?CNAME=pw01dud(?:00|10)([0-9]{10})\/[0-9A-Fa-f]{2}$/)?.[1]??null:null;
function jraRace(v,role){
 const q=typeof v==='string'?v.replace(/^\/JRADB\/access[DS]\.html\?CNAME=/,''):'';
 const m=q.match(/^pw01(dde01|sde01|sde10)(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(\d{8})\/[0-9A-Fa-f]{2}$/);
 need(m&&((role==='TARGET_CARD')===(m[1]==='dde01')),'JRA_NATIVE_RACE_REF');
 const date=m[7].replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
 need(m[3]===date.slice(0,4)&&JRA[Number(m[2])-1]&&Number(m[6])>=1&&Number(m[6])<=12,'JRA_RACE_TUPLE');
 return {venueId:m[2],track:JRA[Number(m[2])-1],dateJst:date,raceNo:Number(m[6])};
}
const ptr=(row,field)=>JSON.stringify({row,field});
const allowed=(x,ks)=>{need(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>ks.includes(k)),'UNAPPROVED_SOURCE_FIELD');};
export function cardPost(v,date){
 if(validTime(v))return v;
 // Match the actual stored Japanese hour/minute format or explicit HH:MM.
 const m=typeof v==='string'?v.match(/^(\d{1,2})(?:時(\d{1,2})分|:([0-5]\d))$/):null;
 need(m&&Number(m[1])<24&&Number(m[2]??m[3])<60,'JRA_POST_LITERAL');
 const h=m[1].padStart(2,'0'),minute=(m[2]??m[3]).padStart(2,'0');
 const stamp=date+'T'+h+':'+minute+':00+09:00';
 need(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(stamp)),'JRA_POST_DATE');
 const iso=new Date(stamp).toISOString();
 need(jst(iso)===date,'JRA_POST_DATE');
 return iso;
}
const raceKeys=['race_date','track','race_no','surface','turn','distance','going','class_name','field_size'];
const runnerKeys=['horse_no','horse_ref','horse_name','draw','weight_carried','body_weight','body_weight_diff','sex_age','equipment'];

const scopeKeys=['schema','scope','circuit','targetId','cutoff','scheduledPost','startLower','events','roster','documents','rowWitnesses'];
const eventKeys=supplyContract.package.event;
const docKeys=supplyContract.package.document.concat(['format','encoding','venueLiteral']);
const rowKeys=['eventId','horseNo','horseId','displayName','proofRef'];
function convert(m,raws,{fixture=false}={}){
 exact(m,scopeKeys);need(m.schema==='WORK07_OFFLINE_SOURCE_MANIFEST_1','MANIFEST_SCHEMA');
 need(m.scope===(fixture?'EXISTING_WORK44_FIXTURE':'APPROVED_LOCAL_SOURCE'),'SOURCE_SCOPE');
 const {circuit,targetId,cutoff,scheduledPost,startLower}=m;
 need(['JRA','LOCAL'].includes(circuit)&&[cutoff,scheduledPost,startLower].every(validTime)&&Date.parse(cutoff)<Date.parse(startLower)&&Date.parse(startLower)<=Date.parse(scheduledPost),'TIME_BOUNDARY');
 const es=new Map(),ds=new Map(),rowMap=new Map(),facts=new Map(),seenRows=new Map(),cardRows=new Set();
 need([m.events,m.roster,m.documents,m.rowWitnesses].every(Array.isArray),'MANIFEST_ARRAY');
 for(const e of m.events){exact(e,eventKeys);need(!es.has(e.id)&&e.issuer===(circuit==='JRA'?'JRA':'NAR'),'EVENT_ID');if(!fixture)need(!String(e.nativeId).startsWith('TEST:'),'FIXTURE_ID');es.set(e.id,e);}
 const target=es.get(targetId);need(target?.role==='TARGET_CARD'&&jst(scheduledPost)===target.dateJst,'TARGET_DATE');
 for(const w of m.rowWitnesses){exact(w,rowKeys);const k=JSON.stringify([w.eventId,w.horseNo]);need(es.has(w.eventId)&&!rowMap.has(k)&&num(w.horseNo,1,24)!==null&&typeof w.horseId==='string'&&w.horseId&&typeof w.proofRef==='string'&&w.proofRef,'ROW_WITNESS');if(!fixture)need(!w.horseId.startsWith('TEST:'),'FIXTURE_HORSE');rowMap.set(k,w);}
 const bind=(d,no,name,key=null)=>{const w=rowMap.get(JSON.stringify([d.eventId,no]));need(w&&w.displayName===name&&(key===null||w.horseId===key),'HORSE_ROW_WITNESS');const k=JSON.stringify([d.id,no]);need(!seenRows.has(k),'DUPLICATE_RAW_ROW');seenRows.set(k,w);if(d.role==='TARGET_CARD'&&d.format!=='OFFICIAL_CARD_STATUS_PROJECTION_1')cardRows.add(w.horseId);return w;};
 for(const d of m.documents){exact(d,docKeys);need(!ds.has(d.id)&&es.get(d.eventId)?.role===d.role&&hex(d.sha256),'DOCUMENT_BINDING');ds.set(d.id,d);}
 need(raws instanceof Map&&raws.size===ds.size,'RAW_INVENTORY');
 const emit=(d,w,field,v,rawPointer,rawPresent=true)=>{
  const horseId=w?.horseId??null,pastHorseNo=w&&d.role==='HISTORICAL_RESULT'?w.horseNo:null;
  need(!supplyContract.package.historicalOnly.includes(field)||d.role==='HISTORICAL_RESULT','TARGET_RESULT');
  const k=JSON.stringify([d.eventId,horseId,field]);const arr=facts.get(k)??[];
  arr.push({eventId:d.eventId,horseId,pastHorseNo,field,value:v,state:v!==null?'OBSERVED':rawPresent?'HELD':'MISSING',reason:v!==null?null:rawPresent?'UNSUPPORTED_OR_UNCERTIFIED_LITERAL':'SOURCE_FIELD_MISSING',root:{documentId:d.id,rowPointer:rawPointer,field,proofRef:w?.proofRef??es.get(d.eventId).identityProofRefs[0]}});
  facts.set(k,arr);
 };
 const put=(d,w,field,raw,fn,pointer)=>emit(d,w,field,fn(raw),pointer,raw!==null&&raw!==undefined&&raw!==''&&(!Array.isArray(raw)||raw.length>0));
 for(const d of m.documents){
  const e=es.get(d.eventId),raw=raws.get(d.id);need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=16*1024*1024&&sha(raw)===d.sha256,'RAW_HASH');
  if(d.format==='NAR_HORSELIST_36'||d.format==='NAR_RACELIST_66'){
   need(circuit==='LOCAL'&&(fixture||NAR[d.venueLiteral]===e.venueId),'NAR_VENUE');
   const url=new URL(d.sourceRef);need(url.protocol==='https:'&&url.hostname==='www.keiba.go.jp'&&!url.port&&!url.username&&!url.password&&!url.hash,'NAR_SOURCE_HOST');
   const horse=d.format==='NAR_HORSELIST_36',records=csvRows(raw,d.encoding);
   if(!horse)need(records.length===1,'RACE_ROW_COUNT');
   for(const rec of records){
    const a=rec.fields;need(a.length===(horse?36:66)&&a[0]===d.venueLiteral&&a[1]===e.dateJst.replaceAll('-','')&&num(a[2],1,24)===e.raceNo,'CSV_EVENT_BINDING');
    const p=i=>JSON.stringify({record:rec.record,start:rec.start,end:rec.end,columns:Array.isArray(i)?i:[i]});
    if(horse){
     if(d.role==='TARGET_CARD')need(a.slice(31,36).every(x=>x===''),'TARGET_RESULT_OR_MARKET');
     const no=num(a[5],1,24),w=bind(d,no,a[6]);need(no!==null,'HORSE_NO');
     for(const [i,f,fn] of [[3,'gate',x=>num(x,1,8)],[6,'displayName',lit],[16,'weightG',x=>scaled(x,30000,90000)],[22,'bodyWeightKg',x=>num(x,200,900)],[23,'bodyWeightDeltaKg',x=>num(x,-100,100)]])put(d,w,f,a[i],fn,p(i+1));
     put(d,w,'sexAge',a[7]&&a[8]?a[7]+a[8]:'',x=>/^[牡牝セ騸]\d{1,2}$/.test(x)?x:null,p([8,9]));
     if(d.role==='HISTORICAL_RESULT')for(const [i,f,fn] of [[31,'finish',x=>num(x,1,24)],[32,'finishClockLiteral',clock],[33,'officialMarginLiteral',margin],[34,'final600Ms',x=>scaled(x,10000,300000)]])put(d,w,f,a[i],fn,p(i+1));
    }else{
     if(d.role==='TARGET_CARD'){need(a.slice(33).every(x=>x===''),'TARGET_RESULT_OR_MARKET');const t=new Date(Date.parse(scheduledPost)+9*3600000).toISOString().slice(11,16).replace(':','');need(a[3]===t,'TARGET_POST_MISMATCH');}
     for(const [i,f,fn] of [[21,'surfaceLiteral',surface],[22,'directionLiteral',direction],[23,'distanceM',x=>num(x,600,5000)],[25,'goingLiteral',going],[26,'declaredCount',x=>num(x,1,24)],[27,'classLiteral',lit]])put(d,null,f,a[i],fn,p(i+1));
     if(d.role==='HISTORICAL_RESULT'){
      put(d,null,'leaderLapSlots',a.slice(35,50),splitLaps,p(Array.from({length:15},(_,i)=>36+i)));
      const groups=a.slice(58,66);put(d,null,'cornerGroupSlots',groups,x=>x.some(Boolean)&&x.every(v=>v===''||corner(v)!==null)?x.map(v=>v===''?null:corner(v)):null,p(Array.from({length:8},(_,i)=>59+i)));
     }
    }
   }
  }else if(d.format==='NAR_STORED_CORNER_SNAPSHOT_1'){
   // A stored derived snapshot is NOT the official result HTML. Bind its
   // actual bytes and existing canonical payload digest, retain exact source
   // record references; the separate official row witness remains required.
   need(circuit==='LOCAL'&&d.role==='HISTORICAL_RESULT'&&d.encoding==='UTF8'&&NAR[d.venueLiteral]===e.venueId,'LOCAL_SNAPSHOT_FORMAT');
   const z=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
   need(typeof z.id==='string'&&d.sourceRef==='urn:bakenlab:local-preclaim:'+z.id&&z.circuit==='LOCAL'&&z.source_kind==='LOCAL_OFFICIAL_CORNERS'&&z.source_version==='LOCAL_CORNER_1','LOCAL_SNAPSHOT_IDENTITY');
   need(hex(z.payload_digest)&&sha(canonical(z.evidence))===z.payload_digest&&hex(z.official_roster_digest),'LOCAL_PAYLOAD_DIGEST');
   const times=[z.as_of,z.captured_at,z.official_post_time].map(Date.parse);
   need(times.every(Number.isFinite)&&times[0]<=times[1]&&times[1]<times[2]&&times[1]<=Date.parse(d.capturedAt)&&times[1]<=Date.parse(cutoff)&&z.race_date<=target.dateJst&&e.dateJst<z.race_date,'LOCAL_SNAPSHOT_TIME');
   const p=z.evidence?.packet;
   need(z.evidence?.schemaVersion==='LOCAL_OFFICIAL_CORNERS_1'&&p?.status==='PREFETCH_ONLY'&&p.raceDate===z.race_date&&p.raceTrack===z.track&&p.raceNo===z.race_no&&['claimStarted','saveAuthorized','marketUsed','targetResultUsed','rankChanged'].every(k=>p[k]===false)&&Array.isArray(p.evidence)&&p.evidence.length===p.linkedRunEvidence,'LOCAL_SNAPSHOT_PACKET');
   const historicalURL=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable');
   historicalURL.searchParams.set('k_babaCode',e.venueId);historicalURL.searchParams.set('k_raceDate',e.dateJst.replaceAll('-','/'));historicalURL.searchParams.set('k_raceNo',String(e.raceNo));
   let n=0;
   for(const [i,x] of p.evidence.entries()){
    const h=x.pastRace;if(h?.raceDate!==e.dateJst||h.track!==d.venueLiteral||h.raceNo!==e.raceNo)continue;
    need(x.source==='NAR_OFFICIAL_PAST_RACE_RESULT'&&x.sourceRef===historicalURL.href&&x.rankingEffect==='NONE_UNTIL_REVIEWED'&&x.identityVerifiedBy==='OFFICIAL_HORSE_REF'&&Number.isFinite(Date.parse(x.sourceCheckedAt))&&Date.parse(x.sourceCheckedAt)<=times[0],'LOCAL_SOURCE_BINDING');
    const u=new URL(x.horseRef);const hk=u.searchParams.get('k_lineageLoginCode');
    need(u.protocol==='https:'&&u.hostname==='www.keiba.go.jp'&&!u.port&&!u.username&&!u.password&&!u.hash&&u.pathname==='/KeibaWeb/DataRoom/HorseMarkInfo'&&/^[0-9]{1,30}$/.test(hk??'')&&u.searchParams.getAll('k_lineageLoginCode').length===1&&[...u.searchParams.keys()].every(k=>['k_lineageLoginCode','k_activeCode'].includes(k)),'LOCAL_HORSE_REF');
    const no=num(x.pastHorseNo,1,24);need(no!==null,'PAST_HORSE_NO');
    const w=bind(d,no,x.horseName,hk);const cs=x.corners;
    need(Array.isArray(cs)&&cs.length>0&&cs.length<=4&&cs.every((c,j)=>num(c.corner,1,4)!==null&&num(c.position,1,24)!==null&&(j===0||cs[j-1].corner<c.corner))&&cs[0].position===x.earlyPos&&cs.at(-1).position===x.finalTurnPos,'LOCAL_CORNERS');
    // Position-only literal, not distance ranks or a crossing clock. Corner
    // labels remain in original row addressed by root; if there is a gap,
    // avoid ambiguous compressed sequence and retain a held observation.
    const consecutive=cs.every((c,j)=>j===0||cs[j-1].corner+1===c.corner);
    emit(d,w,'cornerPositionsLiteral',consecutive?cs.map(c=>c.position).join(','):null,JSON.stringify({row:'evidence.packet.evidence/'+i,field:'corners',cornerLabels:cs.map(c=>c.corner),sourceRef:x.sourceRef,sourceCheckedAt:x.sourceCheckedAt}),true);n++;
   }
   need(n>0,'LOCAL_SNAPSHOT_NO_MATCHED_ROWS');
  }else if(d.format==='OFFICIAL_CARD_STATUS_PROJECTION_1'){
   // Independently approved immutable projection of official card/cancellation
   // source. This does not make the projection itself the official original.
   need(d.role==='TARGET_CARD'&&d.encoding==='UTF8','STATUS_CARD_ROLE');
   const z=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
   exact(z,['nativeRaceId','dateJst','venueId','raceNo','scheduledPost','checkedAt','sourceRef','rows']);
   need(z.nativeRaceId===e.nativeId&&z.dateJst===e.dateJst&&z.venueId===e.venueId&&z.raceNo===e.raceNo&&z.scheduledPost===scheduledPost&&validTime(z.checkedAt)&&Date.parse(d.updatedAt)<=Date.parse(z.checkedAt)&&Date.parse(z.checkedAt)<=Date.parse(d.capturedAt)&&Date.parse(z.checkedAt)<=Date.parse(cutoff)&&z.sourceRef===d.sourceRef,'STATUS_CARD_BINDING');
   const url=new URL(z.sourceRef);
   need(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash,'STATUS_URL');
   if(circuit==='JRA'){
    need(url.hostname==='www.jra.go.jp'&&url.pathname==='/JRADB/accessD.html'&&url.searchParams.size===1&&url.searchParams.has('CNAME'),'JRA_STATUS_URL');
    const ri=jraRace(url.searchParams.get('CNAME'),'TARGET_CARD');need(ri.dateJst===e.dateJst&&ri.venueId===e.venueId&&ri.raceNo===e.raceNo,'STATUS_EVENT');
   }else{
    const expected=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
    expected.searchParams.set('k_babaCode',e.venueId);expected.searchParams.set('k_raceDate',e.dateJst.replaceAll('-','/'));expected.searchParams.set('k_raceNo',String(e.raceNo));
    need(url.href===expected.href,'NAR_STATUS_URL');
   }
   need(Array.isArray(z.rows)&&z.rows.length===m.roster.length,'STATUS_FULL_ROSTER');
   for(const [i,h] of z.rows.entries()){
    exact(h,['horseNo','horseId','displayName','status']);need(['ACTIVE','CANCELLED','UNKNOWN'].includes(h.status),'STATUS_LITERAL');
    const w=bind(d,h.horseNo,h.displayName,h.horseId);
    need(m.roster.some(q=>q.horseId===w.horseId&&q.horseNo===w.horseNo),'STATUS_ROSTER_ROW');
    put(d,w,'status',h.status,x=>choice(x,['ACTIVE','CANCELLED','UNKNOWN']),ptr('rows/'+i,'status'));
   }
  }else if(d.format==='JRA_STORED_ROW_JSON_1'){
   // An independently authorized immutable export of existing table rows.
   // This is not a parser of arbitrary JRA HTML; historical race rows and
   // current card rows must be separated before export. Never read past_runs
   // or raw free text as proof of a different event.
   need(circuit==='JRA'&&d.encoding==='UTF8','JRA_FORMAT');
   const z=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));exact(z,['race','runners']);need(z.race&&Array.isArray(z.runners),'ROW_EXPORT');
   const q=z.race,card=d.role==='TARGET_CARD';allowed(q,raceKeys.concat(card?['cname','post_time']:['source_ref','halon_times']));
   if(card)need(cardPost(q.post_time,e.dateJst)===scheduledPost,'JRA_TARGET_POST_MISMATCH');
   const ref=card?q.cname:q.source_ref,ri=jraRace(ref,d.role);
   need(ri.dateJst===e.dateJst&&ri.venueId===e.venueId&&ri.raceNo===e.raceNo&&q.race_date===e.dateJst&&q.track===ri.track&&q.race_no===e.raceNo&&d.venueLiteral===ri.track,'JRA_EVENT_ROW_BINDING');
   // Source descriptor must bind the actual ref, not just date/track.
   need(d.sourceRef===ref||d.sourceRef==='https://www.jra.go.jp/JRADB/access'+(d.role==='TARGET_CARD'?'D':'S')+'.html?CNAME='+ref.replace(/^\/JRADB\/access[DS]\.html\?CNAME=/,''),'JRA_DOCUMENT_REF');
   for(const [k,f,fn] of [['surface','surfaceLiteral',surface],['turn','directionLiteral',direction],['distance','distanceM',x=>num(x,600,5000)],['going','goingLiteral',going],['class_name','classLiteral',lit],['field_size','declaredCount',x=>num(x,1,24)]])put(d,null,f,q[k],fn,ptr('race',k));
   if(d.role==='HISTORICAL_RESULT')put(d,null,'leaderLapSlots',q.halon_times,splitLaps,ptr('race','halon_times'));
   for(const [i,h] of z.runners.entries()){
    allowed(h,runnerKeys.concat(card?[]:['finish','time_raw','margin','final3f','corner_positions']));
    const no=num(h.horse_no,1,24),hk=jraHorse(h.horse_ref);need(no!==null&&hk!==null,'JRA_NATIVE_HORSE_REF');const w=bind(d,no,h.horse_name,hk);
    for(const [k,f,fn] of [['horse_name','displayName',lit],['draw','gate',x=>num(x,1,8)],['weight_carried','weightG',x=>scaled(x,30000,90000)],['body_weight','bodyWeightKg',x=>num(x,200,900)],['body_weight_diff','bodyWeightDeltaKg',x=>num(x,-100,100)],['sex_age','sexAge',x=>/^[牡牝セ騸]\d{1,2}$/.test(x)?x:null],['equipment','equipmentLiteral',lit]])put(d,w,f,h[k],fn,ptr('runners/'+i,k));
    if(d.role==='HISTORICAL_RESULT')for(const [k,f,fn] of [['finish','finish',x=>num(x,1,24)],['time_raw','finishClockLiteral',clock],['margin','officialMarginLiteral',margin],['final3f','final600Ms',x=>scaled(x,10000,300000)],['corner_positions','cornerPositionsLiteral',corner]])put(d,w,f,h[k],fn,ptr('runners/'+i,k));
   }
  }else throw Error('UNSUPPORTED_SOURCE_FORMAT');
 }
 // Check every current roster row against actual extracted horse rows.
 const targetSeen=cardRows;
 need(targetSeen.size===m.roster.length&&m.roster.every(h=>targetSeen.has(h.horseId)&&rowMap.get(JSON.stringify([targetId,h.horseNo]))?.horseId===h.horseId),'TARGET_ROSTER_COVERAGE');
 const observations=[],sourceStates=[];
 for(const arr of facts.values()){
  const first=arr[0],observed=arr.filter(x=>x.state==='OBSERVED'),values=new Set(observed.map(x=>JSON.stringify(x.value)));
  // No latest-wins based on timestamps alone. Keep conflicting/missing source roots.
  sourceStates.push({eventId:first.eventId,horseId:first.horseId,field:first.field,sources:arr.map(x=>({state:x.state,reason:x.reason,root:x.root}))});
  const state=values.size>1?'CONFLICT':values.size===1?'OBSERVED':arr.some(x=>x.state==='HELD')?'HELD':'MISSING';
  observations.push({eventId:first.eventId,horseId:first.horseId,pastHorseNo:first.pastHorseNo,field:first.field,state,value:state==='OBSERVED'?observed[0].value:null,reason:state==='OBSERVED'?null:state==='CONFLICT'?'SOURCE_VALUES_CONFLICT':arr.find(x=>x.state===state).reason,roots:(state==='OBSERVED'?observed:arr).map(x=>x.root)});
 }
 const roster=m.roster.map(h=>{
  const s=observations.find(o=>o.eventId===targetId&&o.horseId===h.horseId&&o.field==='status');
  // Only source-observed status; NAR positional CSV has none.
  const status=s?.state==='OBSERVED'?s.value:'UNKNOWN';need(h.status===status||h.status==='UNKNOWN','ROSTER_STATUS_CONFLICT');
  if(!s)observations.push({eventId:targetId,horseId:h.horseId,pastHorseNo:null,field:'status',state:'MISSING',value:null,reason:'OFFICIAL_STATUS_SOURCE_REQUIRED',roots:[]});
  return {...h,status};
 });
 const documents=m.documents.map(({format,encoding,venueLiteral,...d})=>d);
 const p={schema:supplyContract.package.schema,engineCommit:supplyContract.engineCommit,circuit,targetId,cutoff,scheduledPost,startLower,events:m.events,roster,documents,observations};
 const inspection=inspectNativeFacts(p);
 return {scope:fixture?'EXISTING_WORK44_FIXTURE_CONVERSION_ONLY':'LOCAL_EXTRACTION_NOT_ADMISSION',package:p,inspection,sourceStates,realAdmission:false};
}
// The operator must obtain the pin and authority key independently (not
// from the supplied raw files). This signature is not a Codex admission.
export function verifyApprovedManifest(signed,trust){
 exact(signed,['payload','signature']);exact(trust,['authorityPublicKeyPem','expectedManifestSha256']);
 const bytes=Buffer.from(JSON.stringify(signed.payload));need(hex(trust.expectedManifestSha256)&&sha(bytes)===trust.expectedManifestSha256,'MANIFEST_PIN');
 need(verify(null,bytes,createPublicKey(trust.authorityPublicKeyPem),Buffer.from(signed.signature,'base64')),'MANIFEST_SIGNATURE');
 exact(signed.payload,scopeKeys);need(signed.payload.schema==='WORK07_OFFLINE_SOURCE_MANIFEST_1'&&signed.payload.scope==='APPROVED_LOCAL_SOURCE','SOURCE_SCOPE');
 need(Array.isArray(signed.payload.documents)&&signed.payload.documents.length>0,'DOCUMENTS_REQUIRED');
 return signed.payload;
}
export function convertApprovedLocal(signed,raws,trust){
 return convert(verifyApprovedManifest(signed,trust),raws);
}
// Existing Work44 only: independent frozen verifier must be invoked first.
// No synthetic identity may reach the actual native entry.
export function convertExistingWork44(bundle,trust){
 const v=reviewPacket(bundle,trust);need(v.scope==='SYNTHETIC_OFFICIAL_FORMAT_TEST','FIXTURE_SCOPE');
 const m=bundle.manifest.payload,i=bundle.identity.payload,reg=bundle.inventory.payload.raceRegistry;
 const events=reg.map(x=>({id:x.eventId,issuer:'NAR',nativeId:x.eventId,venueId:x.raceIdentity.venueId,dateJst:x.raceIdentity.dateJst.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),raceNo:x.raceIdentity.raceNo,role:x.eventId===m.target.eventId?'TARGET_CARD':'HISTORICAL_RESULT',identityProofRefs:[trust.expectedIdentitySha256]}));
 const docs=m.documents.map(d=>({id:d.id,eventId:d.eventId,role:d.role,sourceRef:d.url,version:d.version,supersedes:null,publishedAt:d.publishedAt,updatedAt:d.updatedAt,capturedAt:d.capturedAt,uncertaintyMs:d.uncertaintyMs,sha256:d.sha256,permissionRef:trust.expectedRightsSha256,custodyRef:trust.expectedManifestSha256,format:d.format,encoding:d.encoding,venueLiteral:reg.find(x=>x.eventId===d.eventId).raceIdentity.venueLiteral}));
 const rowWitnesses=i.rows.map(x=>({eventId:x.eventId,horseNo:x.no,horseId:x.horseId,displayName:x.displayName,proofRef:trust.expectedIdentitySha256}));
 const roster=rowWitnesses.filter(x=>x.eventId===m.target.eventId).map(x=>({horseId:x.horseId,horseNo:x.horseNo,status:'UNKNOWN',proofRefs:[x.proofRef]}));
 return convert({schema:'WORK07_OFFLINE_SOURCE_MANIFEST_1',scope:'EXISTING_WORK44_FIXTURE',circuit:'LOCAL',targetId:m.target.eventId,cutoff:m.cutoff,scheduledPost:m.target.scheduledPost,startLower:m.startLower,events,roster,documents:docs,rowWitnesses},new Map(bundle.rawFiles.map(x=>[x.id,Buffer.from(x.base64,'base64')])),{fixture:true});
}
