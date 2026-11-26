export function marketGate({target,roster,abilitySnapshot,marketRecords=[],researchTimingApproved=false}){
 const ts=x=>typeof x==="string"&&/(Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
 if(!abilitySnapshot||abilitySnapshot.race_id!==target.race_id||abilitySnapshot.cutoff!==target.cutoff||typeof abilitySnapshot.digest!=="string")throw Error("ABILITY_SNAPSHOT_MISMATCH");
 return roster.map(h=>{
  const a=abilitySnapshot.runners.find(x=>x.horse_no===h.horse_no&&x.horse_id===h.horse_id);
  const rows=marketRecords.filter(x=>x.horse_id===h.horse_id&&x.race_id===target.race_id);
  const r=rows.length===1?rows[0]:null;
  let status="HOLD";
  if(!a||a.ability_eligible!==true)status="ABILITY_UNAPPROVED_OR_INELIGIBLE";
  else if(!researchTimingApproved)status="TIMING_UNAPPROVED";
  else if(h.active!==true||!r||r.market!=="WIN"||r.source_verified!==true||!r.source_version||!/^https:\/\//.test(r.source_url??"")||!Number.isFinite(r.win_odds)||r.win_odds<=0||!(ts(r.published_at)<=ts(r.observed_at)&&ts(r.observed_at)<=ts(target.cutoff)&&ts(r.observed_at)<ts(target.started_at))||r.snapshot_version!==abilitySnapshot.market_snapshot_version)status="HOLD";
  else status=r.win_odds>=10?"RESEARCH_GATE_PASS":"RESEARCH_GATE_FAIL";
  return {horse_no:h.horse_no,horse_id:h.horse_id,status,ability_digest:abilitySnapshot.digest,public_eye:null,release_eligible:false};
 });
}
