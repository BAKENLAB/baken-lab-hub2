/**
 * NAR official result postrace-only normalizer.
 *
 * Historic RaceMark ingests occasionally contain an extra untimed "finish:1"
 * row alongside the genuine winner (2026-11-09 Saga 8R and 11R).
 * Never infer the winner from the first JSON row or from finish alone.
 * Verify the unique official WIN payout horse against the result rows.
 * No ability score, odds, popularity, CLAIM, FROZEN or DB writes.
 */
const intNo = x => Number.isInteger(x) && x >= 1 && x <= 24;
const decimalHorseNo = x => typeof x === 'string' && /^(?:[1-9]|1\d|2[0-4])$/.test(x);
const stop = (reason) => ({
  status:'UNVERIFIED',reason,podium_horse_nos:null,winner_horse_no:null,
  ignored_duplicate_first_horse_nos:[],rank_effect:false,market_ability_effect:false,
  frozen_modified:false
});

export function verifyNarOfficialPodium({result,source}={}) {
  if(source!=='NAR_OFFICIAL_RACEMARK')return stop('RESULT_SOURCE_NOT_OFFICIAL');
  const finishers=result?.finishers;
  const win=result?.payouts?.win;
  if(!Array.isArray(finishers)||!Array.isArray(win)||win.length!==1)
    return stop('FINISHERS_OR_UNIQUE_OFFICIAL_WIN_PAYOUT_MISSING');
  const winningCombo=win[0]?.combination;
  if(!decimalHorseNo(winningCombo))return stop('OFFICIAL_WIN_PAYOUT_HORSE_INVALID');
  const winnerNo=Number(winningCombo);
  const podium={1:[],2:[],3:[]};
  for(const row of finishers) {
    if(!Number.isInteger(row?.finish)||![1,2,3].includes(row.finish))continue;
    if(!intNo(row.horse_no)||typeof row.horse_name!=='string'||!row.horse_name.trim())
      return stop('PODIUM_ROW_INVALID');
    podium[row.finish].push(row);
  }
  const actualWinner=podium[1].filter(x=>x.horse_no===winnerNo);
  if(actualWinner.length!==1)return stop('WINNER_ROW_AND_PAYOUT_NOT_UNIQUE');
  if(podium[2].length!==1||podium[3].length!==1)
    return stop('RUNNERS_UP_MISSING_OR_DEAD_HEAT_UNSUPPORTED');
  const nos=[actualWinner[0].horse_no,podium[2][0].horse_no,podium[3][0].horse_no];
  if(new Set(nos).size!==3)return stop('PODIUM_HORSE_DUPLICATED');
  const ignored=podium[1].filter(x=>x.horse_no!==winnerNo).map(x=>x.horse_no);
  // Even malformed rows must not be silently reassigned to places 2 or 3.
  if(new Set(ignored).size!==ignored.length||ignored.some(x=>nos.includes(x)))
    return stop('CONFLICTING_EXTRA_FIRST_ROW');
  return {
    status:'VERIFIED',source,podium_horse_nos:nos,winner_horse_no:winnerNo,
    ignored_duplicate_first_horse_nos:ignored,
    correction_applied:ignored.length>0,
    result_only:true,rank_effect:false,market_ability_effect:false,
    frozen_modified:false
  };
}
