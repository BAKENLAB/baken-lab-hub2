// Offline structural preflight only. No source access, engine invocation or authorization.
// Caller-supplied proof references never constitute proof. Literal parsing and value provenance are separate gates.
import {readFileSync} from 'node:fs';
const contract=JSON.parse(readFileSync(new URL('./native-fact-contract.json',import.meta.url),'utf8'));
function inspectNativeFactShape(p,c){
 const fail=msg=>{throw new Error(msg)};
 const check=(v,msg)=>{if(!v)fail(msg)};
 const exact=(x,keys)=>check(x&&typeof x==="object"&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k)),"UNEXPECTED_KEYS");
 const str=x=>typeof x==="string"&&x.length>0&&x.length<=1024&&!/[\x00-\x1f]/.test(x);
 const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
 const ts=x=>typeof x==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
 const t=x=>Date.parse(x);
 const day=x=>typeof x==="string"&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00.000Z"))&&new Date(x+"T00:00:00.000Z").toISOString().slice(0,10)===x;
 const refs=a=>Array.isArray(a)&&a.length>0&&a.every(str)&&new Set(a).size===a.length;
 const key=(...x)=>JSON.stringify(x);
 const d=c.package;
 exact(p,d.keys);check(p.schema===d.schema&&p.engineCommit===c.engineCommit,"PACKAGE_PIN");
 check(["JRA","LOCAL"].includes(p.circuit)&&[p.cutoff,p.scheduledPost,p.startLower].every(ts)&&t(p.cutoff)<t(p.startLower)&&t(p.startLower)<=t(p.scheduledPost),"TIME_BOUNDARY");
 check([p.events,p.roster,p.documents,p.observations].every(Array.isArray),"ARRAY_REQUIRED");
 const events=new Map(),native=new Set();
 for(const e of p.events){
  exact(e,d.event);check([e.id,e.issuer,e.nativeId,e.venueId].every(str)&&e.issuer===(p.circuit==="JRA"?"JRA":"NAR")&&day(e.dateJst)&&int(e.raceNo,1,24)&&["TARGET_CARD","HISTORICAL_RESULT"].includes(e.role)&&refs(e.identityProofRefs),"EVENT_IDENTITY");
  const nk=key(e.issuer,e.nativeId);check(!events.has(e.id)&&!native.has(nk),"DUPLICATE_EVENT");events.set(e.id,e);native.add(nk);
 }
 const target=events.get(p.targetId);check(target?.role==="TARGET_CARD"&&p.events.filter(e=>e.role==="TARGET_CARD").length===1,"TARGET_REQUIRED");
 check(p.events.every(e=>e.id===target.id||e.dateJst<target.dateJst),"HISTORICAL_DATE_BOUNDARY");
 const roster=new Map(),numbers=new Set();
 for(const h of p.roster){
  exact(h,d.roster);check(str(h.horseId)&&int(h.horseNo,1,24)&&d.statuses.includes(h.status)&&refs(h.proofRefs)&&!roster.has(h.horseId)&&!numbers.has(h.horseNo),"ROSTER_IDENTITY");roster.set(h.horseId,h);numbers.add(h.horseNo);
 }
 check(roster.size>0,"ROSTER_REQUIRED");
 const docs=new Map();
 for(const s of p.documents){
  exact(s,d.document);check(str(s.id)&&!docs.has(s.id)&&events.has(s.eventId)&&s.role===events.get(s.eventId).role&&[s.sourceRef,s.permissionRef,s.custodyRef].every(str)&&int(s.version,1,Number.MAX_SAFE_INTEGER)&&typeof s.sha256==="string"&&/^[a-f0-9]{64}$/.test(s.sha256),"DOCUMENT_IDENTITY");
  check([s.publishedAt,s.updatedAt,s.capturedAt].every(ts)&&int(s.uncertaintyMs,0,Number.MAX_SAFE_INTEGER)&&t(s.publishedAt)<=t(s.updatedAt)&&t(s.updatedAt)<=t(s.capturedAt)&&t(s.capturedAt)+s.uncertaintyMs<=t(p.cutoff),"DOCUMENT_TIME");
  check(s.supersedes===null||str(s.supersedes),"VERSION_LINK");docs.set(s.id,s);
 }
 check([...docs.values()].some(s=>s.eventId===target.id),"TARGET_DOCUMENT_REQUIRED");
 for(const s of docs.values())if(s.supersedes!==null){const b=docs.get(s.supersedes);check(b&&b.eventId===s.eventId&&b.sourceRef===s.sourceRef&&b.version<s.version&&t(b.updatedAt)<=t(s.updatedAt),"VERSION_LINEAGE");}
 const seen=new Set(), verifiedStatusShapes=new Set(), counts={OBSERVED:0,MISSING:0,HELD:0,CONFLICT:0},histRows=new Map();
 const valueOK=(f,v)=>{
  if(["gate","declaredCount","finish"].includes(f))return int(v,1,24);
  if(["distanceM","weightG","final600Ms","bodyWeightKg"].includes(f))return int(v,1,1000000);
  if(f==="bodyWeightDeltaKg")return int(v,-1000,1000);
  if(f==="status")return d.statuses.includes(v);
  if(["leaderLapSlots","cornerGroupSlots"].includes(f))return Array.isArray(v)&&v.length>0&&v.length<=32&&v.every(x=>x===null||str(x));
  return str(v);
 };
 for(const o of p.observations){
  exact(o,d.observation);const e=events.get(o.eventId);check(e&&d.states.includes(o.state)&&Array.isArray(o.roots),"OBSERVATION");
  const isHorse=o.horseId!==null;
  check(isHorse?str(o.horseId)&&d.horseFields.includes(o.field):o.pastHorseNo===null&&d.eventFields.includes(o.field),"FIELD_ALLOWLIST");
  if(e.role==="TARGET_CARD"){
   check(!d.historicalOnly.includes(o.field)&&o.pastHorseNo===null&&(!isHorse||roster.has(o.horseId)),"TARGET_RESULT_OR_UNKNOWN_HORSE");
  }else if(isHorse){check(int(o.pastHorseNo,1,24),"PAST_HORSE_NO");const k=key(e.id,o.horseId), prior=histRows.get(k);check(prior===undefined||prior===o.pastHorseNo,"HORSE_ROW_CONFLICT");histRows.set(k,o.pastHorseNo);}
  const k=key(o.eventId,o.horseId,o.field);check(!seen.has(k),"DUPLICATE_FACT");seen.add(k);
  if(o.state==="OBSERVED")check(valueOK(o.field,o.value)&&o.reason===null&&o.roots.length>0,"OBSERVED_VALUE");
  else check(o.value===null&&str(o.reason),"MISSING_OR_CONFLICT_REASON");
  for(const root of o.roots){exact(root,d.root);check(docs.get(root.documentId)?.eventId===e.id&&root.field===o.field&&str(root.rowPointer)&&str(root.proofRef),"FIELD_ROOT_BINDING");}
  if(e.role==="TARGET_CARD"&&o.field==="status"&&o.state==="OBSERVED"){check(roster.get(o.horseId)?.status===o.value,"STATUS_CONFLICT");verifiedStatusShapes.add(o.horseId);}
  counts[o.state]++;
 }
 const rosterMissing=p.roster.filter(h=>!verifiedStatusShapes.has(h.horseId)).length;
 return {state:"HELD_REAL_ADMISSION",counts,rosterCount:roster.size,rosterStatusMissing:rosterMissing,historyRowCandidates:histRows.size,blockers:["INDEPENDENT_SOURCE_PERMISSION","OFFICIAL_NATIVE_EVENT_AND_ROW_WITNESSES","ORIGINAL_CUSTODY_AND_COMPLETE_ASOF_INVENTORY","INDEPENDENT_FULL_ROSTER_STATUS_VERIFICATION","REVIEWED_REAL_ADMISSION_AND_ANALYSIS_ADAPTER"],realAdmission:false,engineInput:null,projectionAllowed:false,persistenceAllowed:false};
}
export const inspectNativeFacts=p=>inspectNativeFactShape(p,contract);
export const supplyContract=contract;
