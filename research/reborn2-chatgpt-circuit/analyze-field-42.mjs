import { analyzeField } from '../reborn2-analysis-circuit/analyze.mjs';
import { analyzeOpposition33to42 } from './opposition-33-42.mjs';

// Additive research entrypoint: original output is retained verbatim under base01to32.
export function analyzeField42({baseArgs,oppositionArgs}) {
  const base01to32=analyzeField(baseArgs);
  const {target,roster}=oppositionArgs;
  const jstDate=Number.isFinite(Date.parse(target.started_at))?new Date(Date.parse(target.started_at)+9*3600000).toISOString().slice(0,10):null;
  // Old archive adapter lacks a race ID. Caller must bind the actual target explicitly.
  if(target.circuit!==baseArgs.input.circuit||target.cutoff!==baseArgs.input.cutoff||
     target.race_id!==baseArgs.input.targetRaceId||jstDate!==baseArgs.input.targetDate)
    throw Error('TARGET_CONTEXT_MISMATCH');
  const oldNos=base01to32.runners.map(x=>x.horse_no).sort((a,b)=>a-b);
  const newNos=roster.map(x=>x.horse_no).sort((a,b)=>a-b);
  if(JSON.stringify(oldNos)!==JSON.stringify(newNos))throw Error('ROSTER_MISMATCH');
  const opposition=analyzeOpposition33to42(oppositionArgs);
  return {base01to32,opposition,coverage:{...base01to32.coverage,...opposition.coverage},
    scoring_authorized:false,final_grade:null};
}
