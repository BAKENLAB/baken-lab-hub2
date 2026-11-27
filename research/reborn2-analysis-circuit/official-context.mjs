const stamp=v=>typeof v==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(v)?Date.parse(v):NaN;
const timed=(r,cutoff)=>stamp(r.published_at)<=stamp(r.checked_at??r.observed_at)&&
  stamp(r.checked_at??r.observed_at)<=stamp(cutoff);

export function officialIncidentRoles({records,run,cutoff}) {
  if(!run.horse_id)return [];
  const matches=records.filter(r=>r.verified===true&&r.horse_id===run.horse_id&&
    r.result_ref===run.source_ref&&r.prior_no===run.prior_no&&r.race_date===run.race_date&&
    r.document_ref&&/^[a-f0-9]{64}$/.test(r.document_sha256??'')&&r.event_id&&
    ['SUFFERED','CAUSED','SELF_EVENT'].includes(r.role)&&r.finding?.trim()&&timed(r,cutoff));
  const seen=new Map();
  for(const r of matches){
    const k=r.document_ref+'|'+r.event_id;
    if(seen.has(k))seen.set(k,null);
    else seen.set(k,r);
  }
  return [...seen.values()].filter(Boolean).map(r=>({role:r.role,finding:r.finding,phase:r.phase??null,
    document_ref:r.document_ref,document_sha256:r.document_sha256,event_id:r.event_id,
    eligible_for_adversity_analysis:r.role==='SUFFERED'}));
}

export function officialRatings({ratings,run,cutoff}){
  if(!run.horse_id)return [];
  const matches=ratings.filter(r=>r.verified===true&&r.horse_id===run.horse_id&&
    r.performance_ref===run.source_ref&&r.performance_date===run.race_date&&
    r.scope==='RACE_PERFORMANCE'&&r.source_ref&&r.version&&
    /^[a-f0-9]{64}$/.test(r.document_sha256??'')&&timed(r,cutoff)&&Number.isFinite(r.value));
  // Revision choice requires an independently pinned edition, not latest-version guessing.
  if(matches.length!==1)return [];
  const [r]=matches;
  return [{rating:r.value,scope:r.scope,source_ref:r.source_ref,version:r.version,
    published_at:r.published_at,document_sha256:r.document_sha256}];
}
