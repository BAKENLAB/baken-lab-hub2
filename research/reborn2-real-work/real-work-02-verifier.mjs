import crypto from 'node:crypto';
const allowedTop=new Set(['scope','mode','issuer','target','cutoff','manifest','documents','policy']);
const forbidden=/odds|popular|payout|targetResult|winner|resultOfTarget/i;
export function verifyEnvelope(x,{trustedPolicyDigests=new Set(),trustedRightsDigests=new Set()}={}){
 const fail=reason=>({ok:false,reason});if(!x||typeof x!=='object'||Array.isArray(x))return fail('ENVELOPE_TYPE');
 if(Object.keys(x).some(k=>!allowedTop.has(k)||forbidden.test(k)))return fail('UNKNOWN_OR_FORBIDDEN_TOP');
 if(x.scope!=='SYNTHETIC_ONLY'&&x.scope!=='APPROVED_RESEARCH_CAPTURE')return fail('SCOPE_DISABLED');
 if(!['PROSPECTIVE','HISTORICAL_RESEARCH'].includes(x.mode))return fail('MODE_REQUIRED');if(!Number.isSafeInteger(x.cutoff))return fail('CUTOFF_REQUIRED');
 if(!x.policy||!trustedPolicyDigests.has(x.policy.digest))return fail('UNTRUSTED_POLICY');if(!Array.isArray(x.documents)||!x.documents.length)return fail('DOCUMENTS_REQUIRED');
 for(const d of x.documents){if(Object.keys(d).some(k=>!['id','raw','sha256','captureStart','captureEnd','publishedAt','updatedAt','rightsDigest','sourceUrl','sourceRole','parserVersion'].includes(k)))return fail('UNKNOWN_DOCUMENT_FIELD');
  if(typeof d.raw!=='string'||crypto.createHash('sha256').update(d.raw).digest('hex')!==d.sha256)return fail('RAW_HASH');if(!trustedRightsDigests.has(d.rightsDigest))return fail('UNTRUSTED_RIGHTS');
  if(![d.captureStart,d.captureEnd,d.publishedAt,d.updatedAt].every(Number.isSafeInteger))return fail('DOCUMENT_TIME_TYPE');if(!(d.publishedAt<=d.updatedAt&&d.updatedAt<=d.captureStart&&d.captureStart<=d.captureEnd&&d.captureEnd<=x.cutoff))return fail('DOCUMENT_CHRONOLOGY');
  if(forbidden.test(d.raw)&&x.mode==='PROSPECTIVE')return fail('TARGET_OUTCOME_OR_MARKET');}
 if(!x.target||typeof x.target.eventId!=='string'||!Number.isSafeInteger(x.target.scheduledPost)||x.cutoff>=x.target.scheduledPost)return fail('TARGET_TIME');
 return{ok:true,formal:false,packetDigest:crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex')};}
