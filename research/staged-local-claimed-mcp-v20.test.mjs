import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=readFileSync(new URL('./staged-local-claimed-mcp-v20.ts',import.meta.url),'utf8');
const prior=readFileSync(new URL('./local-claimed-prod-guard-v19.mjs',import.meta.url),'utf8');

test('targeted rescue handles exactly three verified rejected job identities',()=>{
 const jobs=[...file.matchAll(/\{id:"([0-9a-f-]{36})",worker:"([^"]+)",race_date:"(\d{4}-\d{2}-\d{2})",track:"([^"]+)",race_no:(\d+),error:"([^"]+)"\}/g)]
  .map(x=>({id:x[1],worker:x[2],date:x[3],track:x[4],race:+x[5],code:x[6]}));
 assert.deepEqual(jobs,[
  {id:'0d99a3a5-ace4-4c51-b0e3-5337df1300e6',worker:'LOCAL_QUEUE_KANTO',date:'2026-11-02',track:'船橋',race:9,code:'LOCAL_EYE_SELECTION_MISMATCH'},
  {id:'83cf4e54-ccb0-4995-bcc6-2728518be7e1',worker:'LOCAL_QUEUE_HOKKAIDO_TOHOKU',date:'2026-11-08',track:'盛岡',race:4,code:'LOCAL_EYE_MARKET_EVIDENCE'},
  {id:'0e833929-c3d6-48c9-80fd-1f9a86480f7b',worker:'LOCAL_QUEUE_KANTO',date:'2026-11-09',track:'川崎',race:1,code:'LOCAL_EYE_CHECK_EVIDENCE'}
 ]);
 assert.equal(file.includes('KNOWN_FAILED_JOB.id'),false);
 assert.match(file,/result\.claimed && result\.job_id===x\.id && input\.worker_id===x\.worker/);
 assert.match(file,/job\.race_date!==rejected\.race_date\|\|job\.track!==rejected\.track\|\|job\.race_no!==rejected\.race_no/);
});
test('terminal action uses only original authorized worker run and claim token, never stores refused payload',()=>{
 assert.match(file,/const live=await claim\(c,job_id\)/);
 assert.match(file,/p_run_id:live\.r\.id,p_job_id:live\.j\.id,p_claim_token:live\.j\.claim_token/);
 assert.match(file,/p_outcome:"DEAD",p_error:code/);
 assert.match(file,/prediction_status/);
 assert.match(file,/field_status/);
 assert.match(file,/Date\.parse\(races\[0\]\.post_time\)>Date\.now\(\)\+180000/);
 assert.match(file,/if\(pe\|\|existing\?\.length\)throw Error\("QUEUE_STATE_UNAVAILABLE"\)/);
 assert.match(file,/await closeFailedClaim\(c,result\.job_id,rejected\.error\);/);
 assert.match(file,/result=await queueNext\(input,\{client:c\}\);/);
});
test('normal official save and refusal guards remain intact',()=>{
 assert.match(file,/assertLocalSaveDuringTransition\(\{circuit:"LOCAL",protocol_version,payload\}\)/);
 assert.match(file,/const result=await queueSave\(\{job_id,protocol_version,payload,original_payload\}/);
 assert.match(file,/await auth\(\)/);
 assert.ok(prior.includes('MARKET_EVIDENCE'));
 assert.equal(file.includes('update({job_status:"DEAD"'),false);
 assert.equal(file.includes('from("official_predictions").insert('),false);
});

test('future guard refusals include CHECK_EVIDENCE in the terminal whitelist',()=>{
 assert.match(file,/TERMINAL_EYE_CODES=new Set\(\[[^\]]*"LOCAL_EYE_CHECK_EVIDENCE"/);
});
