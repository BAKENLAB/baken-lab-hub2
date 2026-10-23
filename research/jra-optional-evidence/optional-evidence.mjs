/**
 * BAKEN LAB - JRA optional comment evidence (research only).
 *
 * This module NEVER selects horses, changes scores, updates FROZEN,
 * calls a network/API, or blocks the base prediction on optional data.
 * Integrators supply a permitted, read-only loadComments adapter.
 */
const VALID_KINDS = new Set([
  "pre_race_comment", "post_race_comment", "training_comment",
  "stewards_report", "manual_observation",
]);
const TIMEOUT = Symbol("OPTIONAL_EVIDENCE_TIMEOUT");

function result(prediction, status, evidence = [], inspected = 0) {
  return {
    prediction, // Intentionally the unchanged original, not a reconstructed payload.
    optional_evidence: evidence,
    optional_evidence_audit: {
      status, inspected, accepted: evidence.length,
      used_for_score: false, used_for_rank: false, used_for_eye: false,
      nonblocking: true,
    },
  };
}

function validTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function cleanEvidence(item, allowedHorseNos, cutoff) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  if (!allowedHorseNos.has(item.horse_no) || !VALID_KINDS.has(item.kind)) return null;
  const published = validTime(item.published_at);
  if (published === null || published > cutoff) return null; // Strict as-of firewall.
  if (item.verified !== true || item.reuse_allowed !== true) return null;
  if (typeof item.summary !== "string" || !item.summary.trim()
    || item.summary.length > 280) return null;
  if (typeof item.source_url !== "string") return null;
  try {
    const url = new URL(item.source_url);
    if (url.protocol !== "https:") return null;
  } catch { return null; }
  return Object.freeze({
    horse_no: item.horse_no, kind: item.kind,
    summary: item.summary.trim(), published_at: item.published_at,
    source_url: item.source_url, verified: true,
    // This is original analytical summary, not a copied article body.
  });
}

/**
 * Attach only attributable, pre-publication-cutoff evidence.
 *
 * loadComments({ prediction, asOf, signal }) => Promise<Array<item>|null>
 *
 * The adapter is OPTIONAL. Missing, empty, malformed, slow, or failing
 * additional sources NEVER change prediction or make this call fail.
 * Any actual loader must be rights-compliant and handle AbortSignal.
 */
export async function enrichPredictionNonBlocking(prediction, {
  loadComments,
  asOf,
  timeoutMs = 800,
  maxComments = 12,
} = {}) {
  // Validation of the base prediction itself remains the caller's job.
  // An absent/invalid cutoff is fail-closed for enrichment, not for scoring.
  const cutoff = validTime(asOf);
  if (cutoff === null) return result(prediction, "SKIPPED_INVALID_CUTOFF");
  if (typeof loadComments !== "function") return result(prediction, "NOT_CONFIGURED");

  const limit = Number.isFinite(timeoutMs)
    ? Math.max(10, Math.min(2000, Math.floor(timeoutMs))) : 800;
  const cap = Number.isInteger(maxComments)
    ? Math.max(0, Math.min(40, maxComments)) : 12;
  const controller = new AbortController();
  let handle;
  const deadline = new Promise(resolve => {
    handle = setTimeout(() => {
      controller.abort();
      resolve(TIMEOUT);
    }, limit);
  });
  let raw;
  try {
    raw = await Promise.race([
      Promise.resolve().then(() => loadComments({
        prediction, asOf, signal: controller.signal,
      })),
      deadline,
    ]);
  } catch {
    return result(prediction, "SOURCE_ERROR");
  } finally {
    clearTimeout(handle);
  }
  if (raw === TIMEOUT) return result(prediction, "SOURCE_TIMEOUT");
  if (!Array.isArray(raw) || raw.length === 0) return result(prediction, "NOT_FOUND");
  const horses = new Set(
    (Array.isArray(prediction?.runners) ? prediction.runners : [])
      .map(r => r?.horse_no).filter(Number.isInteger)
  );
  const evidence = [];
  for (const item of raw.slice(0, 100)) {
    if (evidence.length >= cap) break;
    const checked = cleanEvidence(item, horses, cutoff);
    if (checked) evidence.push(checked);
  }
  return result(prediction, evidence.length ? "AVAILABLE" : "NO_VERIFIED_EVIDENCE", evidence, raw.length);
}
