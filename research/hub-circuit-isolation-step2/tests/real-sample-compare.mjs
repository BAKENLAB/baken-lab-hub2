import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runApi} from './api-harness.mjs';
const path=process.argv[2];if(!path)throw Error('Supply approved read-only exported sample JSON path');
const records=JSON.parse(readFileSync(path,'utf8'));
const before=JSON.stringify(records);const report={mode:'OFFLINE_READ_ONLY_REAL_SAMPLE_NOT_HTTP',cases:[],query_counts:{}};
for(const action of ['list','results']){
 const old=await runApi(true,{records},action),now=await runApi(false,{records},action);assert.equal(old.status,200);assert.equal(now.status,200);
 const {circuit_status,partial,...body}=now.body;assert.deepEqual(body,old.body);
 report.cases.push({action,status:'PASS',races:body.races?.length,results:body.results?.length,predictions:body.predictions?.length});report.query_counts[action]={baseline:old.calls.length,candidate:now.calls.length};
 for(const c of ['JRA','LOCAL']){const part=await runApi(false,{records},action,c);assert.equal(part.status,200);const field=action==='list'?'races':'results';assert.deepEqual(part.body[field],old.body[field].filter(x=>x.circuit===c))}
}
assert.equal(JSON.stringify(records),before);report.source_unchanged_sha256=createHash('sha256').update(before).digest('hex');report.frozen=records.official_predictions.map(p=>({id:p.id,circuit:p.circuit,payload_sha256:createHash('sha256').update(JSON.stringify(p.payload)).digest('hex')}));
console.log(JSON.stringify(report,null,2));
