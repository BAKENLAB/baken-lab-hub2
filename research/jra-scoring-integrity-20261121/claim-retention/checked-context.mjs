import { readOfficialEvidence } from '../../../automation/jra-score-ledger/evidence/reader.mjs';

// Server-only adapter. Trust and authorizedRead come from deployment configuration.
export async function checkSelectedContext(raw, dependencies) {
  const { _research_selection: selection, ...context } = raw;
  const contextText = JSON.stringify(context);
  if (!selection || !Array.isArray(selection.rows)) return { context, accepted: [] };
  const proof = await readOfficialEvidence({
    contextText, job_id: context.job_id,
    lease_until: selection.lease_until, post_time: context.race.post_time
  }, dependencies);
  const accepted = proof.accepted.filter(entry => {
    const horses = selection.rows.filter(horse => horse.horse_no === entry.horse_no);
    const row = horses.length === 1 ? horses[0].runs?.[entry.context_prior_index] : null;
    return row?.source_kind === 'DB' &&
      row.selected_run_id === entry.run_id && row.selected_race_id === entry.race_id &&
      row.selected_horse_id === entry.horse_id &&
      entry.facts.every(fact => Date.parse(fact.observed_at) <= Date.parse(selection.observed_at));
  });
  return { context, accepted, status: proof.status };
}
