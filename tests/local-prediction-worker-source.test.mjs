import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../supabase/functions/local-prediction-worker/index.ts", import.meta.url),
  "utf8",
);

test("backend LOCAL worker keeps guarded queue boundaries", () => {
  assert.match(source, /lab_queue_claim_next_v1/);
  assert.match(source, /lab_queue_save_prediction_v1/);
  assert.match(source, /lab-claimed-context/);
  assert.doesNotMatch(source, /\.from\(["']official_predictions["']\)\.(?:insert|update|upsert|delete)/);
});

test("backend LOCAL worker has no committed API secret", () => {
  assert.match(source, /openai_local_prediction_key/);
  assert.match(source, /local_prediction_worker_key/);
  assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]{20,}/);
});

test("backend LOCAL worker preserves LOCAL 1.5 and market separation", () => {
  assert.match(source, /CHAPPY_LOCAL_1\.5_EYE_COMPARISON_20261004/);
  assert.match(source, /SUSPENDED_FOR_ABILITY_STABILITY/);
  assert.match(source, /CURRENT_UPSIDE_OVER_BASELINE/);
  assert.match(source, /market_used_for_ranking=false/);
  assert.match(source, /rank6_auto_selected=false/);
  assert.match(source, /assertLocalSaveDuringTransition/);
});

test("backend LOCAL worker uses Responses API and one-job request shape", () => {
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(source, /reasoning:\s*\{ effort: "high" \}/);
  assert.match(source, /store:\s*false/);
  assert.doesNotMatch(source, /max_jobs/);
});
