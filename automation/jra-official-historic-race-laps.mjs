/**
 * BAKEN LAB — JRA official historic result race-lap parser.
 * Pure analysis of a separately verified official response, not an HTTP fetch.
 *
 * JRA official guide: most splits are 200m; 1700m starts with a 100m
 * segment and 1150m with a 150m segment. Never pretend the first three
 * splits of these race lengths equal the initial 600m.
 *
 * No target outcome, market, rank, CLAIM or save changes.
 */
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const parsed=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const allowedHost=new Set(['www.jra.go.jp','app.jra.jp','sp.jra.jp','own.jra.jp']);
function officialUrl(src){
 if(typeof src!=='string')return null;
 try{
  const u=new URL(src,'https://www.jra.go.jp');
  const c=u.searchParams.get('CNAME');
  if(!allowedHost.has(u.hostname)||u.protocol!=='https:'||
     u.pathname!=='/JRADB/accessS.html'||u.username||u.password||u.hash||
     u.searchParams.size!==1||!/^sw?[0-9A-Za-z/]{12,100}$/.test(c??''))
    return null;
  return {url:u.href,cname:c};
 }catch{return null;}
}
const num=x=>Math.round(x*10)/10;
const numericSplits=s=>{
 const m=s.match(/[0-9]{1,2}\.[0-9](?:\s*[-－―–]\s*[0-9]{1,2}\.[0-9])*/);
 if(!m)return null;
 const parts=m[0].split(/\s*[-－―–]\s*/).map(Number);
 return parts.every(x=>x>=8&&x<=30)?parts:null;
};
const dateInJapanese=s=>{
 const [year,month,day]=s.split('-').map(Number);
 return new RegExp(String(year)+'年\\s*0?'+month+'月\\s*0?'+day+'日');
};
export function parseJraOfficialHistoricLaps({targetRace,priorRace,source,clock=()=>Date.now()}={}){
 const absent=(status)=>({status,verified:false,market_used:false,
  target_race_result_used:false,rank_effect:'NONE',save_gate_effect:'NONE'});
 const now=clock(),post=parsed(targetRace?.postTime),checked=parsed(source?.checkedAt);
 if(!validDate(targetRace?.raceDate)||!validDate(priorRace?.raceDate)||
    priorRace.raceDate>=targetRace.raceDate||!priorRace.track||
    !Number.isInteger(priorRace.raceNo)||priorRace.raceNo<1||priorRace.raceNo>12||
    !Number.isInteger(priorRace.distance)||priorRace.distance<1000||
    priorRace.distance>4500||!['芝','ダート'].includes(priorRace.surface)||
    post===null||!Number.isFinite(now)||now>=post||checked===null||
    checked>now||checked>=post||now-checked>86400000)
  return absent('UNVERIFIED_AS_OF_OR_RACE');
 const expected=officialUrl(priorRace.sourceRef),actual=officialUrl(source?.url);
 if(!expected||!actual||expected.cname!==actual.cname||
    source?.verifiedOfficialResponse!==true||
    typeof source.bodyText!=='string'||source.bodyText.length<100||
    source.bodyText.length>200000)
  return absent('UNVERIFIED_RESULT_SOURCE');
 const body=source.bodyText.normalize('NFKC');
 const japaneseDate=dateInJapanese(priorRace.raceDate);
 const rx=new RegExp('(^|[^0-9])0?'+priorRace.raceNo+'\\s*R(?=[^0-9]|$)','i');
 if(!japaneseDate.test(body)||!body.includes(priorRace.track)||!rx.test(body)||
    !body.includes('ハロンタイム'))
  return absent('OFFICIAL_RACE_IDENTITY_MISMATCH');
 const marker=[...body.matchAll(/ハロンタイム/g)];
 if(marker.length!==1)return absent('LAP_ROW_NOT_UNIQUE');
 const start=marker[0].index+marker[0][0].length;
 const tail=body.slice(start,start+250).split(/(?:上り|上がり|コーナー通過|払戻)/)[0];
 const laps=numericSplits(tail);
 if(!laps)return absent('LAP_VALUES_INVALID');
 const expectedSegments=Math.ceil(priorRace.distance/200);
 if(laps.length!==expectedSegments)
  return absent('DISTANCE_SPLIT_COUNT_MISMATCH');
 const firstLength=priorRace.distance%200||200;
 const lengths=[firstLength,...Array(laps.length-1).fill(200)];
 const sum=x=>num(x.reduce((a,b)=>a+b,0));
 const initial3Distance=sum(lengths.slice(0,3));
 const final600=sum(laps.slice(-3));
 const first600=firstLength===200?sum(laps.slice(0,3)):null;
 return {
  status:'OFFICIAL_RACE_LAPS_VERIFIED',verified:true,
  source_ref:actual.url,source_checked_at:source.checkedAt,
  race_date:priorRace.raceDate,track:priorRace.track,race_no:priorRace.raceNo,
  surface:priorRace.surface,distance:priorRace.distance,
  lap_seconds:[...laps],segment_distances_m:lengths,
  first_recorded_split_m:firstLength,initial_three_splits_cover_m:initial3Distance,
  initial_three_splits_seconds:sum(laps.slice(0,3)),
  first_600m_seconds:first600,last_600m_seconds:final600,
  pace_classification:'UNDETERMINED_WITHOUT_COHORT_REFERENCE',
  caution:firstLength===200?null:'INITIAL_600M_NOT_COMPUTABLE_FROM_RECORDED_BOUNDARIES',
  market_used:false,target_race_result_used:false,rank_effect:'NONE',save_gate_effect:'NONE'
 };
}
