import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const edge=readFileSync('research/staged-lab-local-corner-preclaim-v4-index.ts','utf8');
const workflow=readFileSync('automation/local-official-preclaim-workflow.mjs','utf8');
const adapter=readFileSync('automation/nar-official-corner-acquisition.mjs','utf8');
const prefetch=readFileSync('automation/nar-corner-prefetch.mjs','utf8');

test('only authorized service-role caller can request an exact LOCAL preclaim race',()=>{
 assert.match(edge,/req\.method!=='POST'/);
 assert.match(edge,/req\.headers\.get\('authorization'\)!=='Bearer '\+serviceKey/);
 assert.match(edge,/Object\.keys\(input\)\.length!==4/);
 assert.match(edge,/input\.intent!=='AUTHORIZED_PRECLAIM_RESEARCH'/);
 assert.match(edge,/!trk\.has\(input\.track\)/);
 assert.match(edge,/input\.race_date!==jstDate/);
 assert.match(edge,/data\[0\]\.field_status!=='READY'/);
 assert.match(edge,/PRECLAIM_OFFICIAL_READY_REQUIRED/);
 assert.match(edge,/PRECLAIM_DEBUT_OUT_OF_SCOPE/);
});
test('MCP client has 85s outer deadline and service code 75s inner deadline',()=>{
 assert.match(edge,/maxOperationMs:75000/);
 assert.match(workflow,/maxOperationMs=75000/);
 assert.match(workflow,/maxOperationMs>80000/);
 assert.match(workflow,/const finishReadBy=operationStop-2500/);
 assert.match(workflow,/status:'SKIPPED_OPERATION_BUDGET'/);
 assert.match(workflow,/status:'SKIPPED_DEADLINE'/);
});
test('shared deadline reaches every official history page, never just single page',()=>{
 assert.match(workflow,/absoluteDeadlineMs:finishReadBy/);
 assert.match(adapter,/absoluteDeadlineMs=null/);
 assert.match(adapter,/clock,absoluteDeadlineMs/);
 assert.match(prefetch,/absoluteDeadlineMs=null/);
 assert.match(prefetch,/absoluteDeadlineMs-clock\(\)/);
 assert.match(prefetch,/SKIPPED_OPERATION_BUDGET/);
 assert.match(prefetch,/const remaining=Math\.min\(postBudget,operationBudget\)/);
 assert.match(prefetch,/Math\.min\(timeoutMs,remaining\)/);
});
test('time limit cannot skip the final authenticated snapshot write guard',()=>{
 const src=workflow.slice(workflow.indexOf('const targetRace='),workflow.length);
 const risk=src.indexOf('if(operationStop-clock()<=1500)');
 const append=src.indexOf('const saved=await stageLocalCornerSnapshot');
 assert.ok(risk>=0&&append>risk);
 assert.match(src,/post-clock\(\)<=reserveMs/);
 assert.match(src,/saved\.inserted/);
 assert.match(edge,/stored:Boolean\(result\.storeWritten\)/);
});
test('no auto-claim, post-race save, direct prediction mutation or odds capability',()=>{
 assert.doesNotMatch(edge,/\b(?:from|into)\(['"]official_predictions['"]\)/);
 assert.doesNotMatch(edge,/\bcron\b/i);
 assert.doesNotMatch(edge,/lab_queue_claim_next|lab_save_claimed_prediction/);
 assert.doesNotMatch(workflow,/official_market|market_odds|payouts|odds|popularity/);
 assert.match(edge,/claim_started:false,prediction_saved:false/);
});
test('deployed v4 source remains server-only with explicit imports',()=>{
 assert.match(edge,/v4 deployed to Supabase ACTIVE/);
 assert.match(edge,/createLocalCornerServiceRpcStore/);
 assert.match(edge,/runAuthorizedLocalCornerPreclaim/);
 assert.match(edge,/prepareLocalOfficialCornerPacket/);
});
