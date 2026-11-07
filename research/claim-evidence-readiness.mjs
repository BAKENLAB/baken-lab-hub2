/**
 * BAKEN LAB: PRE-CLAIM optional evidence delivery layer.
 *
 * A source failure must NOT masquerade as a race save failure.
 * This module never executes a CLAIM, writes DB rows, ranks horses or bypasses a safety gate.
 *
 * Call before CLAIM while there is time to gather deep history.
 * Callers MUST still enforce official READY/field integrity, post-time and lease guards.
 */

class OptionalSourceTimeout extends Error {
  constructor(){super('Optional evidence provider timed out');this.name='OptionalSourceTimeout';}
}
async function loadWithDeadline(provider, args, timeoutMs) {
  const controller=new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(()=>provider.load({...args,signal:controller.signal})),
      new Promise((_,reject)=>{
        timer=setTimeout(()=>{controller.abort();reject(new OptionalSourceTimeout());},timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const parseTime = (x) => {
  const millis = Date.parse(x);
  return Number.isFinite(millis) ? millis : null;
};
const isoDate = (x) => typeof x === 'string' ? x.slice(0, 10) : '';
const array = (v) => Array.isArray(v) ? v : [];
const validNumber = (n) => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n));
const normalizedNo = (x) => String(x ?? '').trim();
const isValidNo = (x) => /^\d+$/.test(x) && Number(x)>0;
const keyOfRun = (r) => JSON.stringify([
  isoDate(r.raceDate), r.track ?? '', r.raceNo ?? '',
  r.surface ?? '', r.distance ?? ''
]);

function normalizeRun(run, source, asOfMs, raceDate) {
  if (typeof run !== 'object' || run === null) return null;
  const date = isoDate(run.raceDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= raceDate) return null;
  // Not accepting future snapshots is distinct from evaluating historical races.
  if (run.sourceCheckedAt !== null && run.sourceCheckedAt !== undefined) {
    const t=parseTime(run.sourceCheckedAt);
    if (t === null || t>asOfMs) return null;
  }
  // An unversioned, unverified historical record may be cited, never counted
  // as an authenticated source for a confident causal or model-ranking assertion.
  // The archived row may carry an explicitly unverified missing horse-ref identity
  // even when its race and runner insertion timestamps are before asOf.
  const recordIdentity=run.identityStatus ?? source.identity;
  const verified=run.sourceCheckedAt !== null && run.sourceCheckedAt !== undefined &&
    (recordIdentity==='VERIFIED' || recordIdentity==='HORSE_REF_MATCH');
  const position=(validNumber(run.earlyPos) && Number(run.earlyPos)>0)
    ? Number(run.earlyPos) : null;
  const finalTurn=(validNumber(run.finalTurnPos) && Number(run.finalTurnPos)>0)
    ? Number(run.finalTurnPos) : null;
  const last3f=(validNumber(run.final3f) && Number(run.final3f)>0)
    ? Number(run.final3f) : null;
  const halfLaps=typeof run.halonTimes==='string' && run.halonTimes.trim() ? run.halonTimes : null;
  return {
    raceDate:date, track:run.track, raceNo:run.raceNo??null,
    surface:run.surface, distance:run.distance??null, raceClass:run.raceClass??null,
    finish:validNumber(run.finish)?Number(run.finish):null,
    earlyPos:position, finalTurnPos:finalTurn, final3f:last3f,
    raceHalons:halfLaps,
    provenance:{provider:source.id, identity:recordIdentity,
      sourceCheckedAt:run.sourceCheckedAt??null,
      sourceTimestampVerified:verified,
      identityVerified:(recordIdentity==='VERIFIED' || recordIdentity==='HORSE_REF_MATCH'),
      timestampUnknown:run.sourceCheckedAt===null || run.sourceCheckedAt===undefined}
  };
}

/**
 * providers = [{id, identity:'VERIFIED'|'NAME_ONLY', load:async ({race,roster,asOf}) =>
 *   [{horseNo,horseName,horseRef?,runs:[{raceDate,...}]}]}]
 *
 * Providers are allowed to fail independently; failures are reported without cancelling
 * information already collected. No background tasks, no retries after deadline.
 */
export async function prepareClaimEvidence({
  race, officialRunners, providers=[], asOf, clock=()=>Date.now(),
  minimumClaimBufferMs=5*60*1000, providerTimeoutMs=4000
}) {
  if(!race?.raceDate || !race?.track || !Number.isInteger(Number(race.raceNo)) ||
    !asOf || !Number.isFinite(parseTime(asOf))) throw new TypeError('Invalid race/asOf');
  if(!Array.isArray(officialRunners) || officialRunners.length===0)
    throw new TypeError('Official roster required');
  const roster=officialRunners.filter((r)=>r.status!=='CANCELLED' && r.status!=='EXCLUDED');
  const byNo=new Map();
  for(const runner of roster){
    const no=normalizedNo(runner.horseNo);
    if(!isValidNo(no)|| !runner.horseName || byNo.has(no)) throw new TypeError('Official roster conflict');
    byNo.set(no,{horseNo:no,horseName:runner.horseName,horseRef:runner.horseRef??null,
      runs:new Map(),discrepancies:[]});
  }
  const raceDate=isoDate(race.raceDate), asOfMs=parseTime(asOf);
  const deadlineMs=parseTime(race.postTime);
  // Conservative: if no valid postTime supplied, no optional deadline inference is made;
  // the core Save gate remains solely responsible for actual timing decisions.
  const sourceReports=[];
  for(const provider of array(providers)){
    if(!provider?.id || typeof provider.load!=='function') {
      sourceReports.push({provider:provider?.id??'UNKNOWN',status:'BAD_PROVIDER'});continue;
    }
    if(deadlineMs!==null && deadlineMs-clock()<minimumClaimBufferMs){
      sourceReports.push({provider:provider.id,status:'SKIPPED_DEADLINE_BUFFER'});
      continue;
    }
    try {
      // Keep supplemental fetching outside the official CLAIM. One failing/hanging source
      // cannot consume the entire pre-race window.
      const timeRemaining=deadlineMs===null?providerTimeoutMs:
        Math.max(1,deadlineMs-clock()-minimumClaimBufferMs);
      const budgetMs=Math.max(1,Math.min(providerTimeoutMs,timeRemaining));
      const loaded=await loadWithDeadline(provider,{race,roster:officialRunners,asOf},budgetMs);
      if(!Array.isArray(loaded)) throw new TypeError('Provider returned non-array');
      let accepted=0,ignored=0;
      for(const item of loaded){
        const no=normalizedNo(item?.horseNo),runner=byNo.get(no);
        if(!runner || item?.horseName!==runner.horseName) {ignored++;continue;}
        if(runner.horseRef && item.horseRef && item.horseRef!==runner.horseRef) {
          runner.discrepancies.push({provider:provider.id,status:'HORSE_REF_MISMATCH'});
          ignored++;continue;
        }
        // Archive horse-name-only matches must stay unverified and not silently acquire
        // an authenticated identity merely because the official roster uses same name.
        for(const itemRun of array(item.runs)){
          const r=normalizeRun(itemRun,provider,asOfMs,raceDate);
          if(!r){ignored++;continue;}
          const k=keyOfRun(r),prior=runner.runs.get(k);
          // Keep the most detailed run from a trustworthy source and merge disjoint
          // facts only when runner and event identity are consistent.
          const weight=(x)=>((x.provenance.sourceTimestampVerified?100:0)+
            (x.provenance.identity==='VERIFIED'?30:0)+
            [x.earlyPos,x.finalTurnPos,x.final3f,x.raceHalons].filter(x=>x!==null).length);
          if(!prior || weight(r)>weight(prior)) runner.runs.set(k,r);
          accepted++;
        }
      }
      sourceReports.push({provider:provider.id,status:'OK',accepted,ignored});
    }catch(error){
      sourceReports.push({provider:provider.id,
        status:error instanceof OptionalSourceTimeout?'SOURCE_TIMEOUT':'SOURCE_FAILED',
        errorCode:'OPTIONAL_PROVIDER_FAILURE'});
    }
  }
  const runners=[...byNo.values()].map(({runs,discrepancies,...runner})=>{
    const all=[...runs.values()].sort((a,b)=>b.raceDate.localeCompare(a.raceDate));
    const counts={
      historicalRuns:all.length,
      positionRuns:all.filter((r)=>r.earlyPos!==null && r.finalTurnPos!==null).length,
      last3fRuns:all.filter((r)=>r.final3f!==null).length,
      halonRuns:all.filter((r)=>r.raceHalons!==null).length,
      timestampVerifiedRuns:all.filter((r)=>r.provenance.sourceTimestampVerified).length
    };
    return {...runner,counts,discrepancies,runs:all,
      evidenceStatus:counts.historicalRuns===0?'NO_HISTORY':
        counts.timestampVerifiedRuns===0?'UNVERIFIED_ONLY':
        counts.positionRuns===0?'NO_POSITION':
        counts.halonRuns===0?'NO_RACE_LAPS':'DETAILED_HISTORY_AVAILABLE'};
  });
  return {
    raceKey:[raceDate,race.track,race.raceNo].join('/'),
    asOf, rosterCount:roster.length,runners,
    sourceReports, fieldCoverage:{
      anyHistory:runners.filter((r)=>r.counts.historicalRuns>0).length,
      verifiedHistory:runners.filter((r)=>r.counts.timestampVerifiedRuns>0).length,
      position:runners.filter((r)=>r.counts.positionRuns>0).length,
      last3f:runners.filter((r)=>r.counts.last3fRuns>0).length,
      laps:runners.filter((r)=>r.counts.halonRuns>0).length
    },
    optionalProviderFailures:sourceReports.filter((r)=>r.status==='SOURCE_FAILED'||r.status==='SOURCE_TIMEOUT').length,
    // "Proceed" here means supplemental fetch did not veto the normal procedure.
    // It never authorizes a SAVE: the independent official/CLAIM/lease gates decide.
    normalCorePathAllowed:true,
    saveAuthorizedByThisModule:false,
    oddsUsed:false, ranksChanged:false, targetRaceResultUsed:false
  };
}

/** Adapt existing JRA private.jra_optional_content_evidence_v3() output. */
export function jraV3RowsToProvider(rows,checkedAt){
  return array(rows).map((r)=>({
    horseNo:r.horse_no,horseName:r.horse_name,horseRef:r.horse_ref??null,
    runs:array(r.history).map((h)=>({
      raceDate:h.prior_date,track:h.prior_track, raceNo:h.prior_race_no??null,
      surface:h.prior_surface,distance:h.prior_distance,raceClass:h.prior_class,
      finish:h.finish,earlyPos:h.early_pos,
      finalTurnPos:h.live_final_turn_pos,
      final3f:h.final3f,halonTimes:h.race_halons,
      sourceCheckedAt:checkedAt
    }))
  }));
}

/** Adapt result of staged private.lab_local_pre_race_history_v1(). */
export function localArchiveRowsToProvider(packet){
  return array(packet?.runners).map((r)=>({
    horseNo:r.horse_no,horseName:r.horse_name,
    runs:array(r.history).map((h)=>({
      raceDate:h.race_date, track:h.track,raceNo:h.race_no,
      surface:h.surface,distance:h.distance,raceClass:h.race_name,
      finish:h.finish,earlyPos:h.early_pos,finalTurnPos:h.final_turn_pos,
      final3f:h.final3f,halonTimes:null,
      sourceCheckedAt:null
    }))
  }));
}


/**
 * Adapt result of research/jra-asof-evidence-packet.sql.
 * The SQL filters archived record date AND the race/runner insertion timestamps
 * to <= asOf. Missing horse_ref is explicitly NAME_ONLY_UNVERIFIED.
 *
 * This packet is pre-race history only. It is NOT a new ranking algorithm.
 */
export function jraAsOfArchiveRowsToProvider(packet) {
  const rows=array(packet?.runners);
  return rows.map((runner)=>({
    horseNo:runner.horse_no,
    horseName:runner.horse_name,
    runs:array(runner.runs).map((h)=>{
      const stamp1=parseTime(h.archive_checked_at);
      const stamp2=parseTime(h.run_created_at);
      const maxStamp=stamp1!==null && stamp2!==null
        ? new Date(Math.max(stamp1,stamp2)).toISOString() : null;
      return {
        raceDate:h.race_date,track:h.track,raceNo:h.race_no,
        surface:h.surface,distance:h.distance,raceClass:h.class_name,
        finish:h.finish,earlyPos:h.early_pos,finalTurnPos:h.final_turn_pos,
        final3f:h.last3f,halonTimes:h.halon_times,
        sourceCheckedAt:maxStamp,
        identityStatus:h.identity_status||'NAME_ONLY_UNVERIFIED'
      };
    })
  }));
}
