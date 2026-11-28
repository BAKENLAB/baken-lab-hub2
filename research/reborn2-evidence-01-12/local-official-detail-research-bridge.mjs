// REBORN 2: retrospective research bridge for manually observed public official index facts. Not a live network adapter. No market, grading, writes, or scoring authorization. Do not pass target outcome or treat later retrieval as a pre-start snapshot.
export function bindLocalResearchDetail({targetDate,asOf,observedAt,witness,detail}){
 const iso=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 const stamp=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
 const url=x=>{const m=/^https:\/\/(?:www|sp)\.keiba\.go\.jp(\/[A-Za-z0-9_/.]+)\?([A-Za-z0-9_%=&]+)$/.exec(x);if(!m)throw Error("SOURCE_NOT_OFFICIAL");const q={};for(const part of m[2].split("&")){const kv=part.split("=");if(kv.length!==2||!kv[0]||!kv[1]||Object.hasOwn(q,kv[0])||!["k_babaCode","k_raceDate","k_raceNo","k_lineageLoginCode","k_activeCode"].includes(kv[0]))throw Error("SOURCE_QUERY");q[kv[0]]=decodeURIComponent(kv[1]);}return{path:m[1],q}};
 if(!iso(targetDate)||stamp(asOf)===null||stamp(observedAt)===null)throw Error("BAD_TIME");
 const r=witness.prior;
 if(!r||!iso(r.raceDate)||r.raceDate>=targetDate||witness.name!==detail.name||Number(witness.prior_no)!==detail.prior_no||r.raceDate!==detail.date||r.track!==detail.track||r.raceNo!==detail.race_no)throw Error("PRIOR_IDENTITY_MISMATCH");
 const u=url(detail.source),w=url(witness.source_ref),p=url(witness.profile);
 if(detail.kind==="RESULT_INDEX"){
  if(!["/KeibaWeb/TodayRaceInfo/RaceMarkTable","/KeibaWeb_IPAT/TodayRaceInfo/RaceMarkTable_ipat"].includes(u.path)||["k_babaCode","k_raceDate","k_raceNo"].some(k=>!u.q[k]||u.q[k]!==w.q[k]))throw Error("RESULT_SOURCE_MISMATCH");
 }else if(detail.kind==="PROFILE_INDEX"){
  if(!["/KeibaWeb/DataRoom/HorseMarkInfo","/KeibaWeb_IPAT/DataRoom/HorseMarkInfo_ipat"].includes(u.path)||!u.q.k_lineageLoginCode||u.q.k_lineageLoginCode!==p.q.k_lineageLoginCode)throw Error("PROFILE_SOURCE_MISMATCH");
 }else throw Error("SOURCE_KIND");
 if(!Number.isInteger(detail.finish)||detail.finish<1||detail.finish>24||typeof detail.clock!=="string"||!/^\d+:[0-5]\d\.\d$/.test(detail.clock)||typeof detail.final3f!=="number"||!Number.isFinite(detail.final3f)||detail.final3f<=0)throw Error("INVALID_FACT");
 const [min,sec]=detail.clock.split(":");const elapsed=Number(min)*60+Number(sec);
 if(detail.final3f>=elapsed)throw Error("INVALID_FINAL3F");
 const corners=Array.isArray(witness.corners)?witness.corners.map(x=>x.position):[];
 if(corners.some(x=>!Number.isInteger(x)||x<1||x>24))throw Error("INVALID_CORNER");
 if(detail.corners&&JSON.stringify(detail.corners)!==JSON.stringify(corners))throw Error("CORNER_CONFLICT");
 return {current_no:witness.no,race_date:r.raceDate,track:r.track,race_no:r.raceNo,prior_no:detail.prior_no,finish:detail.finish,elapsed_seconds:elapsed,final3f:detail.final3f,corners,source_ref:detail.source,identity_witness_ref:witness.profile,observation_kind:detail.kind,observed_at:observedAt,as_of:asOf,asof_status:stamp(observedAt)>stamp(asOf)?"RETROSPECTIVE_ONLY":"INDEX_NOT_SUFFICIENT_FOR_LIVE_EVIDENCE",status:"RESEARCH_CANDIDATE",scoring_authorized:false};
}
export function validateRaceLapGrid({distance,segments,winnerSeconds}){
 if(!Number.isInteger(distance)||distance<600||distance>4000||!Array.isArray(segments)||segments.length!==Math.ceil(distance/200)||typeof winnerSeconds!=="number"||!Number.isFinite(winnerSeconds)||winnerSeconds<=0)throw Error("LAP_GRID");
 const ticks=x=>typeof x==="number"&&Number.isFinite(x)&&x>0&&Math.abs(x*10-Math.round(x*10))<1e-7?Math.round(x*10):null;
 const first=distance-200*(segments.length-1);let sum=0,at=0;
 const out=segments.map((x,i)=>{const n=ticks(x);if(n===null)throw Error("LAP_VALUE");const m=i===0?first:200;const from=at;at+=m;sum+=n;return{from_m:from,to_m:at,distance_m:m,seconds:n/10,cumulative_seconds:sum/10}});
 if(ticks(winnerSeconds)!==sum)throw Error("LAP_CLOCK_MISMATCH");
 return {distance_m:distance,segments:out,winner_seconds:sum/10,individual_horse_sectionals:false,status:"RECONCILED_RACE_LEVEL_CANDIDATE",scoring_authorized:false};
}
