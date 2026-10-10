// SHADOW ONLY: do not deploy as production scoring without integration tests.
export function classifyPastRun(run) {
  const raw = typeof run?.raw === 'string' ? run.raw : '';
  if (!raw) return { kind: 'UNKNOWN', countAsStart: false, countAsFinish: false };
  if (/(?:^|\s)(?:除外|取消)(?:\s|$)/.test(raw)) return { kind: /除外/.test(raw) ? 'EXCLUDED' : 'CANCELLED', countAsStart: false, countAsFinish: false };
  if (/(?:^|\s)中止(?:\s|$)/.test(raw)) return { kind: 'DID_NOT_FINISH', countAsStart: true, countAsFinish: false };
  if (Number.isInteger(run?.finish) && run.finish > 0) return { kind: 'FINISHED', countAsStart: true, countAsFinish: true };
  return { kind: 'UNKNOWN', countAsStart: false, countAsFinish: false };
}
export function splitPastRuns(runs) {
  if (!Array.isArray(runs)) return { state: 'HOLD', reason: 'INVALID_HISTORY' };
  const items = runs.map(run => ({ run, classification: classifyPastRun(run) }));
  return { state: items.some(x => x.classification.kind === 'UNKNOWN') ? 'REVIEW' : 'READY', items,
    starts: items.filter(x => x.classification.countAsStart).length,
    finishes: items.filter(x => x.classification.countAsFinish).length };
}
