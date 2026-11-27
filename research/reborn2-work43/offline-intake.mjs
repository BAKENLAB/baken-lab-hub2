// Work43 offline source adapter. Real admission intentionally disabled.
// No network, DB, analysis engine, market or target result consumption.
import {createHash,verify} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(v,m)=>{if(!v)throw Error(m)},eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(x,k,m)=>need(x&&typeof x==='object'&&!Array.isArray(x)&&eq(Object.keys(x).sort(),[...k].sort()),m);
const time=s=>{need(typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s),'TIME_FORMAT');const t=Date.parse(s);need(Number.isFinite(t)&&new Date(t).toISOString()===s,'TIME_FORMAT');return t;};
const id=s=>typeof s==='string'&&/^TEST:[A-Za-z0-9_-]+$/.test(s);
const integer=(s,lo,hi)=>{need(/^[0-9]+$/.test(s),'INTEGER_LITERAL');const n=Number(s);need(Number.isSafeInteger(n)&&n>=lo&&n<=hi,'INTEGER_RANGE');return n;};
const literal=(s)=>{need(typeof s==='string'&&s.length<=200&&!/[\x00-\x1f]/.test(s),'TEXT_LITERAL');return s;};
const kg=s=>{need(/^[0-9]{2}(?:\.[0-9])?$/.test(s),'WEIGHT_LITERAL');const n=Number(s)*1000;need(n>=40000&&n<=80000,'WEIGHT_RANGE');return n;};
const bytes=s=>{need(typeof s==='string'&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s),'BASE64');const b=Buffer.from(s,'base64');need(b.length>0&&b.length<=2_000_000&&b.toString('base64')===s,'BASE64');return b;};
function signed(s,key,kind){exact(s,['payload','signature'],kind+'_SHAPE');const b=Buffer.from(JSON.stringify(s.payload));need(typeof s.signature==='string'&&verify(null,b,key,Buffer.from(s.signature,'base64')),kind+'_SIGNATURE');return s.payload;}
const map=JSON.parse(readFileSync(new URL('./source-map-115.json',import.meta.url)));
export const canonical=map.items.map(q=>({item:q.id.startsWith('EYE-')?q.id.replace('-',''):'RANK'+q.id,name:q.name,route:q.source_key}));
export const heldEYE={
 EYE04:{needs:['historical_finish','literal_margin','verified_peer_identity','peer_followup_before_cutoff','independent_strength_reference','same_condition_gap_distribution'],sources:['JRA result, ratings and class rules','NAR result, selected published ratings and organizer rules'],block:'rating coverage incomplete; opponent win or class label alone does not prove strength'},
 EYE06:{needs:['last_race_incident_with_horse_role','passing_order','individual_final_section','current_roster','course_version','admissible_current_scenario'],sources:['JRA race events and steward record','NAR/organizer steward record where published'],block:'unreported incident is unknown; rank and clock do not measure physical load or confirm relief'},
 EYE14:{needs:['cross_registry_identity','effective_class_rule','historical_field_strength','current_all_peer_strength','before_cutoff_versions'],sources:['JRA program/rating','NAR organizer rules and race results'],block:'no verified universal class conversion or all-horse ratings; same-name join forbidden'},
 EYE15:{needs:['two_or_more_distinct_observed_mechanisms_if_supported','mechanism_dependencies','counter_observations','joint_current_scenario'],sources:['joined admitted card, history, course, incident and rules'],block:'no fixed required number authorized; joint benefit derived, not an official column; do not count overlapping roots twice'}
};
// CSV parser preserves logical record and exact byte range for UTF-8 or CP932.
// Headerless positional fixture corresponds to public documentation; actual
// official header/encoding/version require approved native conformance.
export function csvRows(raw,encoding){
 need(['UTF8','CP932'].includes(encoding),'ENCODING');
 const b=Buffer.isBuffer(raw)?raw:Buffer.from(raw),records=[];let start=0,fieldStart=0,quoted=false,closed=false,fields=[];
 const decoder=new TextDecoder(encoding==='UTF8'?'utf-8':'shift_jis',{fatal:true});
 const decode=(a,z)=>{const q=b.subarray(a,z);let s=decoder.decode(q);if(s.startsWith('"')){need(s.endsWith('"'),'CSV_QUOTE');s=s.slice(1,-1).replaceAll('""','"');}else need(!s.includes('"'),'CSV_QUOTE');return s;};
 const field=end=>{fields.push(decode(fieldStart,end));closed=false;};
 const record=end=>{field(end);records.push({record:records.length+1,start,end,fields});fields=[];};
 for(let i=0;i<b.length;i++){
  const x=b[i];
  if(encoding==='CP932'&&((x>=0x81&&x<=0x9f)||(x>=0xe0&&x<=0xfc))){need(i+1<b.length,'CP932_TRUNCATED');i++;continue;}
  if(x===34){if(quoted){if(b[i+1]===34){i++;continue;}quoted=false;closed=true;}else{need(i===fieldStart&&!closed,'CSV_QUOTE');quoted=true;}continue;}
  if(quoted)continue;
  if(x===44){field(i);fieldStart=i+1;continue;}
  if(x===13||x===10){record(i);if(x===13&&b[i+1]===10)i++;start=fieldStart=i+1;continue;}
  need(!closed,'CSV_TRAILING_QUOTE');
 }
 need(!quoted,'CSV_UNTERMINATED');if(start<b.length)record(b.length);need(records.length>0,'CSV_EMPTY');return records;
}
const fieldKeys={HORSELIST:['gate','horse_no','display_name','sex','age','birth_date','weight_g','body_weight_kg','body_weight_delta_kg','finish','clock_literal','margin_literal','final600_ms'],RACELIST:['scheduled_post_literal','surface','direction','distance_m','going','declared_count','class_literal','race_final4f_ms','race_final3f_ms','leader_laps_literal','corner_groups_literal']};
const routeKey=(issuer,kind)=>issuer==='LOCAL'?(kind==='HORSELIST'?'NAR_HORSELIST_36':'NAR_RACELIST_66'):'JRA_NATIVE_FORMAT_NOT_APPROVED';
const eventKey=f=>{literal(f[0]);need(/^\d{8}$/.test(f[1]),'RACE_DATE');const iso=f[1].slice(0,4)+'-'+f[1].slice(4,6)+'-'+f[1].slice(6)+'T00:00:00.000Z';time(iso);return f[0]+'|'+f[1]+'|'+integer(f[2],1,24);};
const sec=s=>{need(/^[0-9]{1,3}(?:\.[0-9])?$/.test(s),'SECTION_LITERAL');const n=Number(s)*1000;need(n>0&&n<=300000,'SECTION_RANGE');return n;};
function extract(doc,raw,identities,target,add){
 const rec=csvRows(raw,doc.encoding),card=doc.role==='TARGET_CARD';
 const kind=doc.kind;need(kind==='HORSELIST'||kind==='RACELIST','DOCUMENT_KIND');
 for(const row of rec){const f=row.fields;need(f.length===(kind==='HORSELIST'?36:66),'COLUMN_COUNT');need(eventKey(f)===doc.eventKey,'EVENT_ROW_IDENTITY');
  if(kind==='HORSELIST'){
   const no=integer(f[5],1,24),match=identities.filter(q=>q.eventId===doc.eventId&&q.no===no);
   need(match.length===1&&match[0].displayName===f[6]&&id(match[0].horseId),'HORSE_IDENTITY_NOT_BOUND');
   const h=match[0].horseId;
   if(card)need(f.slice(31,36).every(s=>s===''),'TARGET_RESULT_OR_MARKET_PRESENT');
   const values=[[3,'gate',integer(f[3],1,24)],[5,'horse_no',no],[6,'display_name',literal(f[6])],[7,'sex',literal(f[7])],[8,'age',integer(f[8],0,30)],[10,'birth_date',literal(f[10])],[16,'weight_g',f[16]===''?null:kg(f[16])],[22,'body_weight_kg',f[22]===''?null:integer(f[22],200,900)],[23,'body_weight_delta_kg',f[23]===''?null:(need(/^-?[0-9]{1,3}$/.test(f[23]),'BODY_DELTA'),Number(f[23]))]];
   if(!card)values.push([31,'finish',f[31]===''?null:integer(f[31],1,24)],[32,'clock_literal',f[32]===''?null:literal(f[32])],[33,'margin_literal',f[33]===''?null:literal(f[33])],[34,'final600_ms',f[34]===''?null:sec(f[34])]);
   for(const [i,k,v] of values)add(doc,row,h,k,v,[i+1]); // no popularity column ever projected
  }else{
   if(card)need(f.slice(33).every(s=>s===''),'TARGET_RESULT_OR_MARKET_PRESENT');
   need(/^\d{4}$/.test(f[3])&&Number(f[3].slice(0,2))<24&&Number(f[3].slice(2))<60,'POST_LITERAL');
   if(card){const jst=new Date(time(target.scheduledPost)+9*3600000).toISOString();need(jst.slice(0,10).replaceAll('-','')===f[1]&&jst.slice(11,16).replace(':','')===f[3],'TARGET_POST_MISMATCH');}
   const values=[[3,'scheduled_post_literal',f[3]],[21,'surface',literal(f[21])],[22,'direction',literal(f[22])],[23,'distance_m',integer(f[23],600,5000)],[25,'going',literal(f[25])],[26,'declared_count',integer(f[26],1,24)],[27,'class_literal',literal(f[27])]];
   if(!card){values.push([33,'race_final4f_ms',f[33]===''?null:sec(f[33])],[34,'race_final3f_ms',f[34]===''?null:sec(f[34])],[35,'leader_laps_literal',f.slice(35,50).filter(Boolean).map(literal)],[50,'corner_groups_literal',f.slice(50,58).map((s,i)=>({corner:literal(s),order:literal(f[58+i])})).filter(q=>q.corner||q.order)]);}
   for(const [i,k,v] of values)add(doc,row,null,k,v,k==='leader_laps_literal'?Array.from({length:15},(_,j)=>36+j):k==='corner_groups_literal'?Array.from({length:16},(_,j)=>51+j):[i+1]);
  }
 }
 return rec.length;
}
const dependencies={
 RANK02:['finish'],RANK03:['finish','clock_literal','margin_literal'],RANK05:['clock_literal'],RANK06:['final600_ms'],RANK17:['corner_groups_literal'],RANK19:['leader_laps_literal'],RANK67:['verified_course_first_turn_m'],RANK81:['body_weight_kg','body_weight_delta_kg'],RANK90:['verified_pedigree'],RANK91:['sex','age','birth_date'],
 EYE04:heldEYE.EYE04.needs,EYE06:heldEYE.EYE06.needs,EYE14:heldEYE.EYE14.needs,EYE15:heldEYE.EYE15.needs,
 RANK59:['corner_groups_literal','verified_individual_corner_rank'],RANK63:['current_roster','verified_individual_corner_rank'],RANK76:['earlier_same_day_results','verified_track_version'],RANK77:['earlier_same_day_results','verified_individual_corner_rank'],RANK85:['verified_rider_history','verified_rider_identity']};
