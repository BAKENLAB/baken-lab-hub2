/**
 * BAKEN LAB - read-only, no-result-leak race-evidence extraction prototype.
 * No rank, score, market, bet or FROZEN mutation is performed in this module.
 * This is a research candidate, not production model integration.
 */
const round1 = (x) => Math.round((x + Number.EPSILON) * 10) / 10;
const day = (x) => (typeof x === 'string' ? x.slice(0, 10) : null);
const finite = (x) => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
const positive = (x) => finite(x) && Number(x) > 0;

/** JRA halon_times may start with a 100m split for odd distances. */
export function parseHalonTimes(halonTimes, distanceMeters) {
  if (typeof halonTimes !== 'string' || !halonTimes.trim()) {
    return { status: 'MISSING', first600: null, last600: null, halves: null };
  }
  if (!Number.isInteger(distanceMeters) || distanceMeters <= 0) {
    return { status: 'INVALID_DISTANCE', first600: null, last600: null, halves: null };
  }
  const tokens = halonTimes.split(/\s*[-,／]\s*/).map((s) => s.trim());
  if (tokens.some((s) => !/^\d+(?:\.\d+)?$/.test(s))) {
    return { status: 'INVALID_HALONS', first600: null, last600: null, halves: null };
  }
  const splits = tokens.map(Number);
  const n = Math.ceil(distanceMeters / 200);
  if (splits.length !== n || splits.some((x) => x < 5 || x > 60)) {
    return { status: 'LENGTH_MISMATCH', first600: null, last600: null, halves: null };
  }
  const head = distanceMeters - (n - 1) * 200;
  const widths = [head, ...Array(n - 1).fill(200)];
  const sumSegment = (start, end) => {
    let pos = 0;
    let sum = 0;
    for (let i = 0; i < widths.length; i += 1) {
      const segEnd = pos + widths[i];
      if (pos >= start && segEnd <= end) sum += splits[i];
      else if (segEnd > start && pos < end) return null;
      pos = segEnd;
    }
    return round1(sum);
  };
  const first600 = distanceMeters >= 600 ? sumSegment(0, 600) : null;
  const last600 = distanceMeters >= 600 ? sumSegment(distanceMeters - 600, distanceMeters) : null;
  const halfPoint = distanceMeters / 2;
  const firstHalf = sumSegment(0, halfPoint);
  const lastHalf = sumSegment(halfPoint, distanceMeters);
  return {
    status: 'OK', splits, segmentMeters: widths,
    first600, last600,
    halves: firstHalf !== null && lastHalf !== null ? { first: firstHalf, last: lastHalf } : null,
    slowDown600: first600 !== null && last600 !== null ? round1(last600 - first600) : null
  };
}

const normalizePosition = (v) => positive(v) && Number.isInteger(Number(v)) ? Number(v) : null;

/**
 * pastRuns are historical horse performances dated BEFORE this race.
 * Archived lap metadata are optional and indexed by runKey.
 * Source snapshots after asOf are barred from pre-FROZEN evidence.
 * Missing provenance is marked unverified, never silently treated as verified.
 */
