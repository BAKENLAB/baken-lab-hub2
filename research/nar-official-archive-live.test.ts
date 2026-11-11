import {readNarOfficialPriorCorners} from '../automation/nar-prior-corners-official-source.mjs';
import {buildVerifiedPriorCornerEvidence} from '../automation/nar-prior-corners.mjs';

// Read-only probe of a completed historical race. Does not access today's entries,
// start CLAIM, use market data, write to a DB or save a prediction.
Deno.test('LIVE ARCHIVE: NAR official 2026-11-07 Saga5 exact names and corners',async()=>{
 const priorRace={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
 const targetRaceDate='2030-01-01',targetPostTime='2030-01-01T09:30:00+09:00';
 const raw=await readNarOfficialPriorCorners({
  priorRace,targetRaceDate,targetPostTime,signal:AbortSignal.timeout(10000)
 });
 if(raw.knownHorseNos.length!==11)throw Error('LIVE_HORSE_COUNT_MISMATCH: '+raw.knownHorseNos.length);
 if(raw.officialHorseNames['11']!=='シエルブリエ')throw Error('LIVE_HORSE_11_IDENTITY_MISMATCH');
 if(raw.officialHorseNames['6']!=='ハヤブサブロー')throw Error('LIVE_HORSE_6_IDENTITY_MISMATCH');
 const out=buildVerifiedPriorCornerEvidence({
  ...raw,priorRace,targetRaceDate,targetPostTime
 });
 if(out.runners.find(x=>x.prior_horse_no===6)?.early_pos!==1)throw Error('LIVE_FIRST_CORNER_MISMATCH');
 if(out.runners.find(x=>x.prior_horse_no===11)?.final_turn_pos!==1)throw Error('LIVE_FOURTH_CORNER_MISMATCH');
 if(out.positions_covered!==11)throw Error('LIVE_COVERAGE_MISMATCH');
 if(out.market_used!==false||out.scoring_effect!==0)throw Error('UNSAFE_OUTPUT');
});
