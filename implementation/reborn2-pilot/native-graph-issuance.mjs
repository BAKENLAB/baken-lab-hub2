// Codex07: executable graph issuance from exact Work07/08 parser output.
// No native authority installed. Fixture capabilities cannot be used as native.
import assert from 'node:assert/strict';
import {verify,createPublicKey,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ENGINE,sha} from './adapter.mjs';
import {inspectNativeFacts,supplyContract} from './work06/inspect-native-facts.mjs';
import {inspectNativeStructureOffline} from './native-entry.mjs';
import {computePartial} from './derived-partial-core.mjs';
import {computeNormal,computeNormalFromSupply} from './normal-engine.mjs';
import {prepareNormalSupply} from '../reborn2-work10/normal-supply.mjs';
import {partialFixture} from './fixture-partial.mjs';
import {csvRows} from '../../research/reborn2-work44/offline-intake-v0.2.mjs';
import {convertExistingWork44 as convert07,convertApprovedLocal as local07} from '../reborn2-work07/offline-converter.mjs';
import {convertExistingWork44 as convert08,convertApprovedLocal as local08} from '../reborn2-work08/offline-converter.mjs';
export const WORK08='767a8e0bb90bd178e260d6b4b8bcc86fe341520e';
import {convertApprovedLocal as local11,convertExistingWork44 as convert11,verifyApprovedManifest as verify11} from '../reborn2-work11/offline-converter.mjs';
import {replayOfficialOriginals,checkAnalysisTime,assertTargetOutcomeIsolation} from './work11-original-replay.mjs';
const pins={'11':'2854de5e9c8a7f3730e0cb29b5abeda4c4f38195','07':'d86fb5f23749fd53f30ce39e0b7977bff976dc96','08':'53bc6dcf149fc3222fcfde904cd460aff761fe09'};
for(const v of ['07','08','11']){
 const bytes=readFileSync(new URL('../reborn2-work'+v+'/offline-converter.mjs',import.meta.url));
 assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),pins[v],'CONVERTER_PIN');
}
const planning=new Map(JSON.parse(readFileSync(new URL('./work04-source-map.json',import.meta.url))).items.map(i=>[i.id.startsWith('EYE-')?i.id.replace('-',''):'RANK'+i.id,i]));
const names=new Map([...planning].map(([id,i])=>[id,i.name]));
const key=(...x)=>JSON.stringify(x),hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const exact=(o,keys)=>{assert.ok(o&&typeof o==='object'&&!Array.isArray(o));assert.deepEqual(Object.keys(o).sort(),[...keys].sort(),'GRAPH_EXACT_FIELDS');};
const index=(xs,f)=>{const m=new Map(xs.map(x=>[f(x),x]));assert.equal(m.size,xs.length,'GRAPH_DUPLICATE_KEY');return m;};
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const registry=new WeakMap();
// Configuration must be independently reviewed and installed by Main, not
// supplied by request. No environment-variable or user-key override.
const authority=freeze({state:'NOT_CONFIGURED',sourceKey:null,reviewKey:null,sourcePins:[],approvalPins:[]});
const verifyPinned=(signed,pem,allowed)=>{
 exact(signed,['payload','signature']);const digest=sha(signed.payload);
 assert.ok(allowed.includes(digest),'UNPINNED_APPROVAL');
 assert.ok(verify(null,Buffer.from(JSON.stringify(signed.payload)),createPublicKey(pem),Buffer.from(signed.signature,'base64')),'APPROVAL_SIGNATURE');
 return digest;
};
const itemIds=supplyContract.items.map(i=>i.id.startsWith('EYE-')?i.id.replace('-',''):'RANK'+i.id);
const fullRequirements=freeze([
 {id:'HISTORICAL_STARTER_STATUS',items:['RANK02','RANK04','RANK25','RANK33','RANK34','RANK35','RANK36','RANK37','EYE02','EYE04','EYE05','EYE14'],need:'全過去出走馬の正式な出走・完走・同着等の分類、実出走頭数',why:'登録頭数や着順だけでは正式分類と全頭順位を確定できない'},
 {id:'INDIVIDUAL_DISTANCE_CROSSING_MS',items:['RANK07','RANK08','RANK09','RANK10','RANK11','RANK18','RANK21','RANK22','RANK23','RANK24','RANK25','RANK29','RANK69','RANK70','RANK72','RANK73','RANK74','RANK75','EYE02','EYE03','EYE06','EYE09','EYE10','EYE11'],need:'固有馬別・同一起点の距離別通過実測時計と計測誤差',why:'個別上がりや先頭馬ラップから個馬の途中時計は復元しない'},
 {id:'EXACT_DISTANCE_RANKS',items:['RANK17','RANK18','RANK21','RANK22','RANK24','RANK58','RANK59','RANK60','RANK61','RANK63','RANK65','RANK66','RANK68','RANK70','EYE03','EYE09','EYE10','EYE11','EYE12'],need:'通過地点に対応する全頭順位と距離・順序の定義',why:'コーナー通過順の原文を距離別順位へ変換しない'},
 {id:'EFFECTIVE_COURSE_AND_CLASS_VERSION',items:['RANK33','RANK39','RANK43','RANK44','RANK45','RANK46','RANK47','RANK48','RANK49','RANK50','RANK51','RANK52','RANK53','RANK67','RANK93','RANK95','EYE07','EYE08','EYE14','EYE15'],need:'適用時点付きコース形状・初角・直線・区間距離・クラス規則',why:'距離・馬場・回りの報告値は比較可能だが形状適性・クラス同等性は別'},
 {id:'NORMALIZED_FINISH_CLOCK',items:['RANK03','RANK04','RANK05','RANK28','RANK29','RANK30','EYE01','EYE04'],need:'明示単位・精度のある個馬走破時計と正式勝馬分類',why:'着差の文字列や単位不明の時計を秒へ換算しない'},
 {id:'RACE_LEADER_LAP_DISTANCE_BINDING',items:['RANK19','RANK20','RANK23','RANK69','RANK72','RANK73','EYE06'],need:'先頭馬ラップの区間境界・単位・精度',why:'レース全体のラップを個馬区間時計として扱わない'},
 {id:'CURRENT_COMPLETE_STATUS_AND_FIELD',items:['RANK58','RANK59','RANK60','RANK61','RANK62','RANK63','RANK64','RANK65','RANK66','RANK67','RANK68','RANK69','RANK70','RANK71','RANK72','RANK73','RANK74','RANK75','RANK99','RANK100','EYE09','EYE10','EYE11','EYE12','EYE15'],need:'全頭の正式な発走前出走状態・同型・条件',why:'未確認はACTIVEにしない'},
 {id:'INDEPENDENT_CURRENT_RELEVANCE',items:['RANK01','RANK12','RANK16','RANK26','RANK27','RANK37','RANK38','RANK40','RANK78','RANK79','RANK80','RANK82','RANK83','RANK84','RANK85','RANK86','RANK87','RANK88','RANK89','RANK90','RANK91','RANK92','RANK94','RANK96','RANK97','RANK98','RANK99','RANK100','EYE01','EYE05','EYE13','EYE15'],need:'独立した現時点の関連性・負荷・不利・状態・相手水準等の証拠',why:'過去走の観測だけでは今回の能力発揮を断定できない'}
]);
// This is an inventory of actual typed inputs, not an automatic full-grade
// rule or a claim that every listed item is impossible without one field.
function availability(pkg,runners){
 const hist=pkg.events.filter(e=>e.role==='HISTORICAL_RESULT');
 const known=pkg.roster.filter(h=>h.status!=='UNKNOWN').length;
 return {fullEligible:false,commonNativeFullConnected:false,requirements:fullRequirements.map(q=>({...q,state:q.id==='CURRENT_COMPLETE_STATUS_AND_FIELD'&&known===pkg.roster.length?'REQUIRES_INDEPENDENT_COMPLETE_ROSTER_REVIEW':'HELD_NOT_ESTABLISHED_BY_WORK06_08'})),coverage:{targetRows:pkg.roster.length,knownStatus:known,historyEvents:hist.length,observed:pkg.observations.filter(o=>o.state==='OBSERVED').length,byHorse:runners.map(h=>({horse:h.horse,analyzed:h.analysisItems.filter(i=>i.partialFindings.length).length,held:h.analysisItems.filter(i=>!i.partialFindings.length).length}))},fullReasons:['NATIVE_FULL_PACKET_AND_WORK42_ROOT_MAPPING_NOT_ISSUED','INDIVIDUAL_MEASUREMENTS_AND_VERSIONED_GEOMETRY_NOT_IN_WORK06_SCHEMA','NATIVE_FULL_DOWNSTREAM_EQUIVALENCE_NOT_PROVEN']};
}
function build(converted,rowWitnesses,{fixture,version,manifestDigest}){
 const pkg=converted.package;
 assert.deepEqual(inspectNativeFacts(pkg),converted.inspection);
 if(!fixture)inspectNativeStructureOffline(pkg);
 const ev=index(pkg.events,e=>e.id),docs=index(pkg.documents,d=>d.id),roster=index(pkg.roster,h=>h.horseId);
 const witness=index(rowWitnesses,w=>key(w.eventId,w.horseId));
 const witnessNo=index(rowWitnesses,w=>key(w.eventId,w.horseNo));
 const states=index(converted.sourceStates,s=>key(s.eventId,s.horseId,s.field));
 const roots=new Map(),events=new Map(),rows=new Map(),nodeForDoc=new Map(),nodeForRow=new Map();
 const label=fixture?'FIXTURE':'NATIVE',observed=fixture?'OBSERVED_TEST_FORMAT':'OBSERVED_NATIVE_VERIFIED';
 const add=(kind,payload,depends=[])=>{
  const body={kind:label+'_'+kind,payload,depends:[...new Set(depends)].sort()};
  const id=sha([body.kind,body.payload,body.depends]);if(!roots.has(id))roots.set(id,{id,...body});return id;
 };
 for(const e of pkg.events){
  const er=add('EVENT_IDENTITY',e);
  events.set(e.id,{eventId:e.id,role:e.role,nativeRaceIdentity:{issuer:e.issuer,nativeId:e.nativeId,venueId:e.venueId,dateJst:e.dateJst,raceNo:e.raceNo},eventRoot:er,observations:{},rows:[]});
 }
 const docRoot=d=>{
  if(nodeForDoc.has(d.id))return nodeForDoc.get(d.id);
  const depends=[events.get(d.eventId).eventRoot];
  if(d.supersedes!==null)depends.push(docRoot(docs.get(d.supersedes)));
  const id=add('SOURCE_DOCUMENT',d,depends);nodeForDoc.set(d.id,id);return id;
 };
 for(const d of pkg.documents)docRoot(d);
 const ensureRow=(eventId,horseId,no)=>{
  const k=key(eventId,horseId);if(rows.has(k))return rows.get(k);
  const w=witness.get(k);assert.ok(w&&w.horseNo===no&&witnessNo.get(key(eventId,no))===w,'NATIVE_ROW_WITNESS_BINDING');
  const e=events.get(eventId),isTarget=eventId===pkg.targetId;
  const h=isTarget?roster.get(horseId):null;
  if(isTarget)assert.ok(h&&h.horseNo===no);
  const rowId=add(isTarget?'TARGET_ROSTER_ROW':'HISTORICAL_ROW_IDENTITY',{eventId,horseId,horseNo:no,witness:w,...(h?{roster:h}:{})},[e.eventRoot]);
  const row={nativeId:horseId,observations:{no:{state:observed,value:no,evidenceId:rowId}},unavailable:[]};
  e.rows.push(row);rows.set(k,row);nodeForRow.set(k,rowId);return row;
 };
 for(const h of pkg.roster)ensureRow(pkg.targetId,h.horseId,h.horseNo);
 // Preserve every authorized row identity, including rows with no usable
 // performance. Never create performance/status from row identity.
 for(const w of rowWitnesses){assert.ok(ev.has(w.eventId),'ROW_EVENT');if(w.eventId!==pkg.targetId)ensureRow(w.eventId,w.horseId,w.horseNo);}
 const facts=[],missing=[];
 for(const o of pkg.observations){
  const k=key(o.eventId,o.horseId,o.field),e=events.get(o.eventId);
  const row=o.horseId===null?null:ensureRow(o.eventId,o.horseId,o.eventId===pkg.targetId?roster.get(o.horseId).horseNo:o.pastHorseNo);
  const dest=row?row.observations:e.observations,identity=row?nodeForRow.get(key(o.eventId,o.horseId)):e.eventRoot;
  const state=states.get(k);
  const allSourceRefs=(state?.sources??[]).map(s=>{
   const root=s.root,d=docs.get(root.documentId);
   assert.ok(d&&d.eventId===o.eventId&&root.field===o.field,'GRAPH_SOURCE_FIELD_BINDING');
   return {source:s,ref:add('SOURCE_FIELD',{eventId:o.eventId,horseId:o.horseId,pastHorseNo:o.pastHorseNo,field:o.field,root,state:s.state,reason:s.reason},[docRoot(d),identity])};
  });
  const chosen=o.roots.map(root=>{const match=allSourceRefs.filter(s=>key(s.source.root)===key(root));assert.equal(match.length,1,'GRAPH_OBSERVATION_ROOT_BINDING');return match[0].ref;});
  if(o.state==='OBSERVED')assert.ok(chosen.length&&allSourceRefs.filter(s=>chosen.includes(s.ref)).every(s=>s.source.state==='OBSERVED'),'GRAPH_OBSERVED_ONLY');
  const factId=add(o.state==='OBSERVED'?'OBSERVATION':'UNAVAILABLE_FIELD',{eventId:o.eventId,horseId:o.horseId,pastHorseNo:o.pastHorseNo,field:o.field,state:o.state,value:o.value,reason:o.reason},[identity,...(o.state==='OBSERVED'?chosen:allSourceRefs.map(s=>s.ref))]);
  facts.push({key:k,state:o.state,value:o.value,reason:o.reason,factId,sourceRefs:allSourceRefs.map(s=>s.ref),chosenRefs:chosen});
  if(o.state==='OBSERVED')dest[o.field]={state:observed,value:o.value,evidenceId:factId};
  else{dest[o.field]={state:o.state,value:null,reason:o.reason};missing.push({key:k,state:o.state,reason:o.reason,evidenceId:factId});if(row)row.unavailable.push({field:o.field,state:o.state,reason:o.reason});}
 }
 const target=events.get(pkg.targetId);
 assert.equal(target.rows.length,pkg.roster.length);
 const packet={schema:'REBORN2_ISSUED_PARTIAL_GRAPH_1',scope:fixture?'FIXED_FIXTURE_GRAPH_ONLY':'NATIVE_PARTIAL_GRAPH_VERIFIED',target:{eventId:pkg.targetId},cutoff:pkg.cutoff,events:[target,...[...events.values()].filter(e=>e!==target)],roots:[...roots.values()],items:target.rows.map(h=>({horseId:h.nativeId,items:itemIds.map(item=>({item,state:'HELD',reason:'FULL_ITEM_JUDGMENT_NOT_ESTABLISHED'}))})),groups:118,held:826,missing,formal:false};
 const metadata={engineCommit:ENGINE,converterVersion:version,converterBlob:pins[version],manifestDigest,packageDigest:sha(pkg),sourceStatesDigest:sha(converted.sourceStates),canonicalRaceKey:sha([ENGINE,ev.get(pkg.targetId).issuer,ev.get(pkg.targetId).nativeId]),scheduledPost:pkg.scheduledPost,startLower:pkg.startLower,cutoff:pkg.cutoff,rosterDigest:sha(pkg.roster),sourceGraphDigest:sha(packet),factsDigest:sha(facts)};
 return {packet,facts,metadata,pkg};
}
// Pure validation, never grants admission or a capability.
export function validateGraphClosure(packet){
 const m=index(packet.roots,r=>r.id),done=new Set(),visiting=new Set();
 function visit(id){assert.ok(m.has(id),'MISSING_GRAPH_ROOT');assert.ok(!visiting.has(id),'GRAPH_CYCLE');if(done.has(id))return;const r=m.get(id);assert.equal(r.id,sha([r.kind,r.payload,r.depends]),'GRAPH_ROOT_HASH');visiting.add(id);r.depends.forEach(visit);visiting.delete(id);done.add(id);}
 for(const id of m.keys())visit(id);
 return {roots:m.size,verified:done.size};
}
function issue(g,{fixture,approvalDigest=null,analysisTiming=null,replayReceipt=null,validUntil=null}){
 const {packet,facts,metadata,pkg}=g;
 validateGraphClosure(packet);
 if(!fixture)assertTargetOutcomeIsolation(packet);
 // Only fixture path may use count-based rank interval; native needs
 // independent historical classification, absent in this schema.
 const runners=computePartial(packet,{native:!fixture,strictMissing:true,completeHistory:fixture?null:[]});
 const m=new Map(packet.roots.map(r=>[r.id,r]));
 for(const h of runners)for(const i of h.analysisItems)for(const f of i.partialFindings){
  const seen=new Set();function visit(id){if(seen.has(id))return;assert.ok(m.has(id));seen.add(id);m.get(id).depends.forEach(visit);}
  f.directRefs.forEach(visit);assert.deepEqual([...seen].sort(),f.refs);
 }
 const receipt=freeze({...metadata,approvalDigest,scope:packet.scope,outputDigest:sha(runners),...(analysisTiming?{analysisTiming,replayReceipt,validUntil}:{}),formal:false,realAdmission:false,persistenceAllowed:false});
 const capability=Object.freeze({schema:'REBORN2_GRAPH_REVIEW_CAPABILITY_1',receiptDigest:sha(receipt)});
 registry.set(capability,freeze({packet,facts,receipt,runners,roster:pkg.roster,availability:availability(pkg,runners)}));
 return capability;
}
export function exerciseExistingGraph(version='08'){
 assert.ok(['07','08','11'].includes(version));
 const {b,trust}=partialFixture(),x=(version==='11'?convert11:version==='08'?convert08:convert07)(b,trust);
 assert.equal(x.scope,'EXISTING_WORK44_FIXTURE_CONVERSION_ONLY');
 const witnesses=b.identity.payload.rows.map(w=>({eventId:w.eventId,horseNo:w.no,horseId:w.horseId,displayName:w.displayName,proofRef:trust.expectedIdentitySha256}));
 return issue(build(x,witnesses,{fixture:true,version,manifestDigest:trust.expectedManifestSha256}),{fixture:true});
}
// The two signatures and pins are independent. The analysis approval must
// bind original descriptor, exact converter, package, evidence graph, rights,
// custody, identities, complete roster and version inventory review. The
// signature is an attestation of separately performed review, not proof by
// itself of source authenticity. No key/pin or real source configured.
export function issueNativeGraph(request){return issueNativeGraphMode(request,'PROSPECTIVE');}
export function issueRetrospectiveGraph(request){return issueNativeGraphMode(request,'RETROSPECTIVE');}
function issueNativeGraphMode(request,mode){
 assert.equal(authority.state,'CONFIGURED','MAIN_NATIVE_APPROVAL_NOT_CONFIGURED');
 const startAt=Date.now();
 const v11=request?.version==='11';
 exact(request,['version','signedManifest','raws','approval',...(v11?['originals']:[])]);
 assert.ok(['07','08','11'].includes(request.version));
 const manifestDigest=verifyPinned(request.signedManifest,authority.sourceKey,authority.sourcePins);
 const approvalDigest=verifyPinned(request.approval,authority.reviewKey,authority.approvalPins),a=request.approval.payload;
 const extra=[...(v11?['originalReplayDigest','officialRosterStatusReviewDigest']:[]),...(mode==='RETROSPECTIVE'?['outcomePartitionReviewDigest','sealedOutcomeCommitment']:[])];
 exact(a,['schema','engineCommit','converterBlob','manifestDigest','packageDigest','sourceStatesDigest','sourceGraphDigest','factsDigest','rosterDigest','canonicalRaceKey','rightsReviewDigest','identityReviewDigest','custodyReviewDigest','versionReviewDigest','rosterReviewDigest','validUntil',...extra]);
 assert.equal(a.schema,mode==='RETROSPECTIVE'?'REBORN2_RETROSPECTIVE_GRAPH_APPROVAL_1':v11?'REBORN2_NATIVE_GRAPH_APPROVAL_2':'REBORN2_NATIVE_GRAPH_APPROVAL_1');
 assert.equal(a.engineCommit,ENGINE);assert.equal(a.converterBlob,pins[request.version]);assert.equal(a.manifestDigest,manifestDigest);
 for(const k of ['rightsReviewDigest','identityReviewDigest','custodyReviewDigest','versionReviewDigest','rosterReviewDigest',...extra])assert.ok(hex(a[k]),'INDEPENDENT_REVIEW_DIGEST');
 const timing=checkAnalysisTime({mode,cutoff:request.signedManifest.payload.cutoff,startLower:request.signedManifest.payload.startLower,scheduledPost:request.signedManifest.payload.scheduledPost,validUntil:a.validUntil},startAt);
 const sourceTrust={authorityPublicKeyPem:authority.sourceKey,expectedManifestSha256:manifestDigest};
 let replayReceipt=null;
 if(v11){const manifest=verify11(request.signedManifest,sourceTrust);replayReceipt=replayOfficialOriginals(manifest,request.raws,request.originals);assert.equal(replayReceipt.replayDigest,a.originalReplayDigest,'APPROVAL_ORIGINAL_REPLAY_BINDING');}
 const x=(v11?local11:request.version==='08'?local08:local07)(request.signedManifest,request.raws,sourceTrust);
 assert.equal(x.scope,'LOCAL_EXTRACTION_NOT_ADMISSION');
 // A status inferred from a numbered HTML row is not sufficient by itself.
 // Require explicitly pinned manifest status and independent signed official
 // roster semantics review; unresolved/excluded status remains UNKNOWN.
 if(v11)for(const h of x.package.roster){const declared=request.signedManifest.payload.roster.find(q=>q.horseId===h.horseId);assert.ok(declared);if(h.status==='ACTIVE')assert.equal(declared.status,'ACTIVE','EXPLICIT_REVIEWED_ACTIVE_REQUIRED');}
 const g=build(x,request.signedManifest.payload.rowWitnesses,{fixture:false,version:request.version,manifestDigest});
 for(const k of ['packageDigest','sourceStatesDigest','sourceGraphDigest','factsDigest','rosterDigest','canonicalRaceKey'])assert.equal(a[k],g.metadata[k],'APPROVAL_GRAPH_BINDING '+k);
 checkAnalysisTime({mode,cutoff:g.pkg.cutoff,startLower:g.pkg.startLower,scheduledPost:g.pkg.scheduledPost,validUntil:a.validUntil},Date.now());
 // Outcome commitment is a signed external partition attestation, not an
 // outcome or proof of sealing by this process. Never enters packet/engine.
 return issue(g,{fixture:false,approvalDigest,analysisTiming:timing,replayReceipt,validUntil:a.validUntil});
}
// Review preparation deliberately does not issue a graph, run analysis, sign,
// install authority, or persist. The independent source reviewer must obtain
// source trust OUTSIDE this API and already have authorized local raw bytes.
// Its caller-supplied trust is not used by issueNativeGraph.
export function prepareNativeReviewOffline({version,signedManifest,raws,sourceTrust,originals}){
 assert.ok(['07','08','11'].includes(version));
 exact(sourceTrust,['authorityPublicKeyPem','expectedManifestSha256']);
 const manifestDigest=sha(signedManifest.payload);
 assert.equal(manifestDigest,sourceTrust.expectedManifestSha256,'REVIEW_SOURCE_PIN');
 const replayReceipt=version==='11'?replayOfficialOriginals(verify11(signedManifest,sourceTrust),raws,originals):null;
 const x=(version==='11'?local11:version==='08'?local08:local07)(signedManifest,raws,sourceTrust);
 assert.equal(x.scope,'LOCAL_EXTRACTION_NOT_ADMISSION');
 const g=build(x,signedManifest.payload.rowWitnesses,{fixture:false,version,manifestDigest});
 const draft=reviewPreparation(g);
 if(replayReceipt){draft.replayReceipt=replayReceipt;draft.approvalPayloadBase.originalReplayDigest=replayReceipt.replayDigest;draft.requiredIndependentReviews.push('officialRosterStatusReviewDigest');}
 return draft;
}
function reviewPreparation(g){
 const closure=validateGraphClosure(g.packet),m=g.metadata;
 const documents=g.pkg.documents.map(d=>({id:d.id,eventId:d.eventId,role:d.role,sha256:d.sha256,sourceRef:d.sourceRef,version:d.version,publishedAt:d.publishedAt,updatedAt:d.updatedAt,capturedAt:d.capturedAt,uncertaintyMs:d.uncertaintyMs,supersedes:d.supersedes,permissionRef:d.permissionRef,custodyRef:d.custodyRef}));
 return {schema:'REBORN2_OFFLINE_REVIEW_DRAFT_1',scope:'LOCAL_REVIEW_ONLY_NOT_AUTHORITY',metadata:structuredClone(m),closure,documents,facts:structuredClone(g.facts),roots:structuredClone(g.packet.roots),requiredIndependentReviews:['rightsReviewDigest','identityReviewDigest','custodyReviewDigest','versionReviewDigest','rosterReviewDigest'],approvalPayloadBase:Object.fromEntries(['engineCommit','converterBlob','manifestDigest','packageDigest','sourceStatesDigest','sourceGraphDigest','factsDigest','rosterDigest','canonicalRaceKey'].map(k=>[k,m[k]])),analysisExecuted:false,approvalIssued:false,realAdmission:false,persistenceAllowed:false};
}
// Fixed fixture verifies reviewer and issuance calculate the same digests;
// this is not a native approval and cannot register a capability.
export function exerciseExistingReviewPreparation(version='08'){
 assert.ok(['07','08'].includes(version));
 const {b,trust}=partialFixture(),x=(version==='08'?convert08:convert07)(b,trust);
 const witnesses=b.identity.payload.rows.map(w=>({eventId:w.eventId,horseNo:w.no,horseId:w.horseId,displayName:w.displayName,proofRef:trust.expectedIdentitySha256}));
 return reviewPreparation(build(x,witnesses,{fixture:true,version,manifestDigest:trust.expectedManifestSha256}));
}

