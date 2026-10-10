import {readFileSync} from 'node:fs';
import {createWorksheet,createOutsideAuditSlots,validateCompleted} from './template.mjs';
const [mode,first,second]=process.argv.slice(2);
const read=p=>JSON.parse(readFileSync(p,'utf8'));
try {
  let output;
  if(mode==='worksheet' && first && !second) output=createWorksheet(read(first));
  else if(mode==='outside-slots' && first && !second) output=createOutsideAuditSlots(read(first));
  else if(mode==='check' && first && second) {
    const r=validateCompleted(read(first),read(second));
    output={format_valid:r.format_valid,production_save_verified:false};
  } else throw Error('Usage: worksheet context.json | outside-slots ranked-draft.json | check completed-payload.json context.json');
  console.log(JSON.stringify(output,null,2));
} catch(e) { console.error(e.message);process.exitCode=1; }
