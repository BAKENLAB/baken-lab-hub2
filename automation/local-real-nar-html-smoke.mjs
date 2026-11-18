/**
 * ONE real NAR public historical result-page read. Smoke diagnostic ONLY.
 * No current race, no prediction, no CLAIM, no database, no credentials,
 * and no publication of horse results. Zero retries, fixed page.
 */
import {load} from 'npm:cheerio@1.0.0';
import {extractNarPriorCornerHtml,extractOfficialRaceLapFields} from '../supabase/functions/lab-local-corner-preclaim/automation/nar-prior-corners-official-source.mjs';
import {validateOfficialNarRaceLaps} from './nar-official-lap-evidence.mjs';
const past={raceDate:'2026-11-12',track:'園田',raceNo:2};
const url='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=27&k_raceDate=2026%2F11%2F12&k_raceNo=2';
let result;
try{
 const response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000),
  headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'ja-JP,ja;q=0.9'}});
 if(!response.ok)throw Error('HTTP_'+response.status);
 const length=Number(response.headers.get('content-length')??0);
 if(length>262144)throw Error('SOURCE_SIZE_LIMIT');
 const buf=await response.arrayBuffer();
 if(buf.byteLength>262144)throw Error('SOURCE_SIZE_LIMIT');
 const html=new TextDecoder().decode(buf);
 const corner=extractNarPriorCornerHtml(html,past);
 const raw=extractOfficialRaceLapFields(load(html));
 if(!raw)throw Error('OFFICIAL_LAP_HTML_NOT_MATCHED');
 // Diagnostic's synthetic later cutoff is never saved or used for live races.
 const checkedAt=new Date().toISOString();
 const validated=validateOfficialNarRaceLaps({past,targetDate:'2026-12-01',
  targetPostTime:'2026-12-01T12:00:00+09:00',sourceUrl:url,sourceCheckedAt:checkedAt,
  ...raw});
 result={status:'PASS',diagnostic_only:true,public_historical_page:true,
  source_date:past.raceDate,track:past.track,race:past.raceNo,
  verified_horse_numbers:corner.knownHorseNos.length,
  verified_stable_horse_ids:corner.officialFinishers.length,
  verified_corner_rows:corner.cornerRows.length,
  race_lap_segments:validated.segment_count,
  clock_reconciled:validated.finish_time_reconciled,
  horse_specific_splits:false,live_claim_or_save:false};
}catch(e){
 result={status:'NOT_VERIFIED',diagnostic_only:true,
  source_date:past.raceDate,track:past.track,race:past.raceNo,
  reason:String(e?.message||e).slice(0,120),
  live_claim_or_save:false};
}
console.log('LOCAL_REAL_NAR_HTML_SMOKE '+JSON.stringify(result));
if(result.status!=='PASS')Deno.exit(1);
