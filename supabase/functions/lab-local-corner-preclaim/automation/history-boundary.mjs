// Conservative leakage barrier shared by DB and official history inputs.
// Pages without start/result timestamps cannot establish same-day finality.
export function historyBeforeRace(history, race) {
  const date=history.race_date;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date??'') || !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0,10)!==date ||
    !Number.isFinite(Date.parse(race.post_time)) || date>=race.race_date) return false;
  // An inconsistent date cannot hide an explicitly future start/finality time.
  for(const field of ['race_start_at','scheduled_start_at','result_confirmed_at']) {
    if(history[field]!=null && (!Number.isFinite(Date.parse(history[field])) ||
      Date.parse(history[field])>=Date.parse(race.post_time)))return false;
  }
  return !history.post_race_target && !history.prediction_archive;
}
