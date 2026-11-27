// Additional research acceptance diagnostic. No caller flag alone certifies an official artifact.
export function auditOfficialPacket({target,roster,intake}){
 const active=roster.filter(h=>h.active!==false);
 const officialHost=(r)=>{try{const host=new URL(r.source_url).hostname.replace(/^www\./,'');return r.source_id==='IFHA'?['ifhaonline.org','ifhaonline.org.uk'].includes(host):r.source_id?.startsWith('J_')?host==='jra.go.jp':r.source_id?.startsWith('N_')?host==='keiba.go.jp':false;}catch{return false;}};
 const rows=intake.accepted.map(g=>{const r=g.record,p=r.provenance_attestation??{},reasons=[];
 if(!officialHost(r))reasons.push('OFFICIAL_PUBLISHER_HOST_UNVERIFIED');
 if(p.raw_recomputed_sha256!==r.raw_sha256_or_null||p.raw_recomputed_sha256==null)reasons.push('RAW_BYTES_REHASH_NOT_WITNESSED');
 if(p.independent_source_witness!==true||p.independent_identity_witness!==true)reasons.push('INDEPENDENT_WITNESSES_MISSING');
 if(p.historical_publication_witness!==true||p.effective_version_witness!==true)reasons.push('ASOF_EDITION_WITNESS_MISSING');
 return {event_key:g.event_key,evidence_ids:g.evidence_ids,horse_id:r.horse_id,race_id:r.race_id,kind:r.kind,missing:reasons,stage:reasons.length?'RESEARCH_CANDIDATE':'ATTESTATION_SHAPE_COMPLETE_NOT_INDEPENDENTLY_REVERIFIED',formal_admission:false};});
 const field=active.map(h=>{const c=rows.filter(r=>r.horse_id===h.horse_id&&r.race_id===target.race_id&&r.kind==='CURRENT_CARD');return {horse_no:h.horse_no,horse_id:h.horse_id,card_candidates:c.length,history_candidates:rows.filter(r=>r.horse_id===h.horse_id&&r.kind==='RESULT').length,full_field_official_validated:false};});
 return {race_id:target.race_id,roster_version:target.roster_version??null,target_active:active.length,field,records:rows,formal_admissions:0,full_field_validation:false,release_eligible:false};
}
