/**
 * Input adapters for BAKEN LAB read-only evidence research.
 * These do not fetch remote sources, modify production DB or make predictions.
 */
import { buildRaceEvidence } from './pace-evidence.mjs';
const isoDay = (value) => String(value || '').slice(0, 10);
const safeArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const a=JSON.parse(v); return Array.isArray(a) ? a : []; }
    catch { return []; }
  }
  return [];
};

/** A stable per-horse race key, because two races may share track/date/distance. */
export function historicKey(horseName, raceDate, track, surface, distance) {
  return JSON.stringify([horseName, isoDay(raceDate), track, surface, Number(distance)]);
}

/** Convert jra_live_runners row, retaining snapshot provenance for as-of cutoffs. */
export function fromJraLiveRunner(row) {
  if (!row?.horse_name || row.horse_no === undefined) throw new TypeError('Invalid JRA runner');
  return {
    horseNo: row.horse_no, horseName: row.horse_name,
    pastRuns: safeArr(row.past_runs).map((run) => ({
      raceDate: isoDay(run.race_date), track: run.track,
      surface: run.surface, distance: run.distance,
      earlyPos: run.early_pos, finalTurnPos: run.final_turn_pos,
      final3f: run.final3f, finish: run.finish,
      raceClass: run.race_class_detail ?? run.race_class ?? null,
      sourceCheckedAt: row.source_checked_at ?? null,
      runKey: historicKey(row.horse_name, run.race_date, run.track, run.surface, run.distance)
    }))
  };
}

/**
 * Convert historic local horse_runs records. The historical table has no capture timestamp.
 * These entries will be flagged PARTLY_UNVERIFIED_SOURCE_TIME by buildRaceEvidence.
 * Horse-name matches alone are not proof of a unique real-world horse identity.
 */
export function fromLocalHorseRuns({ horseNo, horseName, runs }) {
  if (!horseName || horseNo === undefined) throw new TypeError('Invalid LOCAL runner');
  const rows = safeArr(runs);
  if (rows.some((r) => r.horse_name !== horseName)) throw new TypeError('Horse name mismatch');
  return {
    horseNo, horseName, identityProvenance: 'NAME_ONLY_UNVERIFIED',
    pastRuns: rows.map((run) => ({
      raceDate: isoDay(run.race_date), track: run.track,
      surface: run.surface, distance: run.distance,
      earlyPos: run.early_pos, finalTurnPos: run.final_turn_pos,
      final3f: run.final3f, finish: run.finish,
      raceClass: run.race_name ?? null, sourceCheckedAt: null,
      runKey: historicKey(horseName, run.race_date, run.track, run.surface, run.distance)
    }))
  };
}

/**
 * Build keyed archived JRA split times, only for previous runs matched to
 * an actual horse by date/track/course/distance. Duplicates are rejected.
 */
export function indexMatchedJraLaps(rows) {
  const out={};
  for(const row of safeArr(rows)) {
    const horse=row.horse_name;
    if(!horse || !row.race_date || !row.track || !row.surface) continue;
    const key=historicKey(horse,row.race_date,row.track,row.surface,row.distance);
    if(key in out) throw new TypeError('Ambiguous JRA archive lap match');
    out[key]={
      raceDate:isoDay(row.race_date), track:row.track,
      surface:row.surface, distance:Number(row.distance),
      halonTimes:row.halon_times, sourceCheckedAt:row.source_checked_at ?? null
    };
  }
  return out;
}

/** Directly usable with JSON rows exported from connected Supabase read-only queries. */
export function buildFromJraRows({ race, liveRunners, matchedArchiveRows=[], asOf }) {
  return buildRaceEvidence({ race, asOf,
    runners:safeArr(liveRunners).map(fromJraLiveRunner),
    archivedLaps:indexMatchedJraLaps(matchedArchiveRows)
  });
}
export function buildFromLocalRows({ race, horseRows, asOf }) {
  return buildRaceEvidence({ race, asOf,
    runners:safeArr(horseRows).map(fromLocalHorseRuns)
  });
}
