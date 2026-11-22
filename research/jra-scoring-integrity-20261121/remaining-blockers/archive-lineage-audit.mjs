// Posthoc archive join diagnostic ONLY. Never a CLAIM reader or evidence issuer.
// A matching DB row is not proof that this row was used, nor a signed HTML snapshot.
export function auditArchiveLineage(packet){
 if(packet?.mode!=='POSTHOC_READONLY_LINEAGE_AUDIT_NOT_CLAIM_PROVIDER'||!Array.isArray(packet.rows))throw Error('ARCHIVE_AUDIT_INPUT_REQUIRED');
 const seen=new Set();
 const rows=packet.rows.map(r=>{
  const key=[r.live_runner_id,r.rn].join(':');if(seen.has(key))throw Error('DUPLICATE_SELECTED_HISTORY');seen.add(key);
  const candidates=Array.isArray(r.exact_archive_candidates)?r.exact_archive_candidates:[];
  const c=candidates.length===1?candidates[0]:null;
  const valid=!!c&&/^[0-9]{10}$/.test(r.horse_id??'')&&c.horse_id===r.horse_id&&c.horse_name===r.horse_name&&
   /^[0-9a-f-]{36}$/i.test(c.run_id??'')&&/^[0-9a-f-]{36}$/i.test(c.race_id??'')&&
   typeof c.source_ref==='string'&&c.source_ref.length>0&&Number.isFinite(Date.parse(c.source_checked_at));
  return {horse_no:r.horse_no,horse_id:r.horse_id,rn:r.rn,
   lineage_status:valid?'UNIQUE_ARCHIVE_COUNTERPART_NOT_PROVEN_SELECTED_SOURCE':candidates.length>1?'AMBIGUOUS_ARCHIVE_COUNTERPART':'ARCHIVE_IDENTITY_OR_SOURCE_INCOMPLETE',
   archive_counterpart:valid?structuredClone(c):null,
   actual_selected_source_id:null,official_body_verified:false,signature_verified:false,
   claim_bound:false,formal_scoring_allowed:false};
 });
 return {mode:packet.mode,rows,selected_history_rows:rows.length,
  unique_archive_counterparts:rows.filter(r=>r.archive_counterpart).length,
  target_card_metadata_count:packet.target_card_metadata_only?.length??0,
  // Card hashes are not history body receipts; never attach them to a past run.
  actual_selected_sources_proven:0,real_verified_histories:0,formal_scoring_allowed:false};
}
