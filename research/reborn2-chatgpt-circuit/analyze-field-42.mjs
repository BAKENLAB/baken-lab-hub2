import { analyzeField } from '../reborn2-analysis-circuit/analyze.mjs';
import { analyzeOpposition33to42 } from './opposition-33-42.mjs';

// Additive research entrypoint: original output is retained verbatim under base01to32.
export function analyzeField42({baseArgs,oppositionArgs}) {
  const base01to32=analyzeField(baseArgs);
  const {target,roster}=oppositionArgs;
  if(target.circuit!==baseArgs.input.circuit||target.cutoff!==baseArgs.input.cutoff||
     target.started_at.slice(0,10)!==baseArgs.input.targetDate && target.local_date!==baseArgs.input.targetDate)
    throw Error('TARGET_CONTEXT_MISMATCH');
  const oldNos=base01to32.runners.map(x=>x.horse_no).sort((a,b)=>a-b);
  const newNos=roster.map(x=>x.horse_no).sort((a,b)=>a-b);
  if(JSON.stringify(oldNos)!==JSON.stringify(newNos))throw Error('ROSTER_MISMATCH');
  const opposition=analyzeOpposition33to42(oppositionArgs);
  return {base01to32,opposition,coverage:{...base01to32.coverage,...opposition.coverage},
    scoring_authorized:false,final_grade:null};
}