const lookup=c=>{const x=registry.get(c);assert.ok(x,'ISSUED_GRAPH_CAPABILITY_REQUIRED');return x;};
export function readIssuedGraph(c){return structuredClone(lookup(c));}
export function reviewAllHorses(c){
 const x=lookup(c);return structuredClone({receipt:x.receipt,availability:x.availability,roster:x.roster.map(h=>{
 const runner=x.runners.find(r=>r.horse===h.horseId),card=x.packet.events.find(e=>e.role==='TARGET_CARD').rows.find(r=>r.nativeId===h.horseId);
 return {horseId:h.horseId,horseNo:h.horseNo,displayName:card.observations.displayName?.value??null,status:h.status,grade:runner.grade,formalGrade:null,findings:runner.analysisItems.filter(i=>i.partialFindings.length).map(i=>({item:i.item,name:names.get(i.item),state:i.state,count:i.partialFindings.length})),held:runner.analysisItems.filter(i=>!i.partialFindings.length).length,axes:runner.ability.axes.map(a=>({axis:a.axis,state:a.state,count:a.observations.length})),winPaths:[],placePaths:[]};
 })});
}
// Source pointers are material candidates, never evidence of an item judgment.
// Map all 115 items to their existing canonical group; narrow key routes
// when the actual item is about a particular reported quantity.
const groupFields=Object.freeze({
 history:['finish','finishClockLiteral','officialMarginLiteral','final600Ms','cornerPositionsLiteral'],
 peer:['finish','finishClockLiteral','officialMarginLiteral','final600Ms','declaredCount','status'],
 history_compare:['finish','finishClockLiteral','officialMarginLiteral','final600Ms','cornerPositionsLiteral','cornerGroupSlots','leaderLapSlots','surfaceLiteral','distanceM','goingLiteral','directionLiteral','classLiteral','gate','weightG','status','declaredCount'],
 split_or_context:['cornerPositionsLiteral','cornerGroupSlots','leaderLapSlots','final600Ms','finishClockLiteral','distanceM','courseVersion','declaredCount'],
 course:['distanceM','surfaceLiteral','directionLiteral','goingLiteral','courseVersion','gate'],
 class_rules:['classLiteral','courseVersion','finish','declaredCount'],
 rating:[],incident:[],day:[],training:[],people:[],pedigree:[],travel:[]
});
const specific=Object.freeze({
 RANK02:['finish','declaredCount','status'],RANK03:['officialMarginLiteral','finishClockLiteral','finish'],RANK05:['finishClockLiteral'],RANK06:['final600Ms'],RANK08:['finishClockLiteral','final600Ms','cornerPositionsLiteral','leaderLapSlots','courseVersion'],RANK17:['cornerPositionsLiteral','cornerGroupSlots'],RANK18:['cornerPositionsLiteral','cornerGroupSlots','declaredCount'],RANK19:['leaderLapSlots','distanceM'],RANK35:['finish','final600Ms','status','declaredCount'],RANK43:['distanceM'],RANK47:['surfaceLiteral'],RANK48:['goingLiteral'],RANK49:['directionLiteral','courseVersion'],RANK54:['weightG'],RANK81:['bodyWeightKg','bodyWeightDeltaKg'],EYE02:['finish','final600Ms','declaredCount','status']
});
function materialTrace(x,horseId,item){
 const meta=planning.get(item),fields=specific[item]??groupFields[meta.group]??[];
 const events=x.packet.events.filter(e=>e.rows.some(r=>r.nativeId===horseId));
 const relevant=new Set(events.map(e=>e.eventId));
 const facts=x.facts.filter(f=>{const [e,h,k]=JSON.parse(f.key);return relevant.has(e)&&(h===null||h===horseId)&&fields.includes(k);});
 const m=new Map(x.packet.roots.map(r=>[r.id,r])),refs=new Set();
 function visit(id){if(refs.has(id))return;const n=m.get(id);assert.ok(n,'TRACE_ROOT');refs.add(id);n.depends.forEach(visit);}
 for(const f of facts){visit(f.factId);f.sourceRefs.forEach(visit);}
 const trace=facts.map(f=>{const [eventId,subject,field]=JSON.parse(f.key);return {eventId,subject,field,state:f.state,value:f.value,reason:f.reason,factId:f.factId,sourceRefs:f.sourceRefs,chosenRefs:f.chosenRefs,sourcePresent:f.sourceRefs.length>0};});
 return {group:meta.group,fields,trace,roots:[...refs].map(id=>m.get(id)),absentFields:fields.filter(f=>!trace.some(t=>t.field===f)),scope:'SOURCE_MATERIAL_ONLY_NOT_ITEM_SUPPORT'};
}
export function reviewHorseItems(c,horseId){
 const x=lookup(c),h=x.runners.find(h=>h.horse===horseId);assert.ok(h,'HORSE_NOT_IN_ISSUED_ROSTER');
 return structuredClone(h.analysisItems.map(i=>({item:i.item,name:names.get(i.item),state:i.state,findings:i.partialFindings.length})));
}

