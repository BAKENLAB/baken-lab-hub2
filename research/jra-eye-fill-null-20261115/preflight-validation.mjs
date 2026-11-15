import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {buildEyeAdditionalAudit} from '../../automation/jra-eye-additional-audit.mjs';
import {applyEyeFillNull} from '../../automation/jra-eye-fill-null.mjs';
const dir=new URL('./',import.meta.url),raw=readFileSync(new URL('real-preflight-input.json',dir),'utf8'),input=JSON.parse(raw);
assert.equal(input.capture_mode,'READ_ONLY_PREFLIGHT_NOT_AUTHORIZED_CLAIM');assert.ok(Date.parse(input.captured_at)<Date.parse(input.race.post_time)-180000);
const field=input.race.field_payload,official=field.runners.filter(r=>r.status==='ACTIVE');assert.equal(field.official_status_verification.verified,true);
assert.equal(official.length,input.runner_history.length);assert.ok(official.every(r=>input.runner_history.filter(h=>h.horse_no===r.horse_no&&h.horse_name===r.horse_name).length===1));
const packet=buildEyeAdditionalAudit({race:{...input.race,...field.race},runnerHistory:input.runner_history,observedAt:input.captured_at});
assert.equal(packet.runners.length,official.length);assert.equal(packet.candidates.length,0);assert.equal(packet.finalized_rank_used,false);assert.equal(packet.target_result_used,false);
assert.ok(packet.runners.every(r=>r.all_verified_runs.every(h=>h.race_date<input.race.race_date)));
const old=JSON.parse(readFileSync(new URL('../jra-eye-turf-audit-20261115/comparison-input.json',dir),'utf8'));
let preserved=0;for(const race of old.frozen){if(!race.eye)continue;const p={eye:race.eye,audit:{},runners:race.runners,top5:race.top5};const x=applyEyeFillNull({context:{race:{field_payload:{race:{surface:race.surface,distance:race.distance}}}},payload:p,observedAt:input.captured_at});assert.equal(x.payload,p);preserved++;}
const report={status:'PASS_BOUNDED_PREFLIGHT_NOT_END_TO_END',race:{date:input.race.race_date,track:input.race.track,race_no:input.race.race_no,post_time:input.race.post_time},captured_at:input.captured_at,input_sha256:createHash('sha256').update(raw).digest('hex'),source:'Current production normalized merged four-history SELECT; same expression as claimed_context. No job CLAIM and no prediction generated.',active_verified_count:official.length,feature_review_count:packet.runners.length,source_asof_before_post:true,final_rank_available:false,candidate_selection_performed:false,formal_audits_performed:false,existing_eye_records_preserved:preserved,rank_changes:0,top5_changes:0,db_writes:0,
 limits:['This is not an authorized CLAIM context or save test.','No final live ranking or completed qualitative audit was supplied; no EYE was selected.','User-reported 105R rates cannot be reproduced without the corresponding locked input/evaluation artifacts.','15 previously available immutable inputs cannot establish whole-105R formal audit performance.']};
writeFileSync(new URL('preflight-validation.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
