/**
 * Wires the two read-only LOCAL modules for an explicitly invoked pre-CLAIM
 * acquisition phase. Importing this module does not fetch or schedule anything.
 *
 * Authorization and current official runner verification MUST be handled by
 * the caller. The caller must pass official horse-linked historical witnesses,
 * never user-edited rows or name-only history.
 */
import {fetchLocalPriorCornerEvidence} from './nar-corner-prefetch.mjs';
import {readNarOfficialPriorCorners} from './nar-prior-corners-official-source.mjs';

export function prepareLocalOfficialCornerPacket({
  targetRace,officialVerifiedRunners,
  maxPriorRaces=12,timeoutMs=3000,reserveMs=5*60*1000,
  clock=()=>Date.now(),fetchImpl=fetch
}) {
  return fetchLocalPriorCornerEvidence({
    targetRace,runners:officialVerifiedRunners,maxPriorRaces,timeoutMs,reserveMs,clock,
    fetchVerifiedRace:({priorRace,signal})=>readNarOfficialPriorCorners({
      priorRace,targetRaceDate:targetRace.raceDate,
      targetPostTime:targetRace.postTime,clock,fetchImpl,signal
    })
  });
}
