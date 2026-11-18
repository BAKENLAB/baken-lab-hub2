/**
 * One-shot, read-only public historical NAR identity continuity audit.
 * EXACT TWO past source pages, no current race/CLAIM, betting, or DB.
 * Prints aggregate overlap counts only (no horses/names or IDs).
 */
import {extractNarPriorCornerHtml} from '../supabase/functions/lab-local-corner-preclaim/automation/nar-prior-corners-official-source.mjs';
const years=['2026-11-05','2026-11-12'];
const makeUrl=d=>'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=27&k_raceDate='+encodeURIComponent(d.replaceAll('-','/'))+'&k_raceNo=2';
const page=async date=>{
 const response=await fetch(makeUrl(date),{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'text/html'}});
 if(!response.ok)throw Error('HTTP_'+response.status);
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength>262144)throw Error('SIZE_LIMIT');
 return extractNarPriorCornerHtml(new TextDecoder().decode(bytes),{raceDate:date,track:'園田',raceNo:2});
};
let report;
try{
 const [before,after]=await Promise.all(years.map(page));
 const ids=new Set(before.officialFinishers.map(x=>x.officialHorseId));
 const prior=new Map(before.officialFinishers.map(x=>[x.officialHorseId,x.finish]));
 let overlap=0,changedPlacings=0;
 for(const later of after.officialFinishers){
  if(!ids.has(later.officialHorseId))continue;
  overlap++;
  if(prior.get(later.officialHorseId)!==later.finish)changedPlacings++;
 }
 report={status:'PASS',diagnostic_only:true,one_off_public_pages:2,
  source_days:years,before_stable_id_count:ids.size,after_stable_id_count:after.officialFinishers.length,
  matched_official_horse_ids:overlap,matched_with_different_finish:changedPlacings,
  verified_followup_strength:false,claimed_prediction_saved:false};
}catch(e){report={status:'UNAVAILABLE',diagnostic_only:true,reason:String(e?.message||e).slice(0,90),claimed_prediction_saved:false};}
console.log('LOCAL_NAR_ID_CONTINUITY '+JSON.stringify(report));
if(report.status!=='PASS')Deno.exit(1);
