/* LAB SHADOW audit validation. Read-only, no network or persistence.
 * Candidate schema only: adapt to actual Work output after evidence is received.
 */
export function validateAuditReport(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {ok:false, errors:['Report must be an object'], summary:null};
  if (data.schema_version !== 'lab-shadow-audit-v1') errors.push('Unsupported schema_version');
  if (!Array.isArray(data.races) || data.races.length === 0) errors.push('races must be a nonempty array');
  const seen = new Set();
  const counts = {READY:0,DATA_INCOMPLETE:0,OTHER:0};
  if (Array.isArray(data.races)) data.races.forEach((r,i) => {
    const at = 'races[' + i + ']';
    if (!r || typeof r !== 'object' || Array.isArray(r)) { errors.push(at + ' must be an object'); return; }
    if (typeof r.race_key !== 'string' || !r.race_key.trim()) errors.push(at + '.race_key missing');
    else if (seen.has(r.race_key)) errors.push(at + '.race_key duplicated');
    else seen.add(r.race_key);
    if (typeof r.course !== 'string' || !r.course.trim()) errors.push(at + '.course missing');
    if (!Number.isInteger(r.race_number) || r.race_number < 1) errors.push(at + '.race_number invalid');
    if (!Number.isInteger(r.entry_count) || r.entry_count < 1) errors.push(at + '.entry_count invalid');
    if (!Number.isInteger(r.horses_with_five_prior_runs) || r.horses_with_five_prior_runs < 0 || r.horses_with_five_prior_runs > r.entry_count) errors.push(at + '.horses_with_five_prior_runs invalid');
    const start = Date.parse(r.scheduled_start), collected = Date.parse(r.collected_at);
    if (!Number.isFinite(start) || !Number.isFinite(collected)) errors.push(at + '.timestamps invalid');
    else if (collected >= start) errors.push(at + '.collected_at must precede scheduled_start');
    if (r.status !== 'READY' && r.status !== 'DATA_INCOMPLETE') {counts.OTHER++;errors.push(at + '.status unsupported');}
    else counts[r.status]++;
    if (r.status === 'READY' && r.horses_with_five_prior_runs !== r.entry_count) errors.push(at + '.READY contradicts coverage');
    if (r.status === 'DATA_INCOMPLETE' && (!Array.isArray(r.reason_codes) || !r.reason_codes.length)) errors.push(at + '.DATA_INCOMPLETE requires reason_codes');
  });
  return {ok:errors.length===0, errors, summary:errors.length===0?{race_count:data.races.length, ...counts}:null};
}
