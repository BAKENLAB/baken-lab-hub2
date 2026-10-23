import test from "node:test";
import assert from "node:assert/strict";
import { enrichPredictionNonBlocking } from "./optional-evidence.mjs";

const prediction = Object.freeze({
  runners: Object.freeze([
    Object.freeze({horse_no: 1, rank: 7, grade: "C", reason: "baseline"}),
    Object.freeze({horse_no: 2, rank: 3, grade: "A", reason: "baseline"}),
  ]),
  top5: Object.freeze([{horse_no:2, rank:3}]),
  eye: null,
});
const asOf = "2026-10-18T15:30:00+09:00";
const usable = {
  horse_no:1, kind:"training_comment",
  summary:"A trainer described an encouraging workout.",
  published_at:"2026-10-17T12:00:00+09:00",
  source_url:"https://example.com/article", verified:true, reuse_allowed:true,
};
function unchanged(v) {
  assert.strictEqual(v.prediction, prediction);
  assert.equal(v.optional_evidence_audit.used_for_score, false);
  assert.equal(v.optional_evidence_audit.used_for_rank, false);
  assert.equal(v.optional_evidence_audit.used_for_eye, false);
  assert.equal(v.prediction.runners[0].rank, 7);
  assert.equal(v.prediction.eye, null);
}

test("missing adapter is a successful no-op", async () => {
  const out=await enrichPredictionNonBlocking(prediction,{asOf});
  unchanged(out);
  assert.equal(out.optional_evidence_audit.status,"NOT_CONFIGURED");
});
test("invalid as-of skips enrichment, never permits hindsight", async () => {
  let called=false;
  const out=await enrichPredictionNonBlocking(prediction,{asOf:"bad",loadComments:()=>{called=true;return [];}});
  unchanged(out);
  assert.equal(called,false);
  assert.equal(out.optional_evidence_audit.status,"SKIPPED_INVALID_CUTOFF");
});
test("missing comments do not penalize a low-rank horse", async () => {
  const out=await enrichPredictionNonBlocking(prediction,{asOf,loadComments:async()=>[]});
  unchanged(out);
  assert.equal(out.optional_evidence_audit.status,"NOT_FOUND");
});
test("source error is isolated from baseline", async () => {
  const out=await enrichPredictionNonBlocking(prediction,{asOf,loadComments:async()=>{throw Error("source offline");}});
  unchanged(out);
  assert.equal(out.optional_evidence_audit.status,"SOURCE_ERROR");
});
test("optional source deadline aborts and falls back", async () => {
  let aborted=false;
  const out=await enrichPredictionNonBlocking(prediction,{asOf,timeoutMs:10,
    loadComments:({signal})=>new Promise(resolve=>{
      signal.addEventListener("abort",()=>{aborted=true;resolve([]);},{once:true});
    }),
  });
  unchanged(out);
  assert.equal(aborted,true);
  assert.equal(out.optional_evidence_audit.status,"SOURCE_TIMEOUT");
});
test("only permission-cleared verified historical sources accepted", async () => {
  const out=await enrichPredictionNonBlocking(prediction,{asOf,loadComments:async()=>[
    usable,
    {...usable,horse_no:3},
    {...usable,verified:false},
    {...usable,reuse_allowed:false},
    {...usable,published_at:"2026-10-19T12:00:00+09:00"},
    {...usable,source_url:"http://example.com"},
    {...usable,summary:""},
    {...usable,kind:"unknown"},
  ]});
  unchanged(out);
  assert.equal(out.optional_evidence_audit.status,"AVAILABLE");
  assert.equal(out.optional_evidence_audit.inspected,8);
  assert.equal(out.optional_evidence.length,1);
  assert.equal(out.optional_evidence[0].horse_no,1);
});
test("unverified-only sources are skipped, not a stop condition", async()=>{
  const out=await enrichPredictionNonBlocking(prediction,{asOf,loadComments:async()=>[
    {...usable,verified:false},
  ]});
  unchanged(out);
  assert.equal(out.optional_evidence_audit.status,"NO_VERIFIED_EVIDENCE");
});
test("optional extras cannot change TOP5/EYE or stored ability", async()=>{
  const before=JSON.stringify(prediction);
  const out=await enrichPredictionNonBlocking(prediction,{asOf,loadComments:async()=>[usable]});
  unchanged(out);
  assert.equal(JSON.stringify(prediction),before);
  assert.equal(out.optional_evidence[0].summary,usable.summary);
});
