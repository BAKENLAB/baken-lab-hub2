import { routeAvailability } from './route-01-12-availability.mjs';

const number = value => typeof value === 'number' || typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)
  ? Number(value) : null;

function clock(value) {
  const match = typeof value === 'string' && /^(\d+):([0-5]\d\.\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function raceLaps(raw, distance, winner) {
  const ticks = typeof raw === 'string' ? raw.split(/\s*-\s*/).map(number) : raw;
  if (!Array.isArray(ticks) || !distance || !winner || ticks.length !== Math.ceil(distance / 200) ||
      ticks.some(n => !Number.isFinite(n) || n <= 0 || Math.abs(n * 10 - Math.round(n * 10)) > 1e-7) ||
      ticks.reduce((sum,n)=>sum+Math.round(n*10),0)!==Math.round(winner*10)) return null;
  return ticks;
}

export function supplyArchiveMaterials({circuit,targetDate,cutoff,roster,rows}) {
  if (!Number.isFinite(Date.parse(cutoff))) throw Error('INVALID_CUTOFF');
  const records = [];
  for (const row of rows) {
    const jra = circuit === 'JRA';
    const observed = jra ? row.source_checked_at : row.corner_checked_at;
    const source = jra ? row.source_ref : row.corner_source_ref;
    if (!source || !Number.isFinite(Date.parse(observed)) || Date.parse(observed)>Date.parse(cutoff))
      throw Error('UNBOUND_SOURCE_OR_ASOF');
    const settlement = row.settlement_candidate;
    const timelySettlement = Number.isFinite(Date.parse(settlement?.settled_at)) &&
      Date.parse(settlement.settled_at)<=Date.parse(cutoff) ? settlement : null;
    const lap = row.verified_race_lap_candidate;
    const distance = jra ? number(row.distance) : number(lap?.distance_m);
    const lapBound = lap?.status==='VERIFIED_RACE_LEVEL_LAPS' &&
      lap.finish_time_reconciled===true && lap.individual_horse_sectionals===false &&
      lap.sourceRef===source && lap.pastRace?.raceDate===row.prior_date &&
      lap.pastRace?.track===row.prior_track && lap.pastRace?.raceNo===number(row.prior_race_no) &&
      Date.parse(lap.sourceCheckedAt)<=Date.parse(cutoff);
    const finish = number(jra ? row.finish : timelySettlement?.finish);
    const corners = jra ? (/^\d+(?:\s+\d+)*$/.test(row.corner_positions ?? '') ?
      row.corner_positions.split(/\s+/).map(Number) : null) :
      row.corners?.slice().sort((a,b)=>a.corner-b.corner).map(c=>c.position) ?? null;
    records.push({
      current_no:number(row.current_no),race_date:jra?row.race_date:row.prior_date,
      track:jra?row.track:row.prior_track,race_no:number(jra?row.race_no:row.prior_race_no),
      prior_no:number(row.prior_no),source_ref:source,source_checked_at:observed,
      identity_status:jra?'ARCHIVE_IDENTITY_CANDIDATE':'STORED_OFFICIAL_HORSE_REF_WITNESS',
      finish,elapsed_seconds:finish>0?(jra?number(row.elapsed_seconds):clock(timelySettlement?.time_raw)):null,
      settlement_observed_at:timelySettlement?.settled_at??null,
      gap_winner:jra?number(row.gap_winner):null,gap_next:jra?number(row.gap_next):null,
      final3f:jra&&finish>0?number(row.final3f):null,corners,distance,
      surface:jra?row.surface:null,going:jra?row.going:null,class_name:jra?row.class_name:null,
      race_laps:jra?raceLaps(row.halon_times,distance,number(row.lap_winner_seconds)):
        lapBound?raceLaps(lap.segments?.map(s=>s.seconds),distance,lap.winner_time_seconds):null,
      lap_scope:'RACE_LEVEL_ONLY',incident:null
    });
  }
  return materialPacket({circuit,targetDate,roster,records});
}

export function materialPacket({circuit,targetDate,roster,records}) {
  const ledger=routeAvailability({circuit,targetDate,roster,records});
  return {...ledger,runners:ledger.per_runner.map(h=>({
    ...h,materials:records.filter(r=>r.current_no===h.horse_no)
  }))};
}
