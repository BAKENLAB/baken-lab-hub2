import {createHash} from 'node:crypto';
const present=x=>x!==undefined&&x!==null&&x!=='';
const fail=(v,m)=>{if(!v)throw Error(m)};
const canon=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?'['+x.map(canon).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canon(x[k])).join(',')+'}';
export const digest=x=>createHash('sha256').update(canon(x)).digest('hex');
export function auditAll({inventory,roster,expectedCount,scope,views,observedAt,post}){
 fail(inventory.length===115&&new Set(inventory.map(x=>x.id)).size===115,'ITEM_IDS');
 fail(Number.isInteger(expectedCount)&&expectedCount>0&&roster.length===expectedCount&&new Set(roster.map(h=>h.no)).size===expectedCount,'FULL_DENOMINATOR');
 fail(roster.every(h=>Number.isInteger(h.no)&&h.no>0),'HORSE_NUMBER');
 fail(Number.isFinite(Date.parse(observedAt))&&Number.isFinite(Date.parse(post))&&Date.parse(observedAt)<Date.parse(post),'PREPOST');
 const nos=new Set(roster.map(h=>h.no));
 fail(new Set(views.map(v=>v.pin)).size===views.length,'DUPLICATE_VIEW');
 const output=[];
 for(const v of views){
  fail(v.scope===scope&&typeof v.pin==='string'&&v.pin.length>0,'VIEW_SCOPE');
  fail(v.evidence.every(e=>nos.has(e.no)&&typeof e.key==='string'&&typeof e.source==='string'&&e.source.length>0),'EVIDENCE_SCOPE');
  for(const h of roster){
   const own=v.evidence.filter(e=>e.no===h.no);
   const events=[...new Set(own.map(e=>e.event??'CURRENT'))];if(!events.length)events.push('CURRENT');
   for(const event of events){
    const records=own.filter(e=>(e.event??'CURRENT')===event||((e.event??'CURRENT')==='CURRENT'&&e.contextOnly===true));
    for(const i of inventory){
     const available=i.inputs.flatMap(k=>records.filter(e=>e.key===k&&e.status==='CANDIDATE_OBSERVED').map(e=>({key:k,source:e.source,event:e.event??'CURRENT',tier:e.tier??'REPORTED'})));
     const missing=i.inputs.filter(k=>!available.some(e=>e.key===k)).map(k=>({key:k,reason:records.find(e=>e.key===k&&e.status!=='CANDIDATE_OBSERVED')?.status??(i.direct?'DIRECT_MEASUREMENT_NOT_PUBLISHED':'NOT_OBSERVED_OR_NOT_IMPLEMENTED')}));
     output.push({view:v.pin,no:h.no,event,item:i.id,available,missing,identityStatus:h.identityStatus??'NOT_BOUND',judgment:'NOT_CERTIFIED'});
    }
   }
  }
 }
 const summary=views.map(v=>{const rows=output.filter(r=>r.view===v.pin);return {pin:v.pin,subjects:new Set(rows.map(r=>r.no)).size,slots:rows.length,subjectItemSlots:expectedCount*115,any:rows.filter(r=>r.available.length).length,allListed:rows.filter(r=>!r.missing.length).length,zeroCandidateSubjects:roster.filter(h=>!rows.some(r=>r.no===h.no&&r.available.length)).map(h=>h.no),fullyCertified:0};});
 const pack={scope,expectedCount,observedAt,post,roster,summary,rows:output,formalAdmission:false,publicationAllowed:false};return {...pack,digest:digest(pack)};
}
export function legacyViews({scope,originalPin,supplementPin,originalIndex,supplementDetails}){
 const original=[];for(const r of originalIndex){for(const e of r.available??[]){if(!e.root)continue;original.push({no:r.currentNo,event:r.event,key:e.key,source:JSON.stringify(e.root),status:'CANDIDATE_OBSERVED',tier:e.tier??'STORED'});}}
 const supplement=[];for(const h of supplementDetails){for(const e of h.events??[]){for(const key of e.keys??[])supplement.push({no:h.no,event:e.event,key,source:supplementPin+':scoped-key-presence',status:'CANDIDATE_OBSERVED',tier:'KEY_PRESENCE_NOT_VALUE_PROOF'});}}
 return [{pin:originalPin,scope,evidence:original},{pin:supplementPin,scope,evidence:supplement}];
}
// NAR race-card displayed gap refers to winner, except winner refers to second.
export function narCardGap(finish,seconds){fail(Number.isInteger(finish)&&finish>0&&Number.isFinite(seconds)&&seconds>=0,'GAP');return {seconds,reference:finish===1?'SECOND':'WINNER',tier:'REPORTED_CARD_TIME_GAP_NOT_ADJACENT_MARGIN'};}
