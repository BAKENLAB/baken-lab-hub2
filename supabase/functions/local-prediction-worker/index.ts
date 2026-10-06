import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { assertLocalSaveDuringTransition } from "../local-claimed-mcp/local-eye.mjs";

const PROTOCOL = "CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004";
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const WORKERS = new Set([
  "LOCAL_QUEUE_WEST",
  "LOCAL_QUEUE_KANTO",
  "LOCAL_QUEUE_CHUBU",
  "LOCAL_QUEUE_HOKKAIDO_TOHOKU",
  "LOCAL_QUEUE_RESCUE",
]);
const MODELS = new Set(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
const CHECKS = [
  "distance_change","track_change","going_change","class_change","promotion_demotion",
  "weight_change","jockey_change","draw","running_style","pace_peers","margins",
  "passing_order","final_section","trouble","layoff_preparation",
  "current_suitability","same_condition_history",
];

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!url || !serviceKey) throw new Error("SERVER_CONFIGURATION_ERROR");

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
function safeCode(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const m = raw.match(/(?:LOCAL_EYE_[A-Z0-9_]+|SAVE_[A-Z0-9_]+|[A-Z][A-Z0-9_]{3,})/);
  return m?.[0] ?? "WORKER_FAILED";
}
async function secret(name: string) {
  const { data, error } = await db.rpc("lab_backend_secret_v1", { p_name: name });
  if (error || typeof data !== "string" || !data) throw new Error("SECRET_UNAVAILABLE");
  return data;
}
async function release(job: any, reason: string) {
  if (!job?.worker_run_id || !job?.id || !job?.claim_token) return;
  await db.rpc("lab_finish_prediction_job", {
    p_run_id: job.worker_run_id,
    p_job_id: job.id,
    p_claim_token: job.claim_token,
    p_outcome: "RETRY",
    p_error: reason.slice(0, 240),
    p_retry_seconds: 60,
    p_max_attempts: null,
  });
}
async function claim(worker_id: string) {
  const { data, error } = await db.rpc("lab_queue_claim_next_v1", { p_worker_id: worker_id });
  if (error) throw new Error("QUEUE_START_FAILED");
  if (!data?.claimed) return null;
  const { data: rows, error: readError } = await db
    .from("lab_prediction_jobs")
    .select("id,worker_run_id,claim_token,claimed_by,lease_until,job_status,race_date,track,race_no,circuit")
    .eq("id", data.job_id)
    .limit(2);
  if (readError || !rows || rows.length !== 1) throw new Error("CLAIM_UNAVAILABLE");
  const job = rows[0];
  if (job.job_status !== "CLAIMED" || job.claimed_by !== worker_id || job.circuit !== "LOCAL") {
    throw new Error("CLAIM_UNAVAILABLE");
  }
  return job;
}
async function context(job: any) {
  const res = await fetch(url + "/functions/v1/lab-claimed-context", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + serviceKey,
      apikey: serviceKey,
    },
    body: JSON.stringify({
      run_id: job.worker_run_id,
      job_id: job.id,
      claim_token: job.claim_token,
    }),
    signal: AbortSignal.timeout(35_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.ok !== true || !body?.context) throw new Error(body?.error ?? "CONTEXT_UNAVAILABLE");
  if (body.context.context_format !== "COMPACT_V1" ||
      body.context.field_integrity_checked !== true ||
      body.context.protocol_version !== PROTOCOL) {
    throw new Error("CONTEXT_CHANGED");
  }
  return body.context;
}
async function activeProtocol() {
  const { data, error } = await db
    .from("lab_prediction_protocols")
    .select("version,content")
    .eq("protocol_key", "LOCAL_MAIN")
    .eq("is_active", true)
    .limit(2);
  if (error || !data || data.length !== 1 || data[0].version !== PROTOCOL) {
    throw new Error("ACTIVE_PROTOCOL_REQUIRED");
  }
  return data[0];
}
function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["runners","top5","eye","bets","summary","bet_strategy","audit"],
    properties: {
      runners: { type: "array", minItems: 1, items: { type: "object" } },
      top5: { type: "array", minItems: 1, items: { type: "object" } },
      eye: { anyOf: [{ type: "object" }, { type: "null" }] },
      bets: { type: "array", maxItems: 0 },
      summary: {},
      bet_strategy: { type: "string" },
      audit: { type: "object" },
    },
  };
}
function instructions() {
  return `You are the BAKEN LAB LOCAL pre-race ability engine. Produce ONLY the requested JSON.
Never use popularity, odds, market data, betting value, or external tipsters in ability ranking or LAB EYE.
Freeze the original full-field ability rank before EYE. EYE never changes rank.
Sequence: all ACTIVE runners -> full rank -> S-F -> TOP5 ranks 1-5 -> re-audit EVERY runner outside TOP5 -> pairwise comparison -> EYE or null.
Copy each runner's running_style_reference exactly from context. Missing facts stay MISSING; never invent.
Top-level keys must be exactly runners,top5,eye,bets,summary,bet_strategy,audit.
bets must be []; bet_strategy must be SUSPENDED_FOR_ABILITY_STABILITY.
For fields of 6+ ACTIVE runners, eye_candidate_audit must contain every outside-TOP5 horse exactly once with EXACT keys horse_no,rank,upside_trigger,hidden_evidence,finish_path,risk,eye_case,evidence_refs,review_checks.
review_checks must contain exactly these 17 keys: distance_change, track_change, going_change, class_change, promotion_demotion, weight_change, jockey_change, draw, running_style, pace_peers, margins, passing_order, final_section, trouble, layoff_preparation, current_suitability, same_condition_history. Each value has exactly status,finding,evidence_refs. status is CHECKED or MISSING. CHECKED needs source refs; MISSING has [] and a concrete missing reason.
eye_pairwise_comparison must contain every unordered pair outside TOP5 exactly once with exact keys horse_nos,preferred_horse_no,criterion,reason,evidence_refs. criterion is CURRENT_UPSIDE_OVER_BASELINE. If preferred_horse_no is non-null, that horse's eye_case must be true. Pair evidence_refs must link evidence from both compared candidates.
Do not auto-select rank 6. Select EYE only when exactly one eye_case=true candidate is preferred over every other outside-TOP5 horse. Otherwise eye=null and audit.eye_selected_rank=null plus a concrete audit.eye_abstention_reason.
Required audit flags: all_runners_checked=true, market_used_for_ranking=false, field_integrity_checked=true, protocol_version=CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004, execution_profile=UNIFIED_LOCAL_ABILITY_V1, outside_top5_reaudited=true for 6+ runners, eye_reaudit_guard=EYE_REAUDIT_GUARD_20260929, rank6_auto_selected=false, eye_audit_specificity_guard=true, market_used_for_eye=false, eye_selection_method=LOCAL_EYE_COMPARISON_V1, active_runner_nos, runner_evidence_audit, eye_pool_checked, eye_candidate_audit, eye_pairwise_comparison, eye_selected_rank.
Each runner must include horse_no,horse_name,rank,grade,reason,running_style_reference,recent_runs_checked,evidence_summary,missing_items. Use concrete pre-race evidence from supplied context only.`;
}
function outputText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text) return response.output_text;
  for (const item of response?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const part of item?.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  throw new Error("MODEL_OUTPUT_MISSING");
}
async function generate(openaiKey: string, model: string, ctx: any, protocol: any, repair?: string) {
  const input = {
    protocol_version: protocol.version,
    protocol: protocol.content,
    context: ctx,
    validator_feedback: repair ?? null,
  };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + openaiKey,
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "high" },
      max_output_tokens: 24_000,
      prompt_cache_key: "baken-local-" + protocol.version,
      instructions: instructions(),
      input: JSON.stringify(input),
      text: {
        format: {
          type: "json_schema",
          name: "baken_local_prediction",
          strict: false,
          schema: schema(),
        },
      },
    }),
    signal: AbortSignal.timeout(125_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error("MODEL_REQUEST_FAILED");
  let payload: any;
  try { payload = JSON.parse(outputText(body)); } catch { throw new Error("MODEL_JSON_INVALID"); }
  return payload;
}
async function predict(openaiKey: string, model: string, ctx: any, protocol: any) {
  let payload = await generate(openaiKey, model, ctx, protocol);
  try {
    assertLocalSaveDuringTransition({ circuit: "LOCAL", protocol_version: PROTOCOL, payload });
    return payload;
  } catch (e) {
    const code = safeCode(e);
    payload = await generate(openaiKey, model, ctx, protocol, code);
    assertLocalSaveDuringTransition({ circuit: "LOCAL", protocol_version: PROTOCOL, payload });
    return payload;
  }
}
async function save(job: any, payload: any) {
  const { data, error } = await db.rpc("lab_queue_save_prediction_v1", {
    p_job_id: job.id,
    p_user_id: ACTOR_ID,
    p_protocol_version: PROTOCOL,
    p_payload: payload,
    p_original_payload: payload,
  });
  if (error || data?.ok !== true || !data?.prediction_id) throw new Error("SAVE_REJECTED");
  const { data: rows, error: verifyError } = await db
    .from("official_predictions")
    .select("id,status,protocol_version")
    .eq("id", data.prediction_id)
    .limit(2);
  if (verifyError || !rows || rows.length !== 1 || rows[0].status !== "FROZEN" ||
      rows[0].protocol_version !== PROTOCOL) throw new Error("SAVE_VERIFY_FAILED");
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "POST_REQUIRED" });
  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "INVALID_REQUEST" }); }
  const worker_id = body?.worker_id;
  const model = body?.model ?? "gpt-5.6-sol";
  if (!WORKERS.has(worker_id) || !MODELS.has(model)) return json(400, { ok: false, error: "INVALID_REQUEST" });

  try {
    const expected = await secret("local_prediction_worker_key");
    if (req.headers.get("x-lab-worker-key") !== expected) return json(401, { ok: false, error: "UNAUTHORIZED" });

    const openaiKey = await secret("openai_local_prediction_key");
    const job = await claim(worker_id);
    if (!job) return json(200, { ok: true, claimed: false });

    try {
      const ctx = await context(job);
      const protocol = await activeProtocol();
      const payload = await predict(openaiKey, model, ctx, protocol);
      const result = await save(job, payload);
      return json(200, {
        ok: true,
        claimed: true,
        race: { race_date: job.race_date, track: job.track, race_no: job.race_no },
        prediction_id: result.prediction_id,
        already_saved: result.already_saved,
        model,
      });
    } catch (e) {
      const code = safeCode(e);
      await release(job, code).catch(() => undefined);
      return json(409, {
        ok: false,
        claimed: true,
        race: { race_date: job.race_date, track: job.track, race_no: job.race_no },
        error: code,
      });
    }
  } catch (e) {
    return json(500, { ok: false, error: safeCode(e) });
  }
});
