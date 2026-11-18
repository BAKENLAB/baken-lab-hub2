/** Existing 1.6 pre-freeze save integrity guard. It does not score, select EYE, use market/results, or modify frozen predictions. */
export function assertLocal16EvidenceHandoffForSave({protocol_version,payload}={}){
 if(protocol_version!=="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013")return true;
 const fail=c=>{throw Error("LOCAL_16_EVIDENCE_"+c)};
 const all=payload?.runners, audit=payload?.audit, official=audit?.official_past_content_audit, runnerAudit=audit?.runner_evidence_audit;
 if(!Array.isArray(all)||!all.length||!Array.isArray(runnerAudit)||!Array.isArray(official?.per_runner)||official.status!=="VERIFIED_WHOLE_FIELD_FACTS")fail("FULL_FIELD_REQUIRED");
 const active=all.filter(x=>x?.status==="ACTIVE");
 if(active.length!==all.length||active.length!==official.per_runner.length||active.length!==runnerAudit.length||new Set(active.map(x=>x.horse_no)).size!==active.length)fail("ROSTER_MISMATCH");
 const reviewed=new Set();
 for(const x of active){
  const content=official.per_runner.filter(y=>y?.horse_no===x.horse_no), evidence=runnerAudit.filter(y=>y?.horse_no===x.horse_no);
  if(!Number.isInteger(x.horse_no)||typeof x.horse_name!=="string"||!x.horse_name||!Number.isInteger(x.rank)||!Number.isInteger(x.score)||content.length!==1||evidence.length!==1||content[0].rank!==x.rank||content[0].score!==x.score)fail("SCORE_AUDIT_MISMATCH");
  if(reviewed.has(x.horse_no))fail("DUPLICATE_HORSE");
  reviewed.add(x.horse_no);
  const refs=content[0].evidence_refs, e=evidence[0];
  if(!Array.isArray(refs)||typeof content[0].assessment!=="string"||content[0].assessment.trim().length<8||typeof e.evidence_summary!=="string"||e.evidence_summary.trim().length<8||!Number.isInteger(e.recent_runs_checked)||e.recent_runs_checked<0||e.recent_runs_checked>5)fail("MISSING_RUNNER_ASSESSMENT");
  const prefix="COMPACT_V1.runners[horse_no="+x.horse_no+"].recent_runs[";
  const seen=new Set();
  for(const ref of refs){
   if(typeof ref!=="string"||!ref.startsWith(prefix)||!ref.endsWith("]"))fail("INVALID_RUN_REFERENCE");
   const n=ref.slice(prefix.length,-1);
   if(!/^[0-4]$/.test(n)||Number(n)>=e.recent_runs_checked||seen.has(n))fail("INVALID_RUN_REFERENCE");
   seen.add(n);
  }
  if(e.recent_runs_checked>0&&!refs.length)fail("MISSING_RUN_REFERENCES");
 }
 for(const key of ["verified_corner_runs","head_to_head_count"]){
  const value=official[key];
  if(value!==undefined&&value!==null&&(!Number.isInteger(value)||value<0))fail("INVALID_COVERAGE_COUNTERS");
 }
 return true;
}
