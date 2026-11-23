// Produces deterministic mathematical fixtures only; no race/model/DB connection.
import fs from 'node:fs';import {recoveredDiagnosis,AXES} from '../automation/jra-score-ledger/recovered-diagnosis.mjs';
const rows=[];for(const segment of ['NEW','MAIDEN','CLASS1','CLASS2_3','OPEN_GRADED','STANDARD','UNKNOWN',null])for(const a of [ ['70.1','60.2','50.3','40.4','30.5'],['80',null,'65.55',null,'0.2'],[null,null,null,null,null],['2','2','2','2','2'],['100','100','100','100','100']])for(const rest of [120,121]){
 const axes=Object.fromEntries(AXES.map((k,i)=>[k,a[i]]));const v={segment,axes,class_delta:1,days_since_last:rest};rows.push({...v,expected:recoveredDiagnosis(v).exact});
}
fs.writeFileSync(process.argv[2],JSON.stringify(rows));console.log('Generated synthetic SQL cross-check vectors:',rows.length);
