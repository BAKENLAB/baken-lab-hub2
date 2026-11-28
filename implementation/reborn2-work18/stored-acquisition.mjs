// Canonical stored JSON digest; no caller boolean accepted as integrity proof.
export function canonical(x){return x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}'}
export function hashText(str){
 const b=[];for(const ch of str){let c=ch.codePointAt(0);if(c<128)b.push(c);else if(c<2048)b.push(192|c>>6,128|c&63);else if(c<65536)b.push(224|c>>12,128|c>>6&63,128|c&63);else b.push(240|c>>18,128|c>>12&63,128|c>>6&63,128|c&63);}
 const bits=b.length*8;b.push(128);while(b.length%64!==56)b.push(0);for(let i=7;i>=0;i--)b.push(Math.floor(bits/2**(8*i))&255);
 const K=[],H=[];for(let n=2;K.length<64;n++){let prime=true;for(let d=2;d*d<=n;d++)if(n%d===0){prime=false;break;}if(!prime)continue;if(H.length<8)H.push((Math.sqrt(n)%1*2**32)|0);K.push((Math.cbrt(n)%1*2**32)|0);}
 const R=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let o=0;o<b.length;o+=64){let w=[];for(let i=0;i<16;i++)w[i]=(b[o+4*i]<<24)|(b[o+4*i+1]<<16)|(b[o+4*i+2]<<8)|b[o+4*i+3];for(let i=16;i<64;i++){let x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(R(x,7)^R(x,18)^(x>>>3))+w[i-7]+(R(y,17)^R(y,19)^(y>>>10)))|0;}let [a,c,d,e,f,g,h,j]=H;for(let i=0;i<64;i++){let t=(j+(R(f,6)^R(f,11)^(R(f,25)))+((f&g)^(~f&h))+K[i]+w[i])|0,u=((R(a,2)^R(a,13)^R(a,22))+((a&c)^(a&d)^(c&d)))|0;j=h;h=g;g=f;f=(e+t)|0;e=d;d=c;c=a;a=(t+u)|0;}const z=[a,c,d,e,f,g,h,j];for(let i=0;i<8;i++)H[i]=(H[i]+z[i])|0;}
 return H.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}
