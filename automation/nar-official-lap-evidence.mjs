/**
 * NAR official *race-level* sectionals. Not individual horse sectionals.
 * Strict exact URL, official winner time, segment count/spacing and pre-post observation.
 * No market, target result, scoring, CLAIM or database writes.
 */
const codes={'盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20','川崎':'21','金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28','高知':'31','佐賀':'32','門別':'36'};
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'));
const bad=c=>{throw Error('NAR_LAPS_'+c)};
const time=x=>typeof x==='string'?Date.parse(x):NaN;
const ticks=x=>/^\d{1,2}\.\d$/.test(String(x??'').trim())?Math.round(Number(x)*10):null;
const win=x=>{const m=String(x??'').match(/^(\d+):([0-5]\d)\.(\d)$/);return m?+m[1]*600+ +m[2]*10+ +m[3]:null};
const url=p=>{const u=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable');u.searchParams.set('k_babaCode',codes[p.track]);u.searchParams.set('k_raceDate',p.raceDate.replaceAll('-','/'));u.searchParams.set('k_raceNo',String(p.raceNo));return u.href};
export function validateOfficialNarRaceLaps({past,targetDate,targetPostTime,sourceUrl,sourceCheckedAt,distance,winnerTime,halonTimes}={}){
 if(!past||!date(past.raceDate)||!date(targetDate)||past.raceDate>=targetDate||!codes[past.track]||!Number.isInteger(past.raceNo)||past.raceNo<1||past.raceNo>14)bad('RACE_IDENTITY_INVALID');
 if(sourceUrl!==url(past))bad('SOURCE_MISMATCH');
 const obs=time(sourceCheckedAt),post=time(targetPostTime);
 if(!Number.isFinite(obs)||!Number.isFinite(post)||obs>=post||obs<Date.parse(past.raceDate+'T00:00:00+09:00'))bad('NOT_PROSPECTIVE');
 if(!Number.isInteger(distance)||distance<600||distance>4000||!Array.isArray(halonTimes)||halonTimes.length!==Math.ceil(distance/200)||halonTimes.length>20)bad('SECTION_GRID_INVALID');
 const first=distance-200*(halonTimes.length-1);if(first<1||first>200)bad('SECTION_GRID_INVALID');
 const winner=win(winnerTime);if(winner===null)bad('WINNER_TIME_INVALID');
 let total=0,from=0;const segments=[];
 for(let i=0;i<halonTimes.length;i++){
  const n=ticks(halonTimes[i]),meters=i===0?first:200;
  if(n===null||n<Math.max(1,Math.floor(meters*3/200)*10)||n>Math.ceil(meters*30/200)*10+10)bad('SECTION_VALUE_INVALID');
  total+=n;segments.push({from_m:from,to_m:from+meters,distance_m:meters,seconds:n/10,cumulative_seconds:total/10});from+=meters;
 }
 if(total!==winner)bad('SECTION_TOTAL_NOT_WINNER_TIME');
 return {schema:'LOCAL_OFFICIAL_RACE_LAPS_V1',status:'VERIFIED_RACE_LEVEL_LAPS',pastRace:{raceDate:past.raceDate,track:past.track,raceNo:past.raceNo},sourceRef:sourceUrl,sourceCheckedAt,distance_m:distance,winner_time_seconds:winner/10,segment_count:segments.length,segments,individual_horse_sectionals:false,finish_time_reconciled:true,observed_before_target_start:true,market_used:false,target_result_used:false,automatic_score_effect:0,rank_authorized:false};
}
export function checkStoredOfficialNarLaps(packet,{targetDate,targetPostTime,now}={}){
 if(packet?.status!=='VERIFIED_RACE_LEVEL_LAPS'||packet?.schema!=='LOCAL_OFFICIAL_RACE_LAPS_V1'||packet.individual_horse_sectionals!==false||packet.market_used!==false||packet.target_result_used!==false||packet.automatic_score_effect!==0||packet.rank_authorized!==false||packet.observed_before_target_start!==true||!Number.isFinite(now)||time(packet.sourceCheckedAt)>now||!Array.isArray(packet.segments)||packet.segment_count!==packet.segments.length)bad('STORED_ATTESTATION_INVALID');
 const tenth=Math.round(packet.winner_time_seconds*10);
 if(!Number.isInteger(tenth)||tenth<0)bad('STORED_ATTESTATION_INVALID');
 const replay=validateOfficialNarRaceLaps({past:packet.pastRace,targetDate,targetPostTime,sourceUrl:packet.sourceRef,sourceCheckedAt:packet.sourceCheckedAt,distance:packet.distance_m,winnerTime:Math.floor(tenth/600)+':'+String(Math.floor(tenth%600/10)).padStart(2,'0')+'.'+tenth%10,halonTimes:packet.segments.map(x=>x?.seconds)});
 if(JSON.stringify(packet.segments)!==JSON.stringify(replay.segments)||packet.winner_time_seconds!==replay.winner_time_seconds)bad('STORED_SEGMENTS_TAMPERED');
 return true;
}