import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file = new URL("./local16-20261116-frozen-anchors.json", import.meta.url);
const data = JSON.parse(readFileSync(file,"utf8"));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha256 = /^[0-9a-f]{64}$/;
const allowed = ["大井","水沢","金沢"];
const protocol = "CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013";

test("Nov 16 baseline is 30 immutable official FROZEN anchors, 323 horses",()=>{
  assert.equal(data.schema,"LOCAL16_REFERENCE_FROZEN_ANCHORS_V1");
  assert.equal(data.scope.race_date,"2026-11-16");
  assert.equal(data.scope.circuit,"LOCAL");
  assert.equal(data.scope.protocol_version,protocol);
  assert.equal(data.anchors.length,30);
  assert.equal(data.anchors.reduce((s,x)=>s+x.runner_count,0),323);
  assert.equal(data.anchors.reduce((s,x)=>s+x.reason_pairwise_runners,0),238);
  assert.equal(data.source.table,"public.official_predictions");
});
test("all anchors have unique race keys, officially identifiable immutable payload fingerprints",()=>{
 const races=new Set(),ids=new Set();
 for(const x of data.anchors){
  assert.equal(x.race_date,"2026-11-16");
  assert.ok(allowed.includes(x.track));
  assert.ok(Number.isInteger(x.race_no)&&x.race_no>=1&&x.race_no<=14);
  assert.equal(x.protocol_version,protocol);
  assert.match(x.official_prediction_id,uuid);
  assert.match(x.frozen_jst,/^2026-11-16T\d{2}:\d{2}:\d{2}\.\d{3}$/);
  assert.match(x.payload_pg_sha256,sha256);
  assert.ok(x.runner_count>=5&&x.runner_count<=20);
  assert.ok(x.official_head_to_head_count>=0);
  assert.ok(x.reason_pairwise_runners<=x.runner_count);
  const key=x.track+"|"+x.race_no;
  assert.ok(!races.has(key));
  assert.ok(!ids.has(x.official_prediction_id));
  races.add(key);ids.add(x.official_prediction_id);
 }
 for(const track of data.scope.tracks){
  const r=data.anchors.filter(x=>x.track===track.track);
  assert.equal(r.length,track.races);
  assert.equal(r.reduce((s,x)=>s+x.runner_count,0),track.runners);
 }
});
test("baseline anchors contain no target finishers, market, or claim credentials",()=>{
 const prohibited=/\b(?:finishers|official_results|claim_token|service_role|access_token|odds|payout|market_price)\b/i;
 assert.doesNotMatch(JSON.stringify(data.anchors),prohibited);
 assert.match(data.source.digest_definition,/sha256/);
});
test("handoff-independent method explicitly separates saved evidence from scoring certification",()=>{
 const doc=readFileSync(new URL("../docs/BAKEN_LAB_LOCAL16_20261116_METHOD.md",import.meta.url),"utf8");
 for(const marker of ["30R・323頭","直接対戦","その後に","lab_rank_repro_preflight","既存FROZEN変更","未完了"]){
   assert.ok(doc.includes(marker),marker);
 }
});
