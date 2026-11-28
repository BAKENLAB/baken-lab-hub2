// Work17: bounded, read-only stored-fact acquisition adapters. Not native approval.
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
export function adaptLocalSnapshot(input){
 const pk=input.evidence?.packet,asof=tm(input.as_of),captured=tm(input.captured_at),post=tm(input.official_post_time);
 guard(input.id==='c66d8b6a-fd27-407b-b750-6650d5ab4269'&&input.payload_digest==='67d5ae4a8c358e4c53c19ac24711b8b5b1fbee3e2609ce946583875aaa6c03f2'&&input.evidence?.schemaVersion==='LOCAL_OFFICIAL_CORNERS_1'&&input.digestVerified===true,'LOCAL_SNAPSHOT_PIN');
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