export function reviewPacket(bundle,trust){
 // No live path until policy, native conformance and explicit pilot approval.
 need(bundle?.scope==='SYNTHETIC_OFFICIAL_FORMAT_TEST','REAL_INTAKE_DISABLED');
 exact(bundle,['scope','manifest','rights','inventory','identity','rawFiles'],'BUNDLE_FIELDS');
 exact(trust,['scope','authorityKey','custodyKey','expectedManifestSha256','expectedRightsSha256','expectedInventorySha256','expectedIdentitySha256','now'],'TRUST_FIELDS');
 need(trust.scope==='LOCAL_TEST_KEYS_ONLY','REAL_TRUST_DISABLED');
 const m=signed(bundle.manifest,trust.custodyKey,'MANIFEST'),p=signed(bundle.rights,trust.authorityKey,'RIGHTS'),i=signed(bundle.inventory,trust.authorityKey,'INVENTORY'),ident=signed(bundle.identity,trust.authorityKey,'IDENTITY');
 for(const [a,b] of [[m,trust.expectedManifestSha256],[p,trust.expectedRightsSha256],[i,trust.expectedInventorySha256],[ident,trust.expectedIdentitySha256]])need(sha(JSON.stringify(a))===b,'EXTERNAL_PIN_MISMATCH');
 exact(m,['target','cutoff','startLower','sealedAt','documents'],'MANIFEST_FIELDS');exact(m.target,['issuer','eventId','scheduledPost'],'TARGET_FIELDS');
 need(m.target.issuer==='LOCAL'&&id(m.target.eventId),'JRA_NATIVE_FORMAT_OR_ISSUER_UNAPPROVED');
 const cut=time(m.cutoff),post=time(m.target.scheduledPost),lower=time(m.startLower),seal=time(m.sealedAt),now=time(trust.now);
 need(seal<=cut&&cut<lower&&lower<=post&&now>=seal,'CUTOFF');
 exact(p,['issuer','validFrom','validUntil','revokedAt','purposes','formats','sourceUrls'],'RIGHTS_FIELDS');
 need(p.issuer===m.target.issuer&&time(p.validFrom)<=seal&&now<time(p.validUntil)&&(p.revokedAt===null||now<time(p.revokedAt))&&['ACQUIRE','RETAIN','LOCAL_RESEARCH'].every(x=>p.purposes.includes(x)),'RIGHTS_NOT_ACTIVE');
 exact(i,['asOf','complete','versions'],'INVENTORY_FIELDS');need(i.complete===true&&time(i.asOf)===cut&&Array.isArray(i.versions),'INVENTORY_INCOMPLETE');
 exact(ident,['issuer','rows'],'IDENTITY_FIELDS');need(ident.issuer===m.target.issuer&&Array.isArray(ident.rows),'IDENTITY_ISSUER');
 for(const q of ident.rows){exact(q,['eventId','no','displayName','horseId'],'IDENTITY_ROW');need(id(q.eventId)&&id(q.horseId)&&Number.isInteger(q.no)&&q.no>0,'IDENTITY_ROW');}
 need(new Set(ident.rows.map(q=>q.eventId+'|'+q.no)).size===ident.rows.length&&new Set(ident.rows.map(q=>q.eventId+'|'+q.horseId)).size===ident.rows.length,'IDENTITY_DUPLICATE');
 need(Array.isArray(m.documents)&&m.documents.length>0&&Array.isArray(bundle.rawFiles)&&bundle.rawFiles.length===m.documents.length,'DOCUMENT_COUNT');
 const ids=new Set(),docKeys=new Set(),obs=[],roots=[],seen=new Set();
 for(const d of m.documents){
  exact(d,['id','issuer','kind','role','eventId','eventKey','eventAt','version','publishedAt','updatedAt','capturedAt','uncertaintyMs','url','format','encoding','sha256'],'DOCUMENT_FIELDS');
  need(id(d.id)&&id(d.eventId)&&d.issuer===m.target.issuer&&!ids.has(d.id),'DOCUMENT_ID');ids.add(d.id);
  need(['TARGET_CARD','HISTORICAL_RESULT'].includes(d.role)&&(d.role==='TARGET_CARD'?d.eventId===m.target.eventId:d.eventId!==m.target.eventId),'TARGET_RESULT_LEAK');
  const key=d.eventId+'|'+d.kind;need(!docKeys.has(key),'DUPLICATE_DOCUMENT');docKeys.add(key);
  const pub=time(d.publishedAt),upd=time(d.updatedAt),cap=time(d.capturedAt);
  need(Number.isSafeInteger(d.uncertaintyMs)&&d.uncertaintyMs>=0&&time(p.validFrom)<=pub&&pub<=upd&&upd<=cap&&cap+d.uncertaintyMs<=seal,'SOURCE_CHRONOLOGY');
  need(d.role==='TARGET_CARD'?d.eventAt===m.target.scheduledPost:time(d.eventAt)<pub,'EVENT_CHRONOLOGY');
  const fmt=routeKey(d.issuer,d.kind),url=new URL(d.url);need(d.format===fmt&&p.formats.includes(fmt)&&p.sourceUrls.includes(d.url)&&url.protocol==='https:'&&url.hostname==='www.keiba.go.jp'&&!url.username&&!url.password&&!url.port,'SOURCE_RIGHTS_SCOPE');
  const versions=i.versions.filter(q=>q.eventId===d.eventId&&q.kind===d.kind);
  for(const q of versions){exact(q,['eventId','kind','version','publishedAt','updatedAt','sha256'],'VERSION_FIELDS');need(Number.isSafeInteger(q.version)&&q.version>0&&time(q.publishedAt)<=time(q.updatedAt),'VERSION_INVALID');}
  need(versions.length>0&&new Set(versions.map(q=>q.version)).size===versions.length,'VERSION_INVENTORY');
  need(!versions.some(q=>time(q.publishedAt)<=cut&&time(q.updatedAt)>cut),'VERSION_TIME_AMBIGUOUS');
  const latest=versions.filter(q=>time(q.updatedAt)<=cut).sort((a,b)=>a.version-b.version).at(-1);
  need(latest&&latest.version===d.version&&latest.sha256===d.sha256&&latest.publishedAt===d.publishedAt&&latest.updatedAt===d.updatedAt,'LATEST_VERSION_REQUIRED');
  const f=bundle.rawFiles.filter(q=>q.id===d.id);need(f.length===1,'RAW_FILE_ID');exact(f[0],['id','base64'],'RAW_FILE_FIELDS');
  const raw=bytes(f[0].base64);need(sha(raw)===d.sha256,'RAW_HASH');
  const root=sha(JSON.stringify([d.issuer,d.eventId,d.kind,d.version,d.sha256]));roots.push({id:root,sourceSha256:d.sha256,eventId:d.eventId,kind:d.kind,version:d.version});
  extract(d,raw,ident.rows,m.target,(doc,row,h,k,v,cols)=>{
   const rowKey=[doc.issuer,doc.eventId,doc.kind,h,k];need(!seen.has(JSON.stringify(rowKey)),'DUPLICATE_OBSERVATION');seen.add(JSON.stringify(rowKey));
   const rowRoot=sha(JSON.stringify([root,row.record,row.start,row.end,sha(raw.subarray(row.start,row.end))]));
   const evidenceId=sha(JSON.stringify([rowRoot,h,k,cols]));
   obs.push({evidenceId,eventId:doc.eventId,horseId:h,field:k,value:v,status:v===null||Array.isArray(v)&&!v.length?'MISSING':'OBSERVED_TEST_FORMAT',sourceRoot:root,rowRoot,rowPointer:{record:row.record,start:row.start,end:row.end,columns:cols},depends:[root],role:doc.role,formal:false});
  });
 }
 need(docKeys.has(m.target.eventId+'|HORSELIST')&&docKeys.has(m.target.eventId+'|RACELIST'),'TARGET_CARD_INCOMPLETE');
 const targetObs=obs.filter(q=>q.role==='TARGET_CARD'),horses=targetObs.filter(q=>q.field==='horse_no').map(q=>q.horseId),count=targetObs.find(q=>q.field==='declared_count')?.value;
 need(horses.length===count&&new Set(horses).size===horses.length,'ROSTER_INCOMPLETE');
 const hist=obs.filter(q=>q.role==='HISTORICAL_RESULT');
 const runners=horses.map(h=>({horseId:h,items:canonical.map(q=>{
  const fields=dependencies[q.item]??[],available=obs.filter(e=>fields.includes(e.field)&&(e.horseId===h||e.horseId===null)&&e.status==='OBSERVED_TEST_FORMAT');
  // All 115 enumerated, none declared analyzed. Literal clock and grouped
  // positions stay distinct from native typed individual measurements.
  return {item:q.item,name:q.name,route:q.route,requiredFields:fields,refs:available.map(e=>e.evidenceId),state:'HELD',reason:heldEYE[q.item]?.block??(fields.length?'SEMANTIC_DEPENDENCIES_AND_NATIVE_CONFORMANCE_PENDING':'FIELD_SPECIFIC_ANALYSIS_CONTRACT_PENDING'),formal:false};
 })}));
 const output={schema:'WORK43_OFFLINE_REVIEW_0.1',scope:'SYNTHETIC_OFFICIAL_FORMAT_TEST',target:m.target,cutoff:m.cutoff,roots,observations:obs,runners,groups:118,held:826,engineInput:null,realAdmission:false,formal:false,blockers:['OFFICIAL_RIGHTS_AND_PILOT_APPROVAL','REAL_NATIVE_FORMAT_CONFORMANCE','EXTERNALLY_TRUSTED_CUSTODY_AND_TIME','COMMON_ENGINE_REAL_CONTRACT_NOT_ENABLED']};
 return {...output,analysisSha256:sha(JSON.stringify(output))};
}
