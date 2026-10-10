// SHADOW candidate only. No DB/network calls and no inferred ACTIVE status.
export function publicationDecision(field,{frozen=null}={}){
 if(frozen)return {decision:'PRESERVE_FROZEN',fixed:structuredClone(frozen)};
 const hold=reason=>({decision:'HOLD',reason});
 if(field?.circuit!=='JRA'||!field.race_key||!field.complete||!Array.isArray(field.runners)||!field.runners.length)return hold('INCOMPLETE_FIELD');
 let u;try{u=new URL(field.source_url)}catch{return hold('SOURCE_MISSING')}
 if(u.protocol!=='https:'||u.hostname!=='www.jra.go.jp'||!Number.isFinite(Date.parse(field.fetched_at))||!/(Z|[+-]\d\d:\d\d)$/.test(field.fetched_at)||! /^[a-f0-9]{64}$/.test(field.html_sha256||''))return hold('SOURCE_MISSING');
 const seen=new Set();const active=[];const excluded=[];
 for(const horse of field.runners){
  if(!Number.isInteger(horse.horse_no)||horse.horse_no<1||seen.has(horse.horse_no)||!horse.horse_name)return hold('IDENTITY_INVALID');
  seen.add(horse.horse_no);
  const e=horse.status_evidence;
  // Verified must come from separately validated real-DOM extraction, never this function.
  if(!['ACTIVE','CANCELLED','EXCLUDED'].includes(horse.entry_status)||e?.verified!==true||e.scope!=='CURRENT_RACE'||e.race_key!==field.race_key||e.horse_no!==horse.horse_no||e.html_sha256!==field.html_sha256||e.fetched_at!==field.fetched_at||!e.locator||!e.raw_text?.trim()||!e.rule_id)return hold('STATUS_UNVERIFIED');
  (horse.entry_status==='ACTIVE'?active:excluded).push(structuredClone(horse));
 }
 if(!active.length)return hold('NO_ACTIVE_RUNNERS');
 return {decision:'CANDIDATE_ONLY',active,excluded,source: {fetched_at:field.fetched_at,html_sha256:field.html_sha256,source_url:field.source_url}};
}
export function auditBatch(fields){return fields.map(field=>{try{return publicationDecision(field)}catch{return {decision:'HOLD',reason:'INVALID_INPUT'}}});}