// Work18: reusable stored-fact acquisition. No native approval.
// Pure functions, no network/DB writes/CLAIM/market/target outcome.
const tm=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const present=x=>x!==null&&x!==undefined&&x!==''&&(!Array.isArray(x)||x.length>0);
const int=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const jraHorse=/^\/JRADB\/accessU\.html\?CNAME=pw01dud(?:00|10)([0-9]{10})\/[0-9A-Fa-f]{2}$/;
const jraResult=/^\/JRADB\/accessS\.html\?CNAME=pw01sde(?:01|10)([0-9]{2})([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{8})\/[0-9A-Fa-f]{2}$/;
const jraTracks={'01':'札幌','02':'函館','03':'福島','04':'新潟','05':'東京','06':'中山','07':'中京','08':'京都','09':'阪神','10':'小倉'};
const narCodes={'佐賀':'32','船橋':'19','園田':'27','高知':'31','大井':'20','川崎':'21','浦和':'18','名古屋':'24','笠松':'23','金沢':'22','門別':'36','盛岡':'10','水沢':'11','姫路':'28'};
const narResult=e=>'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode='+narCodes[e.track]+'&k_raceDate='+e.raceDate.replaceAll('-','%2F')+'&k_raceNo='+e.raceNo;
const narHorse=/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=([0-9]{1,30})$/;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const guard=(v,m)=>{if(!v)throw Error(m)};
function sourceFacts(row,fields,root,tier){return Object.fromEntries(Object.entries(fields).filter(([k,v])=>present(row[v])).map(([k,v])=>[k,{value:row[v],sourceField:v,root,tier}]));}
export function fieldBoundary(input){
 const errors=[];const post=tm(input.post),at=tm(input.fetchedAt),cut=tm(input.cutoff);
 if(post===null||at===null||cut===null||at>cut||cut>=post)errors.push('TIME_INVALID');
 if(!date(input.raceDate)||!int(input.raceNo,1,14)||!input.track)errors.push('EVENT_IDENTITY');
 if(input.circuit==='LOCAL'?input.source!=='NAR_OFFICIAL_DEBA':input.circuit==='JRA'?input.source!=='JRA_VERIFIED_CURRENT_ENTRY':true)errors.push('SOURCE_NOT_VERIFIED');
 if(input.complete!==true)errors.push('COMPLETENESS_NOT_RECORDED');
 const rows=Array.isArray(input.rows)?input.rows:[],numbers=new Set(),ids=new Set();
 if(!rows.length)errors.push('EMPTY_FIELD');
 let identityMissing=0;
 for(const h of rows){
  if(!int(h.no,1,24)||numbers.has(h.no)||!h.name||!['ACTIVE','CANCELLED','EXCLUDED'].includes(h.status))errors.push('ROW_STATUS_OR_IDENTITY');
  numbers.add(h.no);
  const id=(input.circuit==='JRA'?jraHorse:narHorse).exec(h.ref??'')?.[1];
  if(!id)identityMissing++;else if(ids.has(id))errors.push('DUPLICATE_HORSE_ID');else ids.add(id);
 }
 return {recordedFieldPass:errors.length===0,errors:[...new Set(errors)],listedCount:rows.length,activeCount:rows.filter(x=>x.status==='ACTIVE').length,identityMissing,identityComplete:identityMissing===0,formalAdmission:false,originalReplay:false};
}
export function adaptJraHistory(input){
 guard(date(input.targetDate)&&tm(input.cutoff)!==null&&tm(input.post)!==null&&tm(input.cutoff)<tm(input.post),'JRA_TARGET_TIME');
 const accepted=[],held=[];
 for(const x of input.rows){
  const id=jraHorse.exec(x.horseRef??'')?.[1],z=x.run??{},m=jraResult.exec(z.source_ref??'');
  const valid=id&&m&&date(z.race_date)&&z.race_date<input.targetDate&&m[6]===z.race_date.replaceAll('-','')&&jraTracks[m[1]]===z.track&&int(Number(z.horse_no),1,24)&&tm(x.checkedAt)!==null&&tm(x.updatedAt)!==null&&tm(x.checkedAt)<=tm(input.cutoff)&&tm(x.updatedAt)<=tm(input.cutoff);
  if(!valid){held.push({currentNo:x.currentNo,reason:'IDENTITY_OR_TIME_UNBOUND'});continue;}
  const event='JRA-'+m[1]+'-'+m[6]+'-'+m[5],root={kind:'STORED_JRA_ATTACHED_HISTORY',rowId:x.rowId,index:x.index,sourceRef:z.source_ref,observedAt:x.checkedAt,event,horseId:id};
  accepted.push({event,horseId:id,currentNo:x.currentNo,pastNo:Number(z.horse_no),facts:sourceFacts(z,{date:'race_date',track:'track',distance:'distance',surface:'surface',going:'going',classLiteral:'race_class',classDetail:'race_class_detail',reportedFieldSize:'field_size',finish:'finish',clock:'time_raw',reportedWinnerGap:'margin_to_winner',final600:'final3f',ordinalUnlabeled:'corner_positions',weight:'weight_carried',bodyWeight:'body_weight',jockeyName:'jockey'},root,'REPORTED_STORED_HISTORY_NOT_ORIGINAL')});
 }
 return {circuit:'JRA',accepted,held,formalAdmission:false,originalReplay:false};
}
export function adaptLocalSnapshot(input,expected){
 const pk=input.evidence?.packet,asof=tm(input.as_of),captured=tm(input.captured_at),post=tm(input.official_post_time);
 guard(expected&&input.id===expected.id&&input.payload_digest===expected.digest&&/^[a-f0-9]{64}$/.test(expected.digest)&&hashText(canonical(input.evidence))===expected.digest&&input.evidence?.schemaVersion==='LOCAL_OFFICIAL_CORNERS_1'&&input.source_kind==='LOCAL_OFFICIAL_CORNERS'&&input.source_version==='LOCAL_CORNER_1','LOCAL_SNAPSHOT_PIN');
 guard(date(input.race_date)&&narCodes[input.track]&&int(input.race_no,1,14)&&input.race_date===expected.date&&input.track===expected.track&&input.race_no===expected.raceNo&&tm(expected.cutoff)!==null&&captured<=tm(expected.cutoff),'LOCAL_TARGET_PIN');
 guard(Array.isArray(pk?.evidence)&&pk.evidence.length===pk.linkedRunEvidence&&Array.isArray(pk.opponentFollowups)&&Array.isArray(pk.officialRaceLaps)&&pk.status==='PREFETCH_ONLY','LOCAL_PACKET_SHAPE');
 guard(asof!==null&&captured!==null&&post!==null&&asof<=captured&&captured<post&&pk.raceDate===input.race_date&&pk.raceTrack===input.track&&pk.raceNo===input.race_no&&['marketUsed','targetResultUsed','rankChanged','claimStarted','saveAuthorized'].every(k=>pk[k]===false),'LOCAL_TIME_OR_FLAGS');
 const accepted=[],held=[],peers=[],laps=[];
 for(const [index,z] of pk.evidence.entries()){
  const e=z.pastRace,id=narHorse.exec(z.horseRef??'')?.[1],cs=z.corners;
  const valid=id&&date(e.raceDate)&&e.raceDate<input.race_date&&narCodes[e.track]&&int(e.raceNo,1,14)&&z.sourceRef===narResult(e)&&tm(z.sourceCheckedAt)!==null&&tm(z.sourceCheckedAt)<=asof&&z.identityVerifiedBy==='OFFICIAL_HORSE_REF'&&int(z.pastHorseNo,1,24)&&Array.isArray(cs)&&cs.length>=2&&cs.every((c,i)=>int(c.corner,1,4)&&int(c.position,1,24)&&(!i||c.corner===cs[i-1].corner+1))&&cs[0].position===z.earlyPos&&cs.at(-1).position===z.finalTurnPos;
  if(!valid){held.push({index,reason:'LOCAL_CORNER_BINDING'});continue;}
  accepted.push({event:'NAR-'+narCodes[e.track]+'-'+e.raceDate.replaceAll('-','')+'-'+String(e.raceNo).padStart(2,'0'),horseId:id,currentNo:z.horseNo,pastNo:z.pastHorseNo,labels:cs.map(c=>c.corner),positions:cs.map(c=>c.position),root:{snapshotId:input.id,index,sourceRef:z.sourceRef,observedAt:z.sourceCheckedAt},tier:'STORED_ID_BOUND_CORNER_NOT_ORIGINAL'});
 }
 for(const [index,z] of pk.opponentFollowups.entries()){
  const a=z.priorRace,b=z.followupRace;
  if(!date(a.raceDate)||!date(b.raceDate)||!(a.raceDate<b.raceDate&&b.raceDate<input.race_date)||!narCodes[a.track]||!narCodes[b.track]||z.sourceRef!==narResult(a)||z.followupSourceRef!==narResult(b)||tm(z.sourceCheckedAt)===null||tm(z.followupCheckedAt)===null||tm(z.sourceCheckedAt)>asof||tm(z.followupCheckedAt)>asof||!/^\d{1,30}$/.test(z.peerOfficialHorseId)||z.identityMethod!=='EXACT_NAR_OFFICIAL_HORSE_ID_TWO_RESULT_PAGES'||!int(z.peerPriorFinish,1,24)||!int(z.peerFollowupFinish,1,24)||!accepted.some(c=>c.currentNo===z.horseNo&&c.root.sourceRef===z.sourceRef&&c.root.observedAt===z.sourceCheckedAt)||!accepted.some(c=>c.root.sourceRef===z.followupSourceRef&&c.root.observedAt===z.followupCheckedAt)){held.push({index,reason:'PEER_BINDING'});continue;}
  peers.push({currentNo:z.horseNo,peerId:z.peerOfficialHorseId,priorRace:a,followupRace:b,priorFinish:z.peerPriorFinish,followupFinish:z.peerFollowupFinish,root:{snapshotId:input.id,index,sourceRef:z.sourceRef,followupSourceRef:z.followupSourceRef,observedAt:z.sourceCheckedAt,followupObservedAt:z.followupCheckedAt},tier:'STORED_PEER_NOT_FULL_RESULT'});
 }
 for(const [index,z] of pk.officialRaceLaps.entries()){
  const e=z.pastRace,seg=z.segments??[];let end=0,sum=0;const valid=seg.length===z.segment_count&&seg.length>0&&seg.every(s=>{if(s.from_m!==end||!Number.isFinite(s.seconds)||s.seconds<=0||s.to_m-s.from_m!==s.distance_m||s.distance_m<=0)return false;end=s.to_m;sum+=s.seconds;return Math.abs(sum-s.cumulative_seconds)<0.051;});
  if(!valid||end!==z.distance_m||Math.abs(sum-z.winner_time_seconds)>0.051||!date(e.raceDate)||e.raceDate>=input.race_date||z.sourceRef!==narResult(e)||tm(z.sourceCheckedAt)===null||tm(z.sourceCheckedAt)>asof||z.individual_horse_sectionals!==false||z.market_used!==false||z.target_result_used!==false||z.finish_time_reconciled!==true){held.push({index,reason:'LAP_BINDING'});continue;}
  laps.push({event:e,segments:seg,root:{snapshotId:input.id,index,sourceRef:z.sourceRef,observedAt:z.sourceCheckedAt},tier:'STORED_RACE_LEVEL_LAP_ONLY'});
 }
 return {circuit:'LOCAL',accepted,peers,laps,held,formalAdmission:false,originalReplay:false};
}

export function bindJraArchive(input,history){
 const cutoff=tm(input.cutoff),events=[],held=[],own=[],seen=new Set();
 guard(cutoff!==null&&date(input.targetDate),'ARCHIVE_TARGET');
 for(const e of input.events){
  const m=jraResult.exec('/JRADB/accessS.html?CNAME='+e.source_ref);
  const event=m?'JRA-'+m[1]+'-'+m[6]+'-'+m[5]:null;
  if(!m||!date(e.race_date)||e.race_date>=input.targetDate||m[6]!==e.race_date.replaceAll('-','')||jraTracks[m[1]]!==e.track||Number(m[5])!==e.race_no||[e.created_at,e.updated_at,e.source_checked_at].some(t=>tm(t)===null||tm(t)>cutoff)||seen.has(event)){held.push({event,reason:'EVENT_BINDING'});continue;}
  seen.add(event);
  const rows=e.rows??[],numbers=new Set(),ids=new Set(),clean=[],unboundRows=[];let invalid=0;
  for(const h of rows){
   const id=jraHorse.exec(h.horse_ref??'')?.[1];
   if(!id||!int(h.horse_no,1,24)||numbers.has(h.horse_no)||ids.has(id)||h.record_role!=='full_runner'||[h.created_at,h.updated_at].some(t=>tm(t)===null||tm(t)>cutoff)){invalid++;unboundRows.push({rowId:h.id,pastNo:h.horse_no,sourceRef:e.source_ref,observedAt:h.updated_at,reason:'IDENTITY_OR_ROW_BOUNDARY_HELD'});continue;}
   numbers.add(h.horse_no);ids.add(id);
   const root={event,sourceRef:e.source_ref,archiveRaceId:e.id,rowId:h.id,horseId:id,observedAt:h.updated_at};
   clean.push({horseId:id,pastNo:h.horse_no,root,facts:sourceFacts(h,{finish:'finish',clock:'time_raw',marginLiteral:'margin',final600:'final3f',ordinalUnlabeled:'corner_positions',draw:'draw',weight:'weight_carried',bodyWeight:'body_weight',bodyWeightDelta:'body_weight_diff',equipment:'equipment',sex_age:'sex_age',jockeyRef:'jockey_ref',trainerRef:'trainer_ref'},root,'STORED_ARCHIVE_ROW_NOT_ORIGINAL')});
  }
  const full=e.full_field===true&&e.archive_complete===true&&invalid===0&&int(e.field_size,1,24)&&clean.length===e.field_size&&clean.every(h=>int(Number(h.facts.finish?.value),1,e.field_size));
  const roots={event,archiveRaceId:e.id,sourceRef:e.source_ref,observedAt:e.source_checked_at};
  const context=sourceFacts(e,{distance:'distance',surface:'surface',going:'going',direction:'turn',classLiteral:'class_name',reportedFieldSize:'field_size',lap:'halon_times',courseText:'course_text',courseLayout:'course_layout'},roots,'STORED_ARCHIVE_CONTEXT');
  const record={event,rows:clean,context,recordedFullFinishField:full,explicitStarterClassification:false,reportedFullField:e.full_field,reportedArchiveComplete:e.archive_complete,rawRowCount:rows.length,unboundRows,invalid};
  events.push(record);
  for(const x of history.accepted.filter(h=>h.event===event)){const matched=clean.filter(h=>h.horseId===x.horseId&&h.pastNo===x.pastNo);if(matched.length===1)own.push({currentNo:x.currentNo,horseId:x.horseId,event,pastNo:x.pastNo,matched:matched[0],recordedFullFinishField:full});}
 }
 return {events,own,held};
}
// Non-authority boundary. Each observation retains its source tier and key.
export function makeSupply({target,roster,history,archive,local,cancelled=[],conflicts=[]}){
 guard(date(target?.raceDate)&&tm(target.cutoff)!==null&&tm(target.post)!==null&&tm(target.cutoff)<tm(target.post),'SUPPLY_TARGET');
 guard(Array.isArray(roster)&&roster.length>0&&new Set(roster.map(h=>h.no)).size===roster.length&&new Set(roster.filter(h=>h.horseId).map(h=>h.horseId)).size===roster.filter(h=>h.horseId).length,'SUPPLY_ROSTER');
 const byNo=new Map(roster.map(h=>[h.no,h])),held=[],rows=[];
 for(const x of history??[]){const h=byNo.get(x.currentNo);if(!h||!h.horseId||h.horseId!==x.horseId){held.push({no:x.currentNo,event:x.event,reason:'CURRENT_HORSE_ID_UNBOUND'});continue;}rows.push(x);}
 const pack={schema:'REBORN2_STAGE1_STORED_FACT_SUPPLY_1',scope:'PRIVATE_PARTIAL_CANDIDATE_NOT_NATIVE',target,roster,history:rows,archive:archive??[],local:local??null,cancelled,conflicts,held,formalAdmission:false,publicationAllowed:false,persistenceAllowed:false};
 return {...pack,digest:hashText(canonical(pack))};
}
