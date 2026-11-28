// REBORN 2 research-only availability ledger; not a scorer or verifier. Records must come from separately audited source adapters; all values remain candidates. Individual sectionals never inferred.
export function routeAvailability({circuit,targetDate,roster,records}) {
 if(!["JRA","LOCAL"].includes(circuit)||!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)||!Array.isArray(roster)||!roster.length||!Array.isArray(records)||roster.some(n=>!Number.isInteger(n)||n<1||n>24)||new Set(roster).size!==roster.length)throw Error("BAD_ROSTER");
 const numeric=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x));
 const positive=x=>numeric(x)&&Number(x)>0;
 const nonnegative=x=>numeric(x)&&Number(x)>=0;
 const seen=new Set(),groups=new Map(roster.map(n=>[n,[]]));
 for(const r of records){
  if(!groups.has(r.current_no)||!/^\d{4}-\d{2}-\d{2}$/.test(r.race_date)||r.race_date>=targetDate||typeof r.track!=="string"||!r.track||!Number.isInteger(r.race_no)||r.race_no<1||r.race_no>14)throw Error("BAD_PRIOR_KEY");
  const key=JSON.stringify([r.current_no,r.race_date,r.track,r.race_no]);
  if(seen.has(key))throw Error("DUPLICATE_PRIOR_KEY");seen.add(key);
  const f={finish:positive(r.finish),clock:positive(r.elapsed_seconds),gapWinner:nonnegative(r.gap_winner),gapNext:nonnegative(r.gap_next),f3:positive(r.final3f),corners:Array.isArray(r.corners)&&r.corners.length>0&&r.corners.every(x=>Number.isInteger(x)&&x>=1&&x<=24),raceLaps:Array.isArray(r.race_laps)&&r.race_laps.length>0&&r.race_laps.every(positive),conditions:positive(r.distance)&&["芝","ダート"].includes(r.surface)&&typeof r.going==="string"&&r.going.length>0,incident:["REPORTED_LATE_START","REPORTED_INTERFERENCE"].includes(r.incident),individual:false};
  groups.get(r.current_no).push(f);
 }
 const per_runner=roster.slice().sort((a,b)=>a-b).map(no=>{
 const rows=groups.get(no),has=fn=>rows.some(fn);
 const state=(ok,type="MATERIAL_CANDIDATE")=>ok?type:"MISSING";
 const items={
 "01":state(has(x=>x.finish&&x.clock&&x.conditions),"DERIVED_PENDING"),
 "02":state(has(x=>x.finish)),
 "03":state(has(x=>x.gapWinner)),
 "04":state(has(x=>x.gapNext)),
 "05":state(has(x=>x.clock&&x.conditions),"BENCHMARK_PENDING"),
 "06":state(has(x=>x.f3)),
 "07":state(has(x=>x.raceLaps&&x.corners&&x.f3),"PROXY_CANDIDATE_ONLY"),
 "08":state(has(x=>x.raceLaps&&x.corners&&x.f3),"PROXY_CANDIDATE_ONLY"),
 "09":state(has(x=>x.incident),"REPORTED_INCIDENT_CANDIDATE"),
 "10":state(has(x=>x.corners),"PROXY_CANDIDATE_ONLY"),
 "11":state(has(x=>x.conditions&&x.raceLaps&&x.corners&&x.f3&&x.gapWinner),"DERIVED_PENDING"),
 "12":state(has(x=>x.finish&&x.conditions),"DERIVED_PENDING")
 };
 return {horse_no:no,prior_rows:rows.length,items};});
 const coverage=Object.fromEntries(Object.keys(per_runner[0].items).map(k=>[k,per_runner.filter(h=>h.items[k]!=="MISSING").length]));
 return {circuit,targetDate,roster_n:roster.length,per_runner,coverage,scoring_authorized:false,status:"RESEARCH_ONLY",individual_sectionals:"UNAVAILABLE_NOT_INFERRED"};
}
