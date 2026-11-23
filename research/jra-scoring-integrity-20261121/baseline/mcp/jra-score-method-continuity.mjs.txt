// Research-only prospective method-continuity guard. This is NOT a
// fact-to-score generator, official-evidence verifier or production approval.
// approvedMethod must be operator-pinned server configuration, never payload data.
export function inspectScoreMethodContinuity({ payload, approvedMethod } = {}) {
  const audit = payload?.audit;
  const submitted = audit?.score_method;
  if (typeof submitted !== 'string' || !submitted.trim())
    return { ok: false, reason: 'SCORE_METHOD_MISSING', score_reproduced: false };
  if (typeof approvedMethod !== 'string' || !approvedMethod.trim())
    return { ok: false, reason: 'TRUSTED_METHOD_PIN_UNAVAILABLE', score_reproduced: false };
  if (submitted !== approvedMethod)
    return { ok: false, reason: 'SCORE_METHOD_DRIFT', score_reproduced: false };
  if (audit?.full_depth_comparison !== true)
    return { ok: false, reason: 'FULL_DEPTH_COMPARISON_NOT_DECLARED', score_reproduced: false };
  return {
    ok: true, reason: 'DECLARED_METHOD_MATCHES_PIN_ONLY',
    score_reproduced: false, official_original_verified: false,
    authorized_claim_provenance_verified: false,
    formal_scoring_allowed: false
  };
}
