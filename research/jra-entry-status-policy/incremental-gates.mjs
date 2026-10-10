// SHADOW ONLY. Produces a staging plan; never publishes or writes to production.
export function planScopedRefresh({race, runners, verifiedStatuses, sourceSignature, previousSignature}) {
  if (!race?.id || !Array.isArray(runners) || runners.length === 0) return {state:'HOLD',reason:'MISSING_RACE'};
  if (typeof sourceSignature !== 'string' || !/^[a-f0-9]{64}$/.test(sourceSignature)) return {state:'HOLD',reason:'NO_SOURCE_SIGNATURE'};
  if (!Array.isArray(verifiedStatuses) || verifiedStatuses.length !== runners.length) return {state:'HOLD',reason:'UNVERIFIED_FIELD'};
  const runnersByNumber = new Map();
  for (const runner of runners) {
    if (!Number.isInteger(runner?.horse_no) || runner.horse_no <= 0 || runnersByNumber.has(runner.horse_no))
      return {state:'HOLD',reason:'DUPLICATE_RUNNER'};
    runnersByNumber.set(runner.horse_no,runner);
  }
  const statusesByNumber = new Map();
  for (const status of verifiedStatuses) {
    if (!Number.isInteger(status?.horse_no) || !runnersByNumber.has(status.horse_no) || statusesByNumber.has(status.horse_no))
      return {state:'HOLD',reason:'STATUS_FIELD_MISMATCH'};
    if (!['ACTIVE','CANCELLED','EXCLUDED'].includes(status.status) || status.verified !== true || status.scope !== 'CURRENT_RACE')
      return {state:'HOLD',reason:'STATUS_UNKNOWN'};
    statusesByNumber.set(status.horse_no,status);
  }
  if (sourceSignature === previousSignature) return {state:'NO_CHANGE',raceId:race.id};
  return {state:'STAGE_ONLY',raceId:race.id,
    activeHorseNos:runners.filter(r=>statusesByNumber.get(r.horse_no).status==='ACTIVE').map(r=>r.horse_no),
    sourceSignature};
}
