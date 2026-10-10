// SHADOW ONLY. Evidence must be produced by a separately audited official DOM extractor.
const allowed=new Set(['ACTIVE','CANCELLED','EXCLUDED']);
export function validateOfficialSnapshot({race,htmlSha256,sourceUrl,checkedAt,field,observations}) {
 if(!race?.id||!Array.isArray(field)||field.length===0)return {state:'HOLD',reason:'FIELD_MISSING'};
 if(!/^https:\/\/www\.jra\.go\.jp\/JRADB\/accessD\.html\?CNAME=/.test(sourceUrl||'')||!/^[a-f0-9]{64}$/.test(htmlSha256||'')||!Number.isFinite(Date.parse(checkedAt)))return {state:'HOLD',reason:'SOURCE_UNVERIFIED'};
 if(!Array.isArray(observations)||observations.length!==field.length)return {state:'HOLD',reason:'FIELD_COUNT_MISMATCH'};
 const identities=new Map();
 for(const r of field) {
  if(!Number.isInteger(r.horse_no)||r.horse_no<1||!r.horse_name||identities.has(r.horse_no))return {state:'HOLD',reason:'FIELD_IDENTITY_INVALID'};
  identities.set(r.horse_no,r.horse_name);
 }
 const seen=new Set(),active=[];
 for(const o of observations) {
  if(!identities.has(o.horse_no)||seen.has(o.horse_no)||o.horse_name!==identities.get(o.horse_no))return {state:'HOLD',reason:'OBSERVATION_MISMATCH'};
  seen.add(o.horse_no);
  if(o.race_id!==race.id||o.html_sha256!==htmlSha256||o.scope!=='CURRENT_RACE'||!allowed.has(o.status)||o.verified!==true||typeof o.dom_locator!=='string'||!o.dom_locator.trim()||typeof o.dom_text!=='string'||!o.dom_text.trim())return {state:'HOLD',reason:'STATUS_EVIDENCE_MISSING'};
  // DOM text alone is not proof of ACTIVE; extractor rules must be separately validated.
  if(o.status==='ACTIVE'&&o.status_basis!=='OFFICIAL_CURRENT_RACE_ENTRY')return {state:'HOLD',reason:'ACTIVE_BASIS_UNVERIFIED'};
  if(o.status==='ACTIVE')active.push(o.horse_no);
 }
 if(!active.length)return {state:'HOLD',reason:'NO_ACTIVE'};
 return {state:'SHADOW_EVIDENCE_STRUCTURALLY_COMPLETE',raceId:race.id,activeHorseNos:active,eligibleForOfficialPublish:false,requiresTrustedExtractor:true};
}