export function reviewHorseItem(c,horseId,item){
 const x=lookup(c),h=x.runners.find(h=>h.horse===horseId);assert.ok(h,'HORSE_NOT_IN_ISSUED_ROSTER');
 const i=h.analysisItems.find(i=>i.item===item);assert.ok(i,'UNKNOWN_ITEM');
 const refs=new Set(i.partialFindings.flatMap(f=>f.refs));
 return structuredClone({horseId,item,name:names.get(item),state:i.state,findings:i.partialFindings,roots:x.packet.roots.filter(r=>refs.has(r.id)),hold:i.reason,materialTrace:materialTrace(x,horseId,item),materialHolds:x.availability.requirements.filter(q=>q.items.includes(item)),formal:false});
}

// Independent reviewer only. Resolve only the exact converter-emitted field
// pointer, never a caller-defined arbitrary column or whole source document.
// Raw bytes must match the reviewed document digest every time.
function resolveOriginalField(draft,descriptors,raws,rootId){
 const n=draft.roots.find(r=>r.id===rootId&&r.kind.endsWith('_SOURCE_FIELD'));
 assert.ok(n,'SOURCE_FIELD_NOT_IN_REVIEW');
 const root=n.payload.root,d=draft.documents.find(x=>x.id===root.documentId),descriptor=descriptors.find(x=>x.id===root.documentId),raw=raws.get(root.documentId);
 assert.ok(d&&descriptor&&Buffer.isBuffer(raw),'REVIEW_ORIGINAL_MISSING');
 assert.equal(createHash('sha256').update(raw).digest('hex'),d.sha256,'REVIEW_ORIGINAL_HASH');
 const p=JSON.parse(root.rowPointer);let original;
 if(Object.hasOwn(p,'columns')){
  assert.ok(['NAR_HORSELIST_36','NAR_RACELIST_66'].includes(descriptor.format));
  const row=csvRows(raw,descriptor.encoding).find(x=>x.record===p.record);
  assert.ok(row&&row.start===p.start&&row.end===p.end,'REVIEW_CSV_POINTER');
  assert.ok(p.columns.every(i=>Number.isInteger(i)&&i>=1&&i<=row.fields.length),'REVIEW_CSV_COLUMNS');
  original=p.columns.map(column=>({column,literal:row.fields[column-1]}));
 }else{
  assert.ok(['NAR_STORED_CORNER_SNAPSHOT_1','OFFICIAL_CARD_STATUS_PROJECTION_1','JRA_STORED_ROW_JSON_1','NAR_DEBA_HTML_PROJECTION_1','NAR_HISTORY_HTML_PROJECTION_1','JRA_CORNER_HTML_PROJECTION_1','NAR_RESULT_HTML_PROJECTION_1'].includes(descriptor.format),'REVIEW_JSON_FORMAT');
  assert.ok(typeof p.row==='string'&&typeof p.field==='string');
  const parts=[...p.row.split(/[./]/),p.field];
  assert.ok(parts.every(k=>/^[A-Za-z0-9_]+$/.test(k)&&!['__proto__','prototype','constructor'].includes(k)),'REVIEW_JSON_POINTER');
  let v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  for(const k of parts){if(v===null||typeof v!=='object'||!Object.hasOwn(v,k)){v=undefined;break;}v=v[k];}
  original=v===undefined?{present:false}:{present:true,literal:v};
 }
 return {scope:'OFFLINE_ORIGINAL_FIELD_REVIEW_NOT_ANALYSIS',rootId,documentId:d.id,sha256:d.sha256,sourceRef:d.sourceRef,rowPointer:p,state:n.payload.state,reason:n.payload.reason,original,realAdmission:false};
}
export function inspectNativeOriginalFieldOffline(request,rootId){
 const draft=prepareNativeReviewOffline(request);
 return resolveOriginalField(draft,request.signedManifest.payload.documents,request.raws,rootId);
}
export function inspectExistingOriginalField(rootId,version='08'){
 const {b}=partialFixture(),draft=exerciseExistingReviewPreparation(version);
 return resolveOriginalField(draft,b.manifest.payload.documents,new Map(b.rawFiles.map(x=>[x.id,Buffer.from(x.base64,'base64')])),rootId);
}

