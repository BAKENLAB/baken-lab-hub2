/** Research-only profile acquisition adapter for existing createNarOfficialReader.
 * No endpoint, schedule, store, claim, production changes or score/rank authority.
 * Requires authenticated caller and officially verified current roster. All source reads
 * are delegated to the official reader; result URLs are plans, not fetched evidence.
 * Unit checks used a synthetic reader, not live official network requests.
 */
export async function collectLocalProfilePlanResearch({race,cutoff,officialReader,planBuilder,assertAuthorized,clock=()=>Date.now(),controllerFactory=()=>new AbortController(),operationMs=30000,perHorseMs=2000,cardMs=5000,maxPages=40}={}){
 const codes={"盛岡":"10","水沢":"11","浦和":"18","船橋":"19","大井":"20","川崎":"21","金沢":"22","笠松":"23","名古屋":"24","園田":"27","姫路":"28","高知":"31","佐賀":"32","門別":"36"};
 const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 const norm=x=>String(x??"").normalize("NFKC").replace(/\s+/g,"");
 const horseId=ref=>String(ref??"").match(/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=(\d{1,30})$/)?.[1]??null;
 const start=clock(),post=Date.parse(race?.post_time),cut=Date.parse(cutoff);
 if(typeof assertAuthorized!=="function"||typeof planBuilder!=="function"||typeof officialReader?.readRace!=="function"||typeof officialReader?.readHistory!=="function"||race?.circuit!=="LOCAL"||race.field_status!=="READY"||!["PENDING","RETRY"].includes(race.prediction_status)||!validDate(race.race_date)||race.race_date!==new Date(start+32400000).toISOString().slice(0,10)||!codes[race.track]||!Number.isInteger(race.race_no)||race.race_no<1||race.race_no>14||!Number.isFinite(post)||!Number.isFinite(cut)||cut>=post||start>=Math.min(cut,post-300000)||/新馬|初出走|メイクデビュー|ゴールデンデビュー/.test(String(race.race_name??""))||!Number.isInteger(operationMs)||operationMs<100||operationMs>60000||!Number.isInteger(perHorseMs)||perHorseMs<10||perHorseMs>10000||!Number.isInteger(cardMs)||cardMs<10||cardMs>10000)throw Error("INVALID_PRE_RACE_RESEARCH_REQUEST");
 // This is a caller-injected authorization gate, not an endpoint.
 await assertAuthorized({race_key:[race.race_date,race.track,race.race_no],purpose:"READ_ONLY_RESEARCH"});
 const stop=Math.min(start+operationMs,cut,post-300000);
 async function bounded(fn,ms){
  const limit=Math.min(ms,stop-clock());if(limit<=0)throw Error("OPERATION_BUDGET");
  const ctrl=controllerFactory();let timer;
  try{return await Promise.race([Promise.resolve().then(()=>fn(ctrl.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{ctrl.abort();reject(Error("SOURCE_TIMEOUT"));},limit)})]);}
  finally{clearTimeout(timer);ctrl.abort();}
 }
 const base={status:"NOT_READY",plan:null,profile_reports:[],rank_authorized:false,production_connected:false,market_used:false};
 let card;try{card=await bounded(signal=>officialReader.readRace(race,{limit:5},signal),cardMs);}catch{return {...base,status:"CARD_UNAVAILABLE"}}
 const cardUrl=`https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=${codes[race.track]}&k_raceDate=${race.race_date.replaceAll("-","%2F")}&k_raceNo=${race.race_no}`;
 const expected=race.field_payload?.runners,actual=card?.runners,ct=Date.parse(card?.fetched_at);
 const validRoster=rows=>Array.isArray(rows)&&rows.length>=2&&rows.length<=20&&rows.every(h=>Number.isInteger(h.horse_no)&&h.horse_no>=1&&h.horse_no<=24&&norm(h.horse_name)&&["ACTIVE","CANCELLED","EXCLUDED"].includes(h.status))&&new Set(rows.map(h=>h.horse_no)).size===rows.length;
 if(clock()>=stop||card?.source!=="NAR_OFFICIAL_DEBA"||card.source_ref!==cardUrl||card.circuit!=="LOCAL"||card.race_date!==race.race_date||card.track!==race.track||card.race_no!==race.race_no||!Number.isFinite(ct)||ct>clock()||clock()-ct>60000||!validRoster(expected)||!validRoster(actual)||expected.length!==actual.length||actual.some(h=>!expected.some(r=>r.horse_no===h.horse_no&&norm(r.horse_name)===norm(h.horse_name)&&r.status===h.status)))return {...base,status:"CARD_OR_ROSTER_MISMATCH"};
 const active=actual.filter(h=>h.status==="ACTIVE"),roster=active.map(h=>({no:h.horse_no,name:h.horse_name})),reports=[],witnesses=[],ids=new Map();
 if(active.length<2)return {...base,status:"INSUFFICIENT_ACTIVE"};
 for(const h of active){const ref=h.horse_link_evidence?.horse_ref,id=horseId(ref);if(id&&h.horse_link_evidence.horse_no===h.horse_no&&h.horse_link_evidence.deba_source_ref===cardUrl&&Array.isArray(h.identity_refs)&&h.identity_refs.length===1&&h.identity_refs[0]===ref){const list=ids.get(id)??[];list.push(h.horse_no);ids.set(id,list)}}
 for(const h of active){
  const ref=h.horse_link_evidence?.horse_ref,id=horseId(ref);
  const report={horse_no:h.horse_no,official_id_observed:!!(id&&ids.get(id)?.includes(h.horse_no)),verified_profile_runs:0,local_result_candidates:0,central_or_unsupported_runs:0};
  if(!report.official_id_observed){reports.push({...report,status:"CARD_ID_MISSING_OR_UNSUPPORTED"});continue;}
  if(ids.get(id).length!==1){reports.push({...report,status:"CARD_ID_CONFLICT"});continue;}
  if(clock()>=stop){reports.push({...report,status:"SKIPPED_BUDGET"});continue;}
  let rows;try{rows=await bounded(signal=>officialReader.readHistory(h,{race,before:race.race_date,limit:5},signal),perHorseMs)}catch{reports.push({...report,status:"PROFILE_UNAVAILABLE"});continue;}
  const observed=clock();if(observed>=stop){reports.push({...report,status:"SKIPPED_BUDGET"});continue;}
  if(!Array.isArray(rows)||rows.length>5){reports.push({...report,status:"PROFILE_SCHEMA_MISMATCH"});continue;}
  const valid=rows.every(r=>r?.source==="NAR_OFFICIAL_RESCUE"&&r.horse_ref===ref&&r.source_ref===ref&&norm(r.horse_name)===norm(h.horse_name)&&validDate(r.race_date)&&r.race_date<race.race_date&&Number.isInteger(r.race_no)&&r.race_no>=1&&r.race_no<=14&&Number.isInteger(r.horse_no)&&r.horse_no>=1&&r.horse_no<=24);
  const days=new Set(rows.map(r=>r?.race_date));
  if(!valid||days.size!==rows.length){reports.push({...report,status:"PROFILE_ID_OR_DATE_CONFLICT"});continue;}
  report.verified_profile_runs=rows.length;
  for(const r of rows){
   if(!codes[r.track]){report.central_or_unsupported_runs++;continue;}
   const url=`https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=${codes[r.track]}&k_raceDate=${r.race_date.replaceAll("-","%2F")}&k_raceNo=${r.race_no}`;
   // 'source' is the canonical PLANNED result URL; 'checked' is the profile read time,
   // not a result-page observation. The resolver must independently read and verify results.
   witnesses.push({no:h.horse_no,name:h.horse_name,ref,past:{raceDate:r.race_date,track:r.track,raceNo:r.race_no},past_no:r.horse_no,source:url,checked:new Date(observed).toISOString(),identity_kind:"OFFICIAL_HORSE_REF"});
   report.local_result_candidates++;
  }
  reports.push({...report,status:rows.length?"PROFILE_WITNESSES_PRESENT":"NO_VERIFIED_PROFILE_RUNS"});
 }
 const captured=clock();if(captured>=cut||captured>=post)return {...base,status:"CUTOFF_ELAPSED",profile_reports:reports};
 const target={date:race.race_date,track:race.track,race:race.race_no,captured:new Date(captured).toISOString(),cutoff,post:race.post_time};
 const plan=planBuilder({target,roster,evidence:witnesses,maxPages});
 return {...base,status:"PROFILE_PLAN_ONLY",plan:{...plan,witness_origin:"OFFICIAL_PROFILE_READ_NOT_RESULT_OBSERVATION",result_pages_observed:0},profile_reports:reports,coverage:{active:active.length,unique_ids:[...ids.values()].filter(l=>l.length===1).length,profile_heads:reports.filter(r=>r.verified_profile_runs>0).length,profile_runs:reports.reduce((s,r)=>s+r.verified_profile_runs,0),local_candidates:witnesses.length,result_pages_observed:0}};
}
