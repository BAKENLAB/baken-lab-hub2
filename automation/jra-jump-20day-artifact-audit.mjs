// Read-only reconciliation of archived JRA official result evidence.
// Source artifact: isolated verified historical CI 2026-11-15; no network,
// result prediction, target-day results, production DB writes, or odds.
import {readFileSync,readdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";
const fail=m=>{throw Error("JUMP_ARCHIVE_"+m)};
const need=(x,m)=>{if(!x)fail(m)};
const clean=x=>String(x??"").normalize("NFKC").replace(/[\s△▲☆★◇]/g,"");
const canonical=v=>Array.isArray(v)?"["+v.map(canonical).join(",")+"]":v!==null&&typeof v==="object"?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}":JSON.stringify(v);
const sha=s=>createHash("sha256").update(s).digest("hex");
const root=process.argv[2];need(typeof root==="string","ARTIFACT_DIR");
const targets=JSON.parse(readFileSync("research/jump/targets-20261121-fukushima-4-5.json","utf8"));
need(targets.as_of==="2026-11-21"&&targets.entries.length===26,"TARGET_DATE");
need(new Set(targets.entries.map(x=>x.horse_id)).size===26&&targets.entries.every(x=>/^\d{10}$/.test(x.horse_id)),"TARGET_HORSE_IDS");
const idx=JSON.parse(readFileSync(join(root,"coverage-index.json"),"utf8"));
need(idx.complete===true&&idx.expected_days.length===20&&idx.days.length===20&&idx.failures.length===0,"COVERAGE_NOT_COMPLETE_FOR_DECLARED_DAYS");
need(idx.from==="2026-09-14"&&idx.to_exclusive==="2026-11-15","COVERAGE_SCOPE");
const runs=[];
for(const day of idx.days){
 need(idx.expected_days.includes(day.date)&&day.expected===day.verified,"DAY_COUNT");
 const doc=JSON.parse(readFileSync(join(root,day.file),"utf8"));
 need(doc.scope==="research-only"&&doc.asOf==="2026-11-15"&&doc.day.date===day.date&&doc.records.length===day.expected,"DAY_IDENTITY");
 for(const rec of doc.records){
  need(rec.key&&rec.result&&rec.digest===sha(canonical(rec.result)),"RECORD_DIGEST");
  const r=rec.result;
  need(r.race_date===day.date&&r.race_date<targets.as_of&&typeof r.jump==="boolean","ASOF_RESULT");
  if(!r.jump)continue;
  need(Array.isArray(r.rows)&&r.rows.every(x=>x.verified===true&&x.race_date===r.race_date&&x.source_ref===r.source_ref),"JUMP_ROWS");
  for(const x of r.rows)runs.push({...x,track:r.track,race_no:r.race_no});
 }
}
const named=targets.entries.map(t=>{
 const own=runs.filter(r=>r.horse_id===t.horse_id);
 const rides=runs.filter(r=>clean(r.jockey)===clean(t.jockey));
 return {race_no:t.race_no,horse_no:t.horse_no,horse_name:t.horse_name,
   verified_recent_horse_jump_runs:own.length,verified_recent_jockey_starts:rides.length,
   last_horse_jump_date:own.map(x=>x.race_date).sort().at(-1)??null,
   recent_source_refs:[...new Set(own.map(x=>x.source_ref))].slice(0,10)};
});
const report={
 status:"RESEARCH_ONLY_PARTIAL_CALENDAR",verified_days:idx.days.length,
 verified_races:idx.days.reduce((s,d)=>s+d.verified,0),
 verified_obstacle_races:idx.days.reduce((s,d)=>s+d.jump,0),
 verified_obstacle_runner_rows:runs.length,
 recent_horse_start_matches:named.reduce((s,x)=>s+x.verified_recent_horse_jump_runs,0),
 new_horse_starts:named.filter(x=>x.verified_recent_horse_jump_runs>0).length,
 still_missing_days:["2026-11-15","2026-11-16_to_2026-11-20_if_any_schedule"],
 complete_birth_to_asof_certified:false,complete_365day_jockey_certified:false,
 target_day_result_used:false,market_used:false,saved_forecast:false,
 targets:named
};
console.log("JUMP_20_DAY_AUDIT "+JSON.stringify(report));