export function buildRaceEvidence({ race, runners, archivedLaps = {}, asOf }) {
  if (!race || !Array.isArray(runners) || !day(race.raceDate) || !asOf) {
    throw new TypeError('race, runners, race.raceDate, asOf required');
  }
  const cutoff = new Date(asOf);
  if (!Number.isFinite(cutoff.getTime())) throw new TypeError('Invalid asOf');
  if (!Number.isInteger(Number(race.distance)) || Number(race.distance) < 600) {
    throw new TypeError('Invalid race.distance');
  }
  const currentDate = day(race.raceDate);
  const numbers = new Set();
  const evidence = runners.map((runner) => {
    const no = String(runner.horseNo);
    if (!no || no === 'undefined' || numbers.has(no)) throw new TypeError('Missing/duplicate horseNo');
    numbers.add(no);
    const valid = [];
    const excluded = { laterRace: 0, sourceAfterFreeze: 0, missingSourceTimestamp: 0, invalidDate: 0 };
    for (const past of runner.pastRuns || []) {
      const date = day(past.raceDate);
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { excluded.invalidDate += 1; continue; }
      if (date >= currentDate) { excluded.laterRace += 1; continue; }
      const fetchedAt = past.sourceCheckedAt;
      if (fetchedAt) {
        const fetched = new Date(fetchedAt);
        if (!Number.isFinite(fetched.getTime()) || fetched > cutoff) {
          excluded.sourceAfterFreeze += 1;
          continue;
        }
      } else excluded.missingSourceTimestamp += 1;
      const sameSurface = past.surface === race.surface;
      const comparable = sameSurface && finite(past.distance) &&
        Math.abs(Number(past.distance) - Number(race.distance)) <= 200;
      const firstCorner = normalizePosition(past.earlyPos);
      const finalCorner = normalizePosition(past.finalTurnPos);
      const final3f = positive(past.final3f) ? Number(past.final3f) : null;
      const key = past.runKey;
      const archive = key ? archivedLaps[key] : undefined;
      const lap = archive && archive.sourceCheckedAt && new Date(archive.sourceCheckedAt) <= cutoff &&
        archive.raceDate === past.raceDate && archive.track === past.track &&
        archive.surface === past.surface && Number(archive.distance) === Number(past.distance)
        ? parseHalonTimes(archive.halonTimes, Number(past.distance)) : { status: 'UNVERIFIED_OR_MISSING' };
      valid.push({ date, track: past.track, distance: Number(past.distance), sameSurface,
        sameTrackDistance: sameSurface && past.track === race.track && Number(past.distance) === Number(race.distance),
        comparable, finish: finite(past.finish) ? Number(past.finish) : null,
        earlyPos: firstCorner, finalTurnPos: finalCorner,
        final3f, lapStatus: lap.status, first600: lap.first600 ?? null, last600: lap.last600 ?? null,
        sourceVerified: Boolean(fetchedAt), raceClass: past.raceClass ?? null });
    }
    const recent = [...valid].sort((a,b) => b.date.localeCompare(a.date));
    const comparableRuns = recent.filter((x) => x.comparable && x.earlyPos !== null);
    const frontRuns = comparableRuns.filter((x) => x.earlyPos <= 3);
    const olderSameCondition = recent.filter((x,idx) => idx >= 4 && x.sameTrackDistance && x.finish !== null && x.finish <= 3);
    const sameTrackDistance = recent.filter((x) => x.sameTrackDistance);
    return {
      horseNo: no, horseName: runner.horseName,
      pastRuns: recent.length, positionAvailable: recent.filter((x) => x.earlyPos !== null).length,
      individualFinal3fAvailable: recent.filter((x) => x.final3f !== null).length,
      lapAvailable: recent.filter((x) => x.lapStatus === 'OK').length,
      sameTrackDistanceRuns: sameTrackDistance.length,
      sameTrackDistanceTop3: sameTrackDistance.filter((x) => x.finish !== null && x.finish <= 3).length,
      olderSameTrackDistanceTop3: olderSameCondition.length,
      olderExamples: olderSameCondition.slice(0,3),
      frontStyle: comparableRuns.length >= 2 && frontRuns.length >= 2,
      comparablePositionRuns: comparableRuns.length, frontPositionRuns: frontRuns.length,
      excluded, evidenceQuality: excluded.missingSourceTimestamp ? 'PARTLY_UNVERIFIED_SOURCE_TIME' : 'TIMESTAMP_VERIFIED',
      runs: recent.slice(0, 20)
    };
  });
  const fieldWithComparable = evidence.filter((e) => e.comparablePositionRuns >= 2).length;
  const frontStyleCount = evidence.filter((e) => e.frontStyle).length;
  return { raceKey: `${currentDate}/${race.track}/${race.raceNo}`, fieldSize: runners.length,
    frontStyleCount, fieldWithComparable, unresolvedField: runners.length - fieldWithComparable,
    fieldPaceHypothesis: 'UNVALIDATED', runners: evidence };
}
