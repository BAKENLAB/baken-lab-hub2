// Verified as-of JRA official past-run content handoff. No market, writes or FROZEN mutation.
export function restoreJraClaimedRunDetails(ctx){
 const refuse=reason=>{throw Error("JRA_ASOF_DETAIL_HANDOFF_"+reason)};
 const raceDate=ctx?.race?.race_date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raceDate??""))refuse("RACE_DATE");
 const source=ctx?.runner_history,detail=ctx?.runner_content_evidence;
 if(!Array.isArray(source)||!Array.isArray(detail)||source.length<6||detail.length!==source.length)refuse("FIELD_COVERAGE");
 const byNo=new Map();
 for(const h of detail){
  if(!Number.isInteger(h.horse_no)||byNo.has(h.horse_no)||typeof h.horse_name!=="string")refuse("CONTENT_ID");
  byNo.set(h.horse_no,h);
 }
 const numbers=new Set(),stats={official_past_runs:0,corners:0,final3f:0,going:0,verified_archive_laps:0};
 const enriched=source.map(h=>{
  if(numbers.has(h.horse_no))refuse("DUPLICATE");numbers.add(h.horse_no);
  const rich=byNo.get(h.horse_no);
  if(!rich||rich.horse_name.normalize("NFKC").trim()!==String(h.horse_name).normalize("NFKC").trim())refuse("HORSE_NAME");
  if(!Array.isArray(h.past_runs)||!Array.isArray(rich.history)||h.past_runs.length!==rich.history.length)refuse("RUN_COVERAGE");
  const past_runs=h.past_runs.map((p,i)=>{
   const a=rich.history[i],close=(v,w)=>(v==null&&w==null)||(typeof v==="number"&&typeof w==="number"&&Math.abs(v-w)<0.00001);
   const isLive=a?.source_kind==="LIVE"&&a?.raw_history_match_count===1;
   const isArchive=a?.source_kind==="DB"&&a?.detail_available===true&&a?.archive_full_field===true&&a?.archive_match_count===1;
   if(!a||!(isLive||isArchive)||a.base_facts_available!==true||
      p.race_date!==a.prior_date||!(p.race_date<raceDate)||
      p.track!==a.prior_track||p.surface!==a.prior_surface||p.distance!==a.prior_distance||
      p.finish!==a.finish||!close(p.margin_to_winner,a.margin_to_winner))refuse("RUN_IDENTITY");
   const v={...p};stats.official_past_runs++;
   const corners=Array.isArray(a.live_corner_positions)?a.live_corner_positions:(a.detail_available===true&&a.archive_match_count===1&&typeof a.corner_positions==="string"?a.corner_positions.trim().split(/\s+/).map(Number):null);
   if(Array.isArray(corners)&&corners.length>=2&&corners.length<=5&&
      corners.every(n=>Number.isInteger(n)&&n>=1&&n<=Math.max(2,a.field_size||24))&&
      (p.early_pos==null||p.early_pos===corners[0])){
      v.corner_positions=corners.slice();v.corner_source_kind="JRA_LIVE_VERIFIED_RUN_MATCH";stats.corners++;
   }
   if(typeof a.final3f==="number"&&Number.isFinite(a.final3f)&&a.final3f>=20&&a.final3f<=70&&
     ["VERIFIED_ARCHIVE","LIVE_PAST_RUN_FALLBACK"].includes(a.final3f_source)){
      v.final3f=a.final3f;v.final3f_source_kind=a.final3f_source;stats.final3f++;
   }
   const verifiedGoing=isLive?a.live_going:a.race_going;
   if(["良","稍重","重","不良"].includes(verifiedGoing)){
     v.going=verifiedGoing;stats.going++;
   }
   if(a.detail_available===true&&a.archive_match_count===1&&typeof a.race_halons==="string"&&
     /^\d{1,2}\.\d(?:\s*-\s*\d{1,2}\.\d)*$/.test(a.race_halons.trim())){
      v.official_race_halon_laps=a.race_halons;stats.verified_archive_laps++;
   }
   return v;
  });
  return {...h,past_runs};
 });
 if(enriched.length!==source.length||numbers.size!==source.length)refuse("RESULT_COVERAGE");
 return {...ctx,runner_history:enriched,source_evidence_handoff:{status:"JRA_LIVE_ASOF_RUNS_SOURCE_ALIGNED",version:"JRA_PRE_FROZEN_PAST_CONTENT_V1",...stats,market_used:false,target_result_used:false}};
};
