import { auditSubmission } from './submission-audit.mjs';
import { sha } from '../../../automation/jra-score-ledger/declared-ledger.mjs';

// The private adapter must resolve selections from the same checked RPC snapshot.
// No selection, readiness flag or storage key is accepted from the tool payload.
export function createClaimObserver({ store, resolveCheckedSelection, now = Date.now }) {
  return async function observe({ jobId, context, payload, signal }) {
    signal?.throwIfAborted();
    const digest = sha(context);
    const selected = await resolveCheckedSelection(jobId, digest, signal);
    if (!selected || selected.jobId !== jobId || selected.contextHash !== digest ||
        selected.ready !== true || selected.claimed !== true) throw Error('CLAIM_SCOPE');
    const deadline = Math.min(Date.parse(selected.leaseUntil), Date.parse(selected.saveCutoff));
    if (!Number.isFinite(deadline) || now() >= deadline) throw Error('CLAIM_EXPIRED');
    const observed = Date.parse(selected.observedAt);
    if (!Number.isFinite(observed) || observed > now()) throw Error('SNAPSHOT_TIME');
    if (!Array.isArray(selected.rows) || !selected.rows.length) throw Error('SELECTION_UNAVAILABLE');
    const histories = [];
    const seen = new Set();
    for (const row of selected.rows) {
      const doc = store.read(row.documentId);
      if (doc.schema !== 'UNSIGNED_OFFICIAL_HISTORY_RETENTION_CANDIDATE_V1' ||
          doc.source_ref !== row.sourceRef || doc.race_id !== row.raceId ||
          Date.parse(doc.fetched_at) > observed || seen.has(row.runId) ||
          !doc.runners.some(r => r.run_id === row.runId && r.horse_id === row.horseId &&
            r.race_id === row.raceId)) throw Error('SELECTED_HISTORY_MISMATCH');
      seen.add(row.runId);
      histories.push({ ...Object.fromEntries(['documentId','horseId','raceId','runId'].map(k=>[k,row[k]])),
        rawHash: doc.raw_bytes_sha256, decodedHash: doc.decoded_utf8_sha256 });
    }
    const reviews = payload.audit?.runner_history_checked;
    if (!Array.isArray(reviews) || !Array.isArray(payload.runners) || !payload.runners.length ||
        reviews.length !== payload.runners.length ||
        new Set(payload.runners.map(r => r.horse_no)).size !== payload.runners.length)
      throw Error('REVIEW_COVERAGE');
    for (const runner of payload.runners) {
      const matches = reviews.filter(r => r.horse_no === runner.horse_no);
      if (matches.length !== 1 || !Number.isFinite(matches[0].base_score) ||
          !Array.isArray(matches[0].evidence_effects) || !matches[0].reason?.trim())
        throw Error('REVIEW_INCOMPLETE');
    }
    if (now() >= deadline) throw Error('CLAIM_EXPIRED');
    signal?.throwIfAborted();
    const audit = auditSubmission(payload, selected);
    if (now() >= deadline) throw Error('CLAIM_EXPIRED');
    return store.putDecision({ jobId, contextHash: digest, observedAt: selected.observedAt,
      submissionAudit:audit, submittedRanks:payload.runners.map(({horse_no,rank,score})=>({horse_no,rank,score})),
      top5:payload.top5.map(r=>r.horse_no),eye:payload.eye?.horse_no??null,eyeReviews:payload.audit.eye_review??null,
      submittedPayloadHash: sha(payload), reviews: reviews.map(r => ({
        horse_no:r.horse_no, base_score:r.base_score, reason:r.reason,
        evidence_effects:r.evidence_effects, source_refs:r.source_refs,
        score_after:r.score_after, rank_after:r.rank_after
      })), histories, signatureVerified:false, formalScoringAllowed:false });
  };
}
