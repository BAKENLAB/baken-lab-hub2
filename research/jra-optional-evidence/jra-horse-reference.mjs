/**
 * BAKEN LAB JRA: research-only horse identity reconciliation.
 * JRA accessU CNAME has source-mode/checksum variants.
 * Verify the common 10-digit horse code AND horse name, within the exact
 * historical race. Never invent an identity from name alone.
 */
export function jraHorseCode(ref) {
  if(typeof ref!=="string") return null;
  const m=ref.match(/(?:[?&])CNAME=pw01dud[01]0(\d{10})\/[0-9a-fA-F]{2}(?:&|$)/);
  return m?m[1]:null;
}

function sameName(a,b) {
  return typeof a==="string"&&typeof b==="string"
    &&a.trim().normalize("NFC")===b.trim().normalize("NFC");
}

/**
 * Match one known horse in ONE archived race.
 * archiveRunners must have stable race_date, track, horse_ref and horse_name.
 * Fail closed on mismatches, duplicates and missing race context.
 */
export function matchJraRunnerToArchive({
  liveHorseRef, liveHorseName, archiveRunners,
  raceDate, track,
}={}) {
  const miss=(status)=>({status,runner:null});
  const code=jraHorseCode(liveHorseRef);
  if(!code)return miss("MISSING_VERIFIABLE_LIVE_ID");
  if(!Array.isArray(archiveRunners)||typeof raceDate!=="string"
      ||!/^\d{4}-\d{2}-\d{2}$/.test(raceDate)
      ||typeof track!=="string"||!track.trim())return miss("INVALID_RACE_CONTEXT");

  const matchingCode=archiveRunners.filter(r=>r?.race_date===raceDate
      &&r?.track===track&&jraHorseCode(r?.horse_ref)===code);

  if(matchingCode.length===0)return miss("NOT_IN_ARCHIVED_RACE");
  if(matchingCode.length!==1)return miss("AMBIGUOUS_HORSE_ID");
  if(!sameName(matchingCode[0].horse_name,liveHorseName))
    return miss("ID_NAME_CONFLICT");

  return {status:"VERIFIED_MATCH",runner:matchingCode[0]};
}
