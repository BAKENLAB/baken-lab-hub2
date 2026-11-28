import {readFileSync} from 'node:fs';
const ids=['IT48-01-sealed-same-flag','IT48-02-sealed-direct-reject','IT48-03-eye-semantic','IT48-04-current-grades','IT48-05-advantage-recovery','IT48-06-ab-witness','IT48-07-missing-local','IT48-08-peer-change','IT48-09-root-id-unique'];
const log=readFileSync(process.argv[2],'utf8'),exit=Number(process.argv[3]);
const summary=log.split('\n').flatMap(s=>{try{const x=JSON.parse(s);return x.schema==='MAIN48_INDEPENDENT_PROBE'?[x]:[]}catch{return []}}).at(-1);
const records=ids.map(id=>{const r=summary?.rows?.find(r=>r.id===id);return r?{...r,classification:r.status==='PASS'?'PASS':'FAIL_OR_CAUGHT_ERROR',note:r.status==='FAIL'?'Original probe catches exceptions without error type; review error message before declaring assertion failure.':''}:{id,classification:'NOT_EXECUTED_OR_NO_RECEIPT'}});
console.log(JSON.stringify({schema:'MAIN48_ORIGINAL_RECEIPT_V1',exit,records,complete:!!summary,counts:Object.fromEntries(['PASS','FAIL_OR_CAUGHT_ERROR','NOT_EXECUTED_OR_NO_RECEIPT'].map(k=>[k,records.filter(r=>r.classification===k).length]))},null,2));
if(!summary)process.exitCode=2;
