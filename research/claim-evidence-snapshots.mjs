/**
 * Append-only pre-claim snapshot handoff.
 * A store implementation is injected by an authorized server-side worker.
 * This module NEVER reads credentials, runs SQL, claims a job, changes a rank,
 * manipulates odds/bets, or authorizes a save.
 */
import {createHash} from 'node:crypto';

const hash = (x)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const iso = (x)=>new Date(x).toISOString();

/** Only explicit allowed facts can be serialized; never include market or target results. */
export function sanitizePreclaimEvidence(report) {
  if(!report?.raceKey || !Array.isArray(report.runners))throw new TypeError('Invalid readiness report');
  const runners=report.runners.map(r=>({
    horseNo:String(r.horseNo),horseName:r.horseName,
    counts:{...r.counts},evidenceStatus:r.evidenceStatus,
    discrepancies:(r.discrepancies||[]).map(x=>({provider:x.provider,status:x.status})),
    historicalRuns:(r.runs||[]).map(h=>({
      raceDate:h.raceDate,track:h.track,raceNo:h.raceNo,
      surface:h.surface,distance:h.distance,raceClass:h.raceClass,
      finish:h.finish,earlyPos:h.earlyPos,finalTurnPos:h.finalTurnPos,
      final3f:h.final3f,raceHalons:h.raceHalons,
      source:{provider:h.provenance.provider,
        identity:h.provenance.identity,
        identityVerified:h.provenance.identityVerified,
        sourceTimestampVerified:h.provenance.sourceTimestampVerified,
        sourceCheckedAt:h.provenance.sourceCheckedAt}
    }))
  }));
  return {schemaVersion:'PRECLAIM_EVIDENCE_1',
    raceKey:report.raceKey,asOf:report.asOf,rosterCount:report.rosterCount,
    runners,sourceReports:report.sourceReports.map(x=>({
      provider:x.provider,status:x.status,accepted:x.accepted??null,
      ignored:x.ignored??null
    })),
    fieldCoverage:{...report.fieldCoverage},
    optionalProviderFailures:report.optionalProviderFailures,
    noRankingOrSaveChanges:true};
}

/**
 * Store contract: store.insertIfAbsent(record) -> Promise<{inserted:boolean}>.
 * Return error detail, but NEVER abort the existing prediction path
 * because an OPTIONAL snapshot store is unavailable.
 */
export async function persistPreclaimEvidence({
  report,race,officialRunners,store,circuit,clock=()=>Date.now()
}) {
  if(!['JRA','LOCAL'].includes(circuit))throw new TypeError('Invalid circuit');
  if(!race?.postTime || !Number.isFinite(Date.parse(race.postTime)))throw new TypeError('Official postTime required');
  if(!Array.isArray(officialRunners) || officialRunners.length===0)
    throw new TypeError('Official roster required');
  if(typeof store?.insertIfAbsent!=='function')throw new TypeError('Inject safe append-only store');
  const now=clock(),postMs=Date.parse(race.postTime),asOfMs=Date.parse(report.asOf);
  if(!Number.isFinite(asOfMs)||!Number.isFinite(now))throw new TypeError('Invalid asOf/clock');
  if(now>=postMs || asOfMs>=postMs || asOfMs>now)
    return {status:'SKIPPED_PAST_POST_OR_INVALID_ASOF',normalCorePathAllowed:true,inserted:false};
  const roster=officialRunners.filter(x=>x.status!=='CANCELLED' && x.status!=='EXCLUDED')
    .map(x=>({horseNo:String(x.horseNo),horseName:x.horseName,horseRef:x.horseRef??null}))
    .sort((a,b)=>Number(a.horseNo)-Number(b.horseNo));
  if(roster.length!==report.rosterCount || report.runners.length!==roster.length)
    return {status:'SKIPPED_ROSTER_MISMATCH',normalCorePathAllowed:false,inserted:false};
  const evidence=sanitizePreclaimEvidence(report);
  const sourceFailures=report.sourceReports.filter(x=>x.status==='SOURCE_FAILED'||x.status==='SOURCE_TIMEOUT').length;
  const partial=(sourceFailures>0||report.fieldCoverage.anyHistory<roster.length);
  const record={
    circuit,race_date:race.raceDate,track:race.track,race_no:Number(race.raceNo),
    official_post_time:iso(race.postTime),as_of:iso(report.asOf),
    source_kind:'COMBINED',source_version:'PRECLAIM_PACE_0.1',
    source_status:partial?'PARTIAL':'READY',
    active_runner_count:roster.length,official_roster_digest:hash(roster),
    payload_digest:hash(evidence),evidence,
    data_quality:{
      historyCovered:report.fieldCoverage.anyHistory,
      positionsCovered:report.fieldCoverage.position,
      lapsCovered:report.fieldCoverage.laps,
      sourceFailures,unverifiedTiming:report.runners.filter(x=>x.evidenceStatus==='UNVERIFIED_ONLY').length
    }
  };
  try {
    const outcome=await store.insertIfAbsent(record);
    return {status:outcome?.inserted?'STORED':'ALREADY_STORED',
      normalCorePathAllowed:true,inserted:Boolean(outcome?.inserted),
      rosterDigest:record.official_roster_digest,payloadDigest:record.payload_digest};
  }catch{
    return {status:'OPTIONAL_STORE_FAILED',normalCorePathAllowed:true,inserted:false};
  }
}
