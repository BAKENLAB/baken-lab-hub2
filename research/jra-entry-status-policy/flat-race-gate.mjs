// SHADOW ONLY. Flat-race model must never rank obstacle races.
export function gateFlatRace(race) {
  if (!race?.id || !race.race_type) return {state:'HOLD',reason:'UNVERIFIED_RACE_TYPE'};
  if (race.race_type === '障害') return {state:'SKIP',reason:'JUMP_RACE'};
  if (race.race_type !== '平地') return {state:'HOLD',reason:'UNKNOWN_RACE_TYPE'};
  if (!['芝','ダート'].includes(race.surface) || !Number.isInteger(race.distance) || race.distance <= 0)
    return {state:'HOLD',reason:'UNVERIFIED_COURSE'};
  return {state:'ELIGIBLE',raceId:race.id};
}
