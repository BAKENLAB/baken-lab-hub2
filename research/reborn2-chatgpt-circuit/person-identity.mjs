// A shaped identifier is never enough. The independently checked link must bind this exact runner and time.
export function personIdentity({row,kind,target,context,attestations=[]}){
 const id=row?.[kind+'_id'];
 if(typeof id!=='string'||!new RegExp('^'+target.circuit+':'+kind.toUpperCase()+':[0-9]+$').test(id))return {status:'INVALID_OR_MISSING_PERSON_ID',id:null,refs:[]};
 const candidates=attestations.filter(a=>a.person_id===id&&a.person_kind===kind&&a.horse_id===row.horse_id&&a.race_id===row.race_id&&a.runner_evidence_id===row.evidence_id);
 if(candidates.length!==1)return {status:'PERSON_LINK_UNVERIFIED',id:null,refs:[]};
 const a=candidates[0],ev=context.byId.get(a.evidence_id),profile=context.byId.get(a.profile_evidence_id),time=context.ts(row.started_at??target.started_at);
 if(!ev||!profile||!context.bound(a,row.horse_id,row.race_id)||ev.person_id!==id||profile.person_id!==id||profile.person_kind!==kind||profile.horse_id!==null||a.issuer!==target.circuit||a.official_profile_verified!==true||a.official_runner_link_verified!==true||a.independent_attestation_verified!==true||typeof a.official_profile_url!=='string'||!/^https:\/\/(www\.)?(jra\.go\.jp|keiba\.go\.jp)\//.test(a.official_profile_url)||!(context.ts(a.effective_from)<=time&&time<context.ts(a.effective_until)))return {status:'PERSON_LINK_UNVERIFIED',id:null,refs:[]};
 return {status:'STRUCTURAL_PERSON_CANDIDATE',id,refs:[a.evidence_id,a.profile_evidence_id]};
}
