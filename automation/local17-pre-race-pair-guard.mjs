/** Read-only eligibility gate for independent LOCAL 1.7 vs 1.6 comparisons.
 * No database access, no prediction writes, no model switching.
 * Receipts must come from an external immutable capture mechanism.
 * A SHA256 digest alone does not establish immutability.
 */
import { createHash } from 'node:crypto';
const validTime = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && /(?:Z|[+-]\d\d:\d\d)$/.test(v);
const number = v => Number.isInteger(v) && v > 0;
export const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function checkLocal17Pair({baseline,shadow,result}) {
  if (!baseline || !shadow || !result) return {eligible:false,reason:'MISSING_PAIR_OR_RESULT'};
  if (baseline.model !== 'LOCAL1.6' || shadow.model !== 'LOCAL1.7') return {eligible:false,reason:'WRONG_MODEL'};
  const keys=['race_date','track','race_no'];
  if (keys.some(k=>baseline[k]!==shadow[k] || baseline[k]!==result[k])) return {eligible:false,reason:'RACE_MISMATCH'};
  if (![baseline.post_time,baseline.frozen_at,shadow.captured_at,shadow.as_of,result.settled_at].every(validTime)) return {eligible:false,reason:'INVALID_TIMESTAMP'};
  const post=Date.parse(baseline.post_time);
  if (!(Date.parse(baseline.frozen_at)<post && Date.parse(shadow.captured_at)<post && Date.parse(shadow.as_of)<=Date.parse(shadow.captured_at) && Date.parse(result.settled_at)>=post)) return {eligible:false,reason:'AS_OF_OR_SETTLEMENT_VIOLATION'};
  if (baseline.status!=='FROZEN' || shadow.status!=='FROZEN' || result.source!=='NAR_OFFICIAL_RACEMARK') return {eligible:false,reason:'UNVERIFIED_SOURCE_OR_STATUS'};
  if (shadow.receipt?.capture_sha256!==digest(shadow.capture)) return {eligible:false,reason:'SHADOW_DIGEST_MISMATCH'};
  if (!shadow.receipt?.immutable_storage_ref || !shadow.receipt?.captured_before_post_verified) return {eligible:false,reason:'NO_INDEPENDENT_IMMUTABLE_RECEIPT'};
  if (shadow.capture?.evidence_as_of!==shadow.as_of || shadow.capture?.race_date!==baseline.race_date || shadow.capture?.track!==baseline.track || shadow.capture?.race_no!==baseline.race_no) return {eligible:false,reason:'EVIDENCE_RACE_OR_TIME_MISMATCH'};
  const a=baseline.active_horse_nos,b=shadow.capture?.active_horse_nos,order=shadow.capture?.full_order;
  if (!Array.isArray(a)||!Array.isArray(b)||!Array.isArray(order)||a.length<2||a.some(n=>!number(n))||new Set(a).size!==a.length||a.length!==b.length||a.length!==order.length||!a.every(n=>b.includes(n)&&order.includes(n))||new Set(order).size!==order.length) return {eligible:false,reason:'INCOMPLETE_OR_DIFFERENT_FIELD'};
  if (!Array.isArray(shadow.capture?.evidence_refs)||!shadow.capture.evidence_refs.length) return {eligible:false,reason:'MISSING_PRERACE_EVIDENCE'};
  return {eligible:true,reason:'VERIFIED_PRE_RACE_PAIR'};
}
