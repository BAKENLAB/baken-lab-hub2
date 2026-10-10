// SHADOW ONLY. This module cannot publish or write to production.
export function planScopedRefresh({race, runners, verifiedStatuses, sourceSignature, previousSignature}) {
  if (!race?.id || !Array.isArray(runners) || !runners.length) return {state:'HOLD',reason:'MISSING_RACE'};
  if (!sourceSignature || !/^[a-f0-9]{64}$/.test(sourceSignature)) return {state:'HOLD',reason:'NO_SOURCE_SIGNATURE'};
  if (!verifiedStatuses || verifiedStatuses.length !== runners.length) return {state:'HOLD',reason:'UNVERIFIED_FIELD'};
  const ids = new Set();
  for (const runner of runners) {
    if (!Number.isInteger(runner.horse_no) || ids.has(runner.horse_no)) return {state:'HOLD',reason:'DUPLICATE_RUNNER'};
    ids.add(runner.horse_no);
    const s = verifiedStatuses.find(x => x.horse_no === runner.horse_no);
    if (!s || !['ACTIVE','CANCELLED','EXCLUDED'].includes(s.status) || s.verified !== true || s.scope !== 'CURRENT_RACE') return {state:'HOLD',reason:'STATUS_UNKNOWN'};
  }
  if (sourceSignature === previousSignature) return {state:'NO_CHANGE',raceId:race.id};
  return {state:'STAGE_ONLY',raceId:race.id,activeHorseNos:verifiedStatuses.filter(x=>x.status==='ACTIVE').map(x=>x.horse_no),sourceSignature};
}