// Only issued capabilities may enter NORMAL; no caller-constructed graph.
export function runNormalReview(c,{eyeEnabled=true}={}){
 assert.equal(typeof eyeEnabled,'boolean');const x=lookup(c);
 if(x.packet.scope==='FIXED_FIXTURE_GRAPH_ONLY')return computeNormal(x.packet,x.roster,{fixture:true,eyeEnabled});
 const timing=x.receipt.analysisTiming;assert.ok(timing,'NATIVE_ANALYSIS_TIMING_REQUIRED');
 assertTargetOutcomeIsolation(x.packet);
 const began=Date.now();checkAnalysisTime({...timing,cutoff:timing.featureCutoff,validUntil:x.receipt.validUntil},began);
 const result=computeNormalFromSupply(prepareNormalSupply(c),x.receipt.sourceGraphDigest,x.packet,{eyeEnabled});
 const ended=Date.now();checkAnalysisTime({...timing,cutoff:timing.featureCutoff,validUntil:x.receipt.validUntil},ended);
 const output={...result,analysisTiming:{...timing,analysisAt:new Date(began).toISOString(),completedAt:new Date(ended).toISOString()},retrospective:timing.mode==='RETROSPECTIVE',publicationAllowed:false,approvalDigest:x.receipt.approvalDigest};
 return {...output,analysisDigest:sha(output)};
}
