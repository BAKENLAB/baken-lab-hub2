import { collectDeclaredLedger } from '../../../automation/jra-score-ledger/declared-ledger.mjs';
import { checkDeclaredLedger } from '../../../automation/jra-score-ledger/independent-check.mjs';

// Bound IDs and checklist must originate from the server's selected snapshot / protocol.
export function auditSubmission(payload, selected) {
  const ledger = collectDeclaredLedger({payload});
  const arithmetic = checkDeclaredLedger({ledger,payload,officialActive:selected.activeRunners});
  const findings = [...arithmetic.errors];
  // The payload's numeric components can be internally consistent while its
  // score-generation method disappears or changes. Only server-owned policy
  // may pin a trusted method; never accept a claimed pin from the payload.
  const declaredMethod = payload?.audit?.score_method;
  if (typeof declaredMethod !== 'string' || !declaredMethod.trim())
    findings.push({code:'SCORE_METHOD_MISSING'});
  else if (typeof selected.trustedScoreMethod !== 'string' ||
      !selected.trustedScoreMethod.trim() || declaredMethod !== selected.trustedScoreMethod)
    findings.push({code:'SCORE_METHOD_UNPINNED_OR_DRIFTED'});
  if (payload?.audit?.full_depth_comparison !== true)
    findings.push({code:'FULL_DEPTH_COMPARISON_UNDECLARED'});
  if (!Array.isArray(selected.activeRunners)) findings.push({code:'ACTIVE_FIELD_UNVERIFIED'});
  for (const runner of ledger.runners) {
    for (const effect of runner.components) {
      const refs = selected.factorBindings?.filter(b => b.horse_no === runner.horse_no &&
        b.source_ref === effect.source_ref && b.kind === effect.kind && b.verified === true);
      if (refs?.length !== 1 || !selected.rows.some(row =>
        row.documentId === refs[0].documentId && row.runId === refs[0].runId))
        findings.push({code:'FACTOR_PROOF_UNVERIFIED',horse_no:runner.horse_no,kind:effect.kind});
    }
  }
  const keys = selected.eyeChecklist;
  const officialKeys = Array.isArray(keys) && keys.length === 17 && new Set(keys).size === 17 &&
    keys.every(k=>typeof k === 'string' && k.trim());
  if (!officialKeys) findings.push({code:'EYE_CHECKLIST_UNAVAILABLE'});
  const reviews = payload.audit?.eye_review ?? [];
  for (const runner of ledger.runners.filter(r => r.rank > 5)) {
    const rows = Array.isArray(reviews) ? reviews.filter(r=>r.horse_no===runner.horse_no) : [];
    if (!officialKeys || rows.length !== 1 || !keys.every(k =>
      typeof rows[0].review_checks?.[k]?.reason === 'string' && rows[0].review_checks[k].reason.trim()))
      findings.push({code:'EYE_REVIEW_INCOMPLETE',horse_no:runner.horse_no});
  }
  return {arithmeticOK:arithmetic.ok, findings, formalScoringAllowed:false};
}
