import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const staged=readFileSync(new URL('./staged-local-preclaim-edge-index.ts',import.meta.url),'utf8');
test('manual preclaim endpoint requires backend service role and explicit intent',()=>{
 for(const gate of [
  "req.headers.get('authorization')!=='Bearer '+serviceKey",
  "Object.keys(input).length!==4",
  "input.intent!=='AUTHORIZED_PRECLAIM_RESEARCH'",
  "type.startsWith('application/json')",
  "bytes>1024",
  ".eq('circuit','LOCAL')",
  "createNarOfficialReader({now})",
  "prepareCorners:prepareLocalOfficialCornerPacket",
  "runAuthorizedLocalCornerPreclaim"
 ])assert.ok(staged.includes(gate),'missing gate '+gate);
});
test('manual preclaim endpoint cannot contain claim, save, timer or market integrations',()=>{
 assert.ok(!/lab_queue_claim_next_v2|lab_save_claimed_prediction|cron\.schedule|official_predictions|race_odds/i.test(staged));
 assert.ok(staged.includes("claim_started:false,prediction_saved:false"));
 assert.ok(staged.includes("status:result.status"));
});
