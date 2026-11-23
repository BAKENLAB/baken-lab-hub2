// Reads no results. Distinguishes numeric replay from absent raw-input evidence.
import fs from 'node:fs';import {recoveredDiagnosis,AXES} from '../../../automation/jra-score-ledger/recovered-diagnosis.mjs';
import {proposedAggregate} from '../../../automation/jra-score-ledger/proposed-aggregate.mjs';
const records=JSON.parse(fs.readFileSync(new URL('../observations/nov21-afternoon-extract.json',import.meta.url)));
const rows=records.flatMap(r=>r.payload.runners.map(h=>({race:[r.race_date,r.track,r.race_no].join('/'),horse_no:h.horse_no,missing_axes:AXES.filter(k=>h[k]===undefined)})));
const vectors=[];for(const segment of ['NEW','MAIDEN','CLASS1','CLASS2_3','OPEN_GRADED','STANDARD','UNKNOWN',null])for(const a of [['70.1','60.2','50.3','40.4','30.5'],['80',null,'65.55',null,'0.2'],[null,null,null,null,null],['2','2','2','2','2'],['100','100','100','100','100']])for(const rest of [120,121]){
 const x={segment,axes:Object.fromEntries(AXES.map((k,i)=>[k,a[i]])),class_delta:1,days_since_last:rest};const old=recoveredDiagnosis(x);let proposed=null;
 try{proposed=proposedAggregate(x);}catch{}
 vectors.push({segment,inputs:a,days_since_last:rest,recovered:old.diagnostic_value,proposed:proposed?.score??null,accepted:!!proposed,changed:!!proposed&&proposed.score!==old.diagnostic_value});
}
const summary={schema:'JRA_CORE_RECOVERY_COMPARISON_V1',historical_races:records.length,historical_horses:rows.length,
 historical_complete_five_axis_inputs:rows.filter(x=>!x.missing_axes.length).length,
 historical_official_formula_reproduced:false,historical_approved_rubric_regression:'UNVERIFIED_MISSING_FIVE_AXIS_INPUT_AND_PROVENANCE',
 synthetic_vectors:vectors.length,synthetic_proposal_accepted:vectors.filter(x=>x.accepted).length,
 synthetic_proposal_rejected:vectors.filter(x=>!x.accepted).length,synthetic_value_changes:vectors.filter(x=>x.changed).length,
 synthetic_vectors_are_accuracy_evidence:false,future_race_comparisons:0,production_allowed:false,vectors,missing_by_horse:rows};
const output=process.argv[2];if(!output)throw Error('OUTPUT_REQUIRED');fs.writeFileSync(output,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).filter(([k])=>!['vectors','missing_by_horse'].includes(k))),null,2));
