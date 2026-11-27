// Isolated implementation wrapper, never alters the V48 FINAL engine.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadV40,acceptedRequest,verifyIntake,analyzeVerified,analyzePartialVerified} from '../../research/reborn2-independent-engine/main47-integration/v43-generic.mjs';
import {makeEnvelope} from '../../research/reborn2-work42/validate-v0.4.mjs';
import {preparePartial} from '../../research/reborn2-work44/partial-bridge.mjs';
import {partialFixture} from './fixture-partial.mjs';
export const ENGINE='f565e88af3404c84328a6cd035d2f21df3ea49dc',VERSION='REBORN2_PILOT_SNAPSHOT_1';
export const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const exact=(x,ks)=>assert.deepEqual(Object.keys(x).sort(),[...ks].sort(),'UNEXPECTED_FIELDS');
const uniq=x=>[...new Set(x)];
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
export function assertFrozenEngine(){
 const root=fileURLToPath(new URL('../../',import.meta.url));
 // Compare every frozen research file, including working-tree content.
 // No untracked file can shadow an import without modifying a frozen source.
 const changed=execFileSync('git',['-C',root,'diff','--name-only',ENGINE,'--','research'],{encoding:'utf8'});
 assert.equal(changed.trim(),'','FROZEN_ENGINE_CHANGED');
 const untracked=execFileSync('git',['-C',root,'ls-files','--others','--exclude-standard','--','research'],{encoding:'utf8'});
 assert.equal(untracked.trim(),'','UNTRACKED_RESEARCH_FILE');
 return ENGINE;
}
export function inspectRealSupply(m){
 // Metadata intake only. No raw acquisition, parse, persistence or relabel.
 // Permission fields are requirements, not proof. The real gate cannot be
 // opened by caller-controlled flags or a self-issued receipt.
 exact(m,['schema','circuit','race','cutoff','sourceDigest','sourceDocuments','permissionEvidence','custodyEvidence']);
 assert.equal(m.schema,'REBORN2_REAL_SUPPLY_MANIFEST_1');
 assert.ok(['JRA','LOCAL'].includes(m.circuit));
 exact(m.race,['nativeRaceId','scheduledPost','startLower']);
 assert.ok(typeof m.race.nativeRaceId==='string'&&m.race.nativeRaceId.length&&!m.race.nativeRaceId.startsWith('TEST:'));
 assert.ok([m.cutoff,m.race.scheduledPost,m.race.startLower].every(timestamp));
 assert.ok(Date.parse(m.cutoff)<Date.parse(m.race.startLower)&&Date.parse(m.race.startLower)<=Date.parse(m.race.scheduledPost),'POST_BOUNDARY');
 assert.ok(hash(m.sourceDigest)&&Array.isArray(m.sourceDocuments)&&m.sourceDocuments.length);
 const ids=new Set();
 for(const d of m.sourceDocuments){
  exact(d,['documentId','role','nativeRaceId','version','publishedAt','updatedAt','capturedAt','uncertaintyMs','sha256','sourcePermissionRef']);
  assert.ok(typeof d.documentId==='string'&&d.documentId.length&&!ids.has(d.documentId));ids.add(d.documentId);
  assert.ok(['TARGET_CARD','HISTORICAL_RESULT','COURSE_CONTEXT'].includes(d.role));
  assert.ok(typeof d.nativeRaceId==='string'&&d.nativeRaceId.length&&!d.nativeRaceId.startsWith('TEST:'));
  if(d.role==='TARGET_CARD')assert.equal(d.nativeRaceId,m.race.nativeRaceId);
  if(d.role==='HISTORICAL_RESULT')assert.notEqual(d.nativeRaceId,m.race.nativeRaceId,'TARGET_RESULT_FORBIDDEN');
  assert.ok(Number.isSafeInteger(d.version)&&d.version>0&&hash(d.sha256));
  assert.ok([d.publishedAt,d.updatedAt,d.capturedAt].every(timestamp)&&Number.isSafeInteger(d.uncertaintyMs)&&d.uncertaintyMs>=0);
  assert.ok(Date.parse(d.publishedAt)<=Date.parse(d.updatedAt)&&Date.parse(d.updatedAt)<=Date.parse(d.capturedAt)&&Date.parse(d.capturedAt)+d.uncertaintyMs<=Date.parse(m.cutoff),'SOURCE_AFTER_CUTOFF');
  assert.ok(typeof d.sourcePermissionRef==='string'&&d.sourcePermissionRef.length);
 }
 assert.ok(m.sourceDocuments.some(d=>d.role==='TARGET_CARD'));
 assert.ok(Array.isArray(m.permissionEvidence)&&Array.isArray(m.custodyEvidence));
 return {state:'HELD_REAL_ADMISSION',circuit:m.circuit,raceId:m.race.nativeRaceId,sourceDigest:m.sourceDigest,blockers:['APPROVED_SOURCE_RIGHTS_AND_PROCESSING_SCOPE','NATIVE_FORMAT_AND_IDENTITY_CONFORMANCE','EXTERNAL_CUSTODY_TIME_AND_COMPLETE_ASOF_INVENTORY','VERIFIED_REAL_STATUS_AND_START_BOUNDARY','APPROVED_REAL_ENGINE_ADAPTER'],realAdmission:false,analysisAllowed:false,persistenceAllowed:false};
}
const fixtureClock=(cutoff,post)=>({domain:'SYNTHETIC_FIXTURE_TICKS',cutoff,analysisAt:cutoff+1,startLower:post,scheduledPost:post,prospective:false});
function scopeTime(t){
 if(t.domain==='SYNTHETIC_FIXTURE_TICKS'){assert.ok([t.cutoff,t.analysisAt,t.startLower,t.scheduledPost].every(Number.isSafeInteger));assert.ok(t.cutoff<=t.analysisAt&&t.analysisAt<t.startLower&&t.startLower<=t.scheduledPost);}
 else {assert.equal(t.domain,'SYNTHETIC_SIGNED_FIXTURE_TIME');assert.ok([t.cutoff,t.analysisAt,t.startLower,t.scheduledPost].every(timestamp));assert.ok(Date.parse(t.cutoff)<=Date.parse(t.analysisAt)&&Date.parse(t.analysisAt)<Date.parse(t.startLower)&&Date.parse(t.startLower)<=Date.parse(t.scheduledPost));}
 assert.equal(t.prospective,false);
}
const axesNames={A:'能力',B:'条件適性',C:'相手比較',D:'展開耐性',E:'LAB EYE'};
const gradeSet=['S','A','B','C','UNASSESSED'];
const axisView=(a,partial)=>partial?{axis:a.axis,name:axesNames[a.axis],...a}:{axis:a.axis,name:axesNames[a.axis],supportingRoutes:a.supportingRoutes,counterRoutes:a.counterRoutes,unknownRoutes:a.unknownRoutes,scope:'DETAILS_IN_PATH_AXES'};
// Full engine returns the same route judgments in multiple projections.
// Store the path once; item-level route reviews retain links, not repeated
// nested five-axis payloads. Keep all 115 item IDs and source-bound findings.
function itemView(i){
 const {routeReviewV47,...rest}=i;
 return {...rest,routeReviewV47:(routeReviewV47??[]).map(q=>({route:q.id??q.route,state:q.state,category:q.category,predicate:q.predicate,refs:q.refs??[]}))};
}
function wireBody(body){return JSON.parse(JSON.stringify(body));}
const textGrade=g=>g==='UNASSESSED'?'未評価':g;
const fullComments=(h,status)=>{
 if(status==='CANCELLED')return ['出走取消。評価を付けない。'];
 const c=[],paths=h.paths??[];
 const win=paths.find(p=>h.winPaths.includes(p.id)),place=paths.find(p=>h.placePaths.includes(p.id));
 const evidence=p=>{const pairs=p?.own??p?.axes?.find(a=>a.axis==='A')?.support.flatMap(x=>Array.isArray(x.value)?x.value:[])??[];const pair=pairs.find(q=>q.finish&&q.finish[0]>0);return pair?'対 '+pair.rival+'：相対時計差 '+pair.finish[0]+'〜'+pair.finish[1]+'ms（先着側）。':'';};
 if(win)c.push('条件付き勝ち筋 '+win.id+'。順位範囲 '+win.rank.join('〜')+'。'+evidence(win));
 if(place&&place.id!==win?.id)c.push('条件付き好走筋 '+place.id+'。順位範囲 '+place.rank.join('〜')+'。'+evidence(place));
 if(h.counterPaths.length){const p=paths.find(p=>h.counterPaths.includes(p.id)&&p.rank);c.push('反証・劣勢または再現性注意の経路 '+h.counterPaths.length+'件。'+(p?'例：'+p.id+'、条件付き順位範囲 '+p.rank.join('〜')+'。':''));}
 if(h.deployment.held.length)c.push('未成立の経路 '+h.deployment.held.length+'件。');
 if(h.grade==='UNASSESSED')c.push('未評価：'+h.decisionReason+'。');
 if(!c.length)c.push('研究評価 '+textGrade(h.grade)+'：'+h.decisionReason+'。');
 return c;
};
const partialComments=h=>{
 const fs=h.analysisItems.flatMap(i=>i.partialFindings),c=[];
 for(const f of fs.filter(x=>x.type==='REPORTED_FINISH'||x.type==='REPORTED_INDIVIDUAL_FINAL600'||x.type==='DIRECT_REPORTED_COMPARISON'||x.type==='REPORTED_CONTEXT')){
  const v=f.value;
  if(f.type==='REPORTED_FINISH')c.push(f.event+'：報告着順 '+v.finish+'着／登録'+v.declaredCount+'頭。');
  if(f.type==='REPORTED_INDIVIDUAL_FINAL600')c.push(f.event+'：個別上がり3F '+(v.ms/1000).toFixed(1)+'秒。');
  if(f.type==='DIRECT_REPORTED_COMPARISON')c.push(f.event+'：'+v.rival+'との直接対戦 '+(v.order==='AHEAD'?'先着':v.order==='BEHIND'?'後着':'同順位・未解決')+'。'+(v.final600DifferenceMs===null?'': '上がり差 '+v.final600DifferenceMs+'ms。'));
  if(f.type==='REPORTED_CONTEXT')c.push(f.event+'：報告条件 '+(v.state==='REPORTED_CONTEXT_MATCH'?'一致':v.state)+'。コース形状・クラス水準の同等性は未確認。');
 }
 c.push('今回の出走状態・個馬通過時計等が未確認のため、勝ち筋・好走筋とSABCは保留。');
 return c;
};
function build({race,time,sourceDigest,mode,roster,analysis}){
 scopeTime(time);assert.ok(hash(sourceDigest));
 assert.ok(roster.length&&new Set(roster.map(r=>r.horseId)).size===roster.length&&new Set(roster.map(r=>r.no)).size===roster.length);
 const by=new Map(analysis.map(h=>[h.horse,h]));assert.equal(by.size,analysis.length);assert.ok([...by.keys()].every(k=>roster.some(r=>r.horseId===k)));
 const runners=roster.map(r=>{
  const h=by.get(r.horseId);
  if(!h){assert.equal(r.status,'CANCELLED');return {...r,grade:'UNASSESSED',formalGrade:null,axes:Object.keys(axesNames).map(axis=>({axis,name:axesNames[axis],state:'HELD',unknown:['CANCELLED']})),winPaths:[],placePaths:[],counterPaths:[],paths:[],eye:[],comments:['出走取消。'],holdReasons:['CANCELLED'],analysisItems:[]};}
  assert.ok(gradeSet.includes(h.grade)&&h.formalGrade===null);
  if(r.status!=='ACTIVE')assert.equal(h.grade,'UNASSESSED');
  const partial=mode==='PARTIAL',holdReasons=uniq([...(h.missingness?.decisive??[]),...(partial?[]:h.paths.filter(p=>p.state==='HELD').flatMap(p=>p.decisiveUnknown??[])),...(r.status==='UNKNOWN'?['CURRENT_STATUS_UNCERTIFIED']:[])]);
  const axes=h.ability.axes.map(a=>axisView(a,partial));
  assert.deepEqual(axes.map(a=>a.axis),['A','B','C','D','E']);
  assert.equal(h.analysisItems.length,115);assert.equal(h.eye.length,15);
  return {...r,grade:h.grade,formalGrade:null,axes,winPaths:h.winPaths,placePaths:h.placePaths,counterPaths:h.counterPaths,paths:h.paths??[],eye:h.eye,comments:partial?partialComments(h):fullComments(h,r.status),holdReasons,analysisItems:partial?h.analysisItems:h.analysisItems.map(itemView),coverage:h.coverage??null,missingness:h.missingness,rankBounds:h.rankBoundsAcrossReviewedScenarios,decisionReason:h.decisionReason??h.eligibility};
 });
 const body=wireBody({schema:VERSION,mode,scope:'FIXTURE_ONLY',engineCommit:ENGINE,sourceDigest,race,time,runners,realAdmission:false,formal:false});
 return {...body,snapshotDigest:sha(body)};
}
// The only executable path remains the pinned fixture verifier. The
// caller cannot turn a real envelope into a fixture by changing a flag.
export async function executeVerifiedSupply(input){
 assertFrozenEngine();
 const fullKeys=['scope','mode','request','receipt','work42Envelope'];
 const partialKeys=['scope','mode','bundle','trust','candidate'];
 assert.equal(input.scope,'FIXTURE_ONLY','REAL_ENGINE_ADMISSION_CLOSED');
 if(input.mode==='PARTIAL'){
  exact(input,partialKeys);
  const {bundle:b,trust,candidate}=input;
  const z=analyzePartialVerified(b,trust,candidate),p=z.sourcePacket;
  const card=p.events.find(e=>e.role==='TARGET_CARD'),val=(r,k)=>r.observations[k]?.state==='OBSERVED_TEST_FORMAT'?r.observations[k].value:null;
  const roster=card.rows.map(r=>({horseId:r.nativeId,no:val(r,'no'),name:val(r,'displayName'),status:'UNKNOWN'}));
  const snapshot=build({race:{raceId:p.target.eventId,circuit:'LOCAL',label:'Work44 架空競走'},time:{domain:'SYNTHETIC_SIGNED_FIXTURE_TIME',cutoff:p.cutoff,analysisAt:trust.now,startLower:b.manifest.payload.startLower,scheduledPost:p.target.scheduledPost,prospective:false},sourceDigest:z.sourceDigest,mode:'PARTIAL',roster,analysis:z.runners});
  return {snapshot,sourceProof:{scope:'FIXTURE_ONLY',mode:'PARTIAL',sourceDigest:z.sourceDigest,packet:p,receipt:{manifest:trust.expectedManifestSha256,rights:trust.expectedRightsSha256,inventory:trust.expectedInventorySha256,identity:trust.expectedIdentitySha256}}};
 }
 assert.equal(input.mode,'FULL');exact(input,fullKeys);
 const {request,receipt,work42Envelope}=input,V=await loadV40();
 // Only previously accepted fixed complete fixture IDs and their exact
 // independently pinned bundle+packet are eligible in this wrapper.
 assert.ok(['FK34_FULL','FK34_UNKNOWN'].includes(request.id),'FIXTURE_NOT_ALLOWLISTED');
 const expected=acceptedRequest(V,request.id);
 assert.deepEqual(request,expected.request);assert.deepEqual(receipt,expected.receipt);
 const verified=verifyIntake(V,request,receipt),card=verified.docs[0];
 const z=await analyzeVerified(V,request,receipt,{semanticVersion:48,work42Envelope});
 const roster=card.rows.map(r=>({horseId:card.issuer+'|'+r.nativeId,no:r.no,name:'架空馬 '+r.nativeId.split(':').at(-1),status:r.status}));
 const snapshot=build({race:{raceId:card.eventId,circuit:card.issuer==='TEST:JRA'?'JRA':'LOCAL',label:'V48 '+request.id+' 架空競走'},time:fixtureClock(JSON.parse(request.bundleText).cases[0].input.manifest.cutoff,card.scheduledPost),sourceDigest:z.digest,mode:'FULL',roster,analysis:z.candidate.runners});
 return {snapshot,sourceProof:{scope:'FIXTURE_ONLY',mode:'FULL',sourceDigest:z.digest,packet:verified.packet,packetDigest:receipt.source_digest,bundleDigest:receipt.bundle_sha256,receipt}};
}
export async function executeFixtureWithProof(name='FK34_FULL'){
 if(name==='WORK44_PARTIAL'){
  const {b,trust}=partialFixture();
  return executeVerifiedSupply({scope:'FIXTURE_ONLY',mode:'PARTIAL',bundle:b,trust,candidate:preparePartial(b,trust)});
 }
 assert.ok(['FK34_FULL','FK34_UNKNOWN'].includes(name),'FIXTURE_NOT_ALLOWLISTED');
 const V=await loadV40(),{request,receipt}=acceptedRequest(V,name),verified=verifyIntake(V,request,receipt);
 return executeVerifiedSupply({scope:'FIXTURE_ONLY',mode:'FULL',request,receipt,work42Envelope:makeEnvelope(verified.docs)});
}
export async function executeFixture(name='FK34_FULL'){return (await executeFixtureWithProof(name)).snapshot;}
export function validateSnapshot(s){
 exact(s,['schema','mode','scope','engineCommit','sourceDigest','race','time','runners','realAdmission','formal','snapshotDigest']);
 const {snapshotDigest,...body}=s;assert.equal(sha(body),snapshotDigest,'SNAPSHOT_DIGEST');
 assert.equal(s.schema,VERSION);assert.equal(s.engineCommit,ENGINE);assert.equal(s.scope,'FIXTURE_ONLY');assert.equal(s.realAdmission,false);assert.equal(s.formal,false);assert.ok(hash(s.sourceDigest));scopeTime(s.time);
 assert.ok(['FULL','PARTIAL'].includes(s.mode)&&Array.isArray(s.runners)&&s.runners.length);
 assert.equal(new Set(s.runners.map(r=>r.horseId)).size,s.runners.length);assert.equal(new Set(s.runners.map(r=>r.no)).size,s.runners.length);
 for(const r of s.runners){assert.ok(gradeSet.includes(r.grade)&&r.formalGrade===null&&Number.isSafeInteger(r.no)&&r.no>0&&typeof r.name==='string');assert.ok(['ACTIVE','CANCELLED','UNKNOWN'].includes(r.status));if(r.status!=='ACTIVE')assert.equal(r.grade,'UNASSESSED');assert.deepEqual(r.axes.map(a=>a.axis),['A','B','C','D','E']);assert.ok(Array.isArray(r.comments)&&r.comments.length);for(const k of ['score','top5','odds','market','rank'])assert.ok(!Object.hasOwn(r,k),'LEGACY_FIELD');}
 return s;
}
