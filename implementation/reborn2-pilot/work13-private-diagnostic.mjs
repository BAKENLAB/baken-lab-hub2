// Actual Work13 ordinary FACT packet; no official original, no native
// admission, no source signer impersonation. One exact reviewed handoff
// only. Keep all source/analysis data local; don't run this in public CI.
import assert from 'node:assert/strict';
import {ENGINE,sha} from './adapter.mjs';
import {computeNormalDiagnostic} from './normal-engine.mjs';
import {assertTargetOutcomeIsolation} from './work11-original-replay.mjs';
export const WORK13_COMMIT='aee12eff528e264ebf6fd06145065f14fc060f84';
export const WORK13_PACKET_DIGEST='5d364d4cc8c7843167390b1400058e85c8579f3dbc732084d7cee4b25ee97e17';
const venue={'佐賀':'32','船橋':'19','園田':'27'},unique=a=>[...new Set(a)].sort();
const exact=(x,k)=>assert.deepEqual(Object.keys(x).sort(),[...k].sort());
const state='REPORTED_DIAGNOSTIC_FACT';
export function buildWork13Diagnostic(p){
 assert.equal(sha(p),WORK13_PACKET_DIGEST,'WORK13_FIXED_PACKET_REQUIRED');
 assert.equal(p.schema,'REBORN2_NORMAL_REAL_FACT_DIAGNOSTIC_1');
 assert.equal(p.scope,'PRIVATE_PRESTART_FACT_DIAGNOSTIC_NOT_NATIVE_ADMISSION');
 assert.equal(p.target.targetOutcomeIncluded,false);
 assert.ok(['marketUsed','oddsIncluded','popularityIncluded','claimStarted','predictionSaved','frozenModified'].every(k=>p.guards[k]===false));
 const cutoff=p.capture.renderedDomObservedAt,post=p.target.scheduledPost;
 assert.ok(Date.parse(cutoff)<Date.parse(post));assert.equal(p.capture.rawHtmlPreserved,false);
 assert.equal(p.roster.length,7);assert.equal(new Set(p.roster.map(h=>h.horseId)).size,7);
 assert.deepEqual(p.roster.map(h=>h.no),[1,2,3,4,5,6,7]);
 const roots=new Map(),events=new Map(),rowIndex=new Map(),historical=new Map();
 const add=(kind,payload,depends=[])=>{const k='DIAGNOSTIC_'+kind,d=unique(depends),id=sha([k,payload,d]);if(!roots.has(id))roots.set(id,{kind:k,payload,depends:d,id});return id;};
 const make=(eventId,dateJst,track,raceNo,role)=>{
  if(events.has(eventId))return events.get(eventId);
  assert.ok(venue[track]&&Number.isInteger(raceNo)&&raceNo>=1&&raceNo<=12);
  const ident={id:eventId,issuer:'NAR',nativeId:eventId,venueId:venue[track],dateJst,raceNo,role};
  const eventRoot=add('EVENT_IDENTITY',ident),doc=add('SOURCE_DOCUMENT',{eventId,role,id:'WORK13_REPORTED:'+eventId,sourceRef:p.source.raceCardUrl,sha256:WORK13_PACKET_DIGEST,representation:'WORK13_FACT_PACKET_NOT_ORIGINAL',capturedAt:cutoff},[eventRoot]);
  const e={eventId,role,nativeRaceIdentity:{issuer:ident.issuer,nativeId:ident.nativeId,venueId:ident.venueId,dateJst,raceNo},eventRoot,observations:{},rows:[],doc};
  events.set(eventId,e);return e;
 };
 function put(e,h,k,value,path,extra={}){
  if(value===null||value===undefined)return;
  const subject=h?.nativeId??null,dest=h?h.observations:e.observations,identity=h?h.observations.no.evidenceId:e.eventRoot;
  const sr=add('SOURCE_FIELD',{eventId:e.eventId,horseId:subject,field:k,root:{documentId:e.doc,field:k,rowPointer:JSON.stringify({path,...extra})},state:'REPORTED',reason:'WORK13_RENDERED_CARD_FACT_NOT_INDEPENDENT_ORIGINAL_REPLAY'},[e.doc,identity]);
  // Multiple subject rows can report the same race context; equal values
  // merge their roots, differing values are held instead of last-write.
  const old=dest[k];if(old?.state==='CONFLICT')return;
  if(old&&JSON.stringify(old.value)!==JSON.stringify(value)){dest[k]={state:'CONFLICT',value:null,reason:'REPORTED_EVENT_FIELD_CONFLICT'};return;}
  const previous=old?roots.get(old.evidenceId).depends.filter(id=>roots.get(id).kind.endsWith('_SOURCE_FIELD')):[];
  const n=add('OBSERVATION',{eventId:e.eventId,horseId:subject,field:k,state:'REPORTED',value},[identity,sr,...previous]);
  dest[k]={state,value,evidenceId:n};
 }
 const row=(e,h,no,path)=>{
  const k=JSON.stringify([e.eventId,h]);assert.ok(!rowIndex.has(k),'DUPLICATE_REPORTED_ROW');
  assert.ok(!e.rows.some(q=>q.observations.no.value===no),'DUPLICATE_REPORTED_HORSE_NO');
  const id=add(e.role==='TARGET_CARD'?'TARGET_ROSTER_ROW':'HISTORICAL_ROW_IDENTITY',{eventId:e.eventId,horseId:h,horseNo:no,sourcePath:path},[e.eventRoot,e.doc]);
  const q={nativeId:h,observations:{no:{state,value:no,evidenceId:id}}};e.rows.push(q);rowIndex.set(k,q);return q;
 };
 const target=make(p.target.raceId,p.target.raceDate,p.target.track,p.target.raceNo,'TARGET_CARD');
 for(const [field,key] of [['surfaceLiteral','surface'],['directionLiteral','direction'],['distanceM','distanceM'],['goingLiteral','going'],['classLiteral','classLiteral']])put(target,null,field,p.target[key],'/target/'+key);
 // No explicit independent declaredCount field in the packet; complete
 // reported roster is retained without converting its length to official count.
 const roster=p.roster.map((h,i)=>{
  assert.ok(/^\d{11}$/.test(h.horseId)&&h.status==='ACTIVE');
  const q=row(target,h.horseId,h.no,'/roster/'+i);
  put(target,q,'displayName',h.name,'/roster/'+i+'/name');
  put(target,q,'status',h.status,'/roster/'+i+'/status');
  put(target,q,'weightG',Math.round(h.carriedKg*1000),'/roster/'+i+'/carriedKg',{unit:'kg',conversion:'kg_to_g'});
  return {horseId:h.horseId,horseNo:h.no,status:h.status,displayName:h.name};
 });
 let cancelled=0,completed=0;
 for(const [i,h] of p.latestFiveDisplayed.entries()){
  assert.equal(h.horseId,roster[i].horseId);assert.equal(h.name,roster[i].displayName);assert.equal(h.runs.length,5);
  const own=[];
  for(const [j,z] of h.runs.entries()){
   const path='/latestFiveDisplayed/'+i+'/runs/'+j;
   assert.ok(z.date<p.target.raceDate&&venue[z.track]);assert.ok(Number.isInteger(z.pastHorseNo)&&z.pastHorseNo>0);
   const eid='NAR-'+venue[z.track]+'-'+z.date.replaceAll('-','')+'-'+String(z.raceNo).padStart(2,'0');
   if(z.status==='CANCELLED'){assert.equal(z.finish,null);cancelled++;own.push({event:eid,date:z.date,status:'CANCELLED'});continue;}
   assert.ok(Number.isInteger(z.finish)&&z.finish>=1&&z.finish<=24);completed++;
   const e=make(eid,z.date,z.track,z.raceNo,'HISTORICAL_RESULT'),q=row(e,h.horseId,z.pastHorseNo,path);
   put(e,null,'distanceM',z.distanceM,path+'/distanceM');put(e,null,'goingLiteral',z.going,path+'/going');
   // Race name is not verified class; track alone is not surface/direction.
   put(e,q,'finish',z.finish,path+'/finish');
   put(e,q,'finishClockLiteral',z.time,path+'/time');
   if(Number.isFinite(z.final3f))put(e,q,'final600Ms',Math.round(z.final3f*1000),path+'/final3f',{unit:'seconds',conversion:'seconds_to_ms'});
   // Reported ordinal sequence, not independently labeled corners. No
   // inferred labels, distances, field count or start/pace claim.
   if(Array.isArray(z.corners)&&z.corners.length>=2&&z.corners.every(n=>Number.isInteger(n)&&n>=1&&n<=24))put(e,q,'cornerPositionsLiteral',z.corners.join(','),path+'/corners',{convention:'ORDERED_REPORTED_POSITIONS_UNLABELED'});
   // Reported gap/reference horse role is not official winner margin.
   // Preserve the numerical fact in private diagnostics, not RANK03.
   const facts={event:eid,date:z.date,track:z.track,distanceM:z.distanceM,going:z.going,finish:z.finish,time:z.time,final3f:z.final3f,reportedGapSec:z.reportedGapSec,corners:z.corners};
   const gapRef=Number.isFinite(z.reportedGapSec)?add('REPORTED_GAP_LITERAL',{eventId:eid,horseId:h.horseId,value:z.reportedGapSec,unit:'seconds',pointer:path+'/reportedGapSec',limit:'DISPLAYED_DIFFERENCE_NOT_WINNER_MARGIN'},[e.doc,q.observations.no.evidenceId]):null;
   own.push({...facts,refs:unique([e.eventRoot,q.observations.no.evidenceId,...Object.values(q.observations).map(f=>f.evidenceId).filter(Boolean),gapRef].filter(Boolean))});
  }
  historical.set(h.horseId,own);
 }
 assert.equal(completed,34);assert.equal(cancelled,1);
 const packet={scope:'PRIVATE_REPORTED_FACT_GRAPH_ONLY',target:{eventId:target.eventId},cutoff,events:[...events.values()].map(({doc,...e})=>e),roots:[...roots.values()]};
 assertTargetOutcomeIsolation(packet);
 return {packet,roster,historical,completed,cancelled,post,cutoff};
}
export function runWork13Diagnostic(p,{eyeEnabled=true}={}){
 const {packet,roster,historical,completed,cancelled,post,cutoff}=buildWork13Diagnostic(p);
 const began=new Date().toISOString(),normal=computeNormalDiagnostic(packet,roster,{eyeEnabled});
 const runners=normal.runners.map(h=>{
  const history=historical.get(h.horse),runs=history.filter(z=>z.status!=='CANCELLED');
  const same=runs.filter(z=>z.track===p.target.track&&z.distanceM===p.target.distanceM);
  const exactGoing=same.filter(z=>z.going===p.target.going);
  const ordinal=runs.filter(z=>Array.isArray(z.corners)&&z.corners.length>=2);
  const directions=ordinal.map(z=>({event:z.event,delta:z.corners[0]-z.corners.at(-1),first:z.corners[0],last:z.corners.at(-1),finish:z.finish,refs:z.refs}));
  const discoveries=eyeEnabled?ordinal.filter(z=>z.corners.some((n,i)=>i>0&&n>z.corners[0])&&z.finish<Math.max(...z.corners)).map(z=>({event:z.event,finish:z.finish,positions:z.corners,refs:z.refs,scope:'REPORTED_RECOVERY_ONLY_CURRENT_RELEVANCE_UNVERIFIED'})):[];
  const direct=h.items.find(i=>i.item==='RANK35').findings.map(f=>f.value);
  return {...h,displayName:roster.find(q=>q.horseId===h.horse).displayName,history,reportedAnalysis:{completed:runs.length,cancelled:history.length-runs.length,wins:runs.filter(z=>z.finish===1).length,reportedTop3:runs.filter(z=>z.finish<=3).length,sameVenueDistance:same.map(z=>({event:z.event,finish:z.finish,going:z.going})),sameVenueDistanceGoing:exactGoing.map(z=>({event:z.event,finish:z.finish})),ordinalDirections:directions,reportedRecovery:discoveries,direct,scope:'PARTIAL_REPORTED_FACT_COMPARISON_NOT_CURRENT_CAPACITY'},specificHolds:['OFFICIAL_DECLARED_COUNT_NOT_SUPPLIED','HISTORICAL_CLASS_SURFACE_DIRECTION_NOT_VERIFIED','HISTORICAL_FULL_STARTER_CLASSIFICATION_NOT_SUPPLIED','CORNER_LABEL_BINDING_NOT_IN_HANDOFF_13_AGGREGATE_ONLY','OPPONENT_FOLLOWUP_22_AGGREGATE_ONLY','INDEPENDENT_FIELD_LEVEL_REVIEW_INCOMPLETE']};
 });
 const ended=new Date().toISOString(),body={...normal,runners,sourcePacketDigest:WORK13_PACKET_DIGEST,sourceGraphDigest:sha(packet),sourceReview:'WORK13_REPORTED_FACTS_NOT_INDEPENDENT_FIELD_LEVEL_ADMISSION',analysisTiming:{featureCutoff:cutoff,scheduledPost:post,analysisAt:began,completedAt:ended,mode:Date.parse(ended)<Date.parse(post)?'PRESTART_FACT_DIAGNOSTIC':'RETROSPECTIVE_FACT_DIAGNOSTIC',prospectiveForecast:false,externalTimestampVerified:false},coverage:{completed,cancelled,roster:roster.length,events:packet.events.length-1,roots:packet.roots.length,independentCornerAggregate:p.identityVerifiedCornerEvidence.count,peerFollowupAggregate:p.opponentFollowups.verifiedCount,independentlyMappedCornerRows:0,independentlyMappedFollowups:0},publicationAllowed:false,persistenceAllowed:false,realAdmission:false};
 return {...body,analysisDigest:sha(body)};
}
const esc=x=>String(x??'未確認').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderDiagnosticHtml(out){
 assert.equal(out.scope,'PRIVATE_REPORTED_FACT_DIAGNOSTIC_ONLY');assert.equal(out.publicationAllowed,false);
 const cards=out.runners.map(h=>'<article><h2>'+esc(h.horseNo)+'番 '+esc(h.displayName)+'</h2><p>候補評価：未評価／報告完走 '+h.reportedAnalysis.completed+'走</p><p>勝利 '+h.reportedAnalysis.wins+'／報告3着以内 '+h.reportedAnalysis.reportedTop3+'／同場同距離 '+h.reportedAnalysis.sameVenueDistance.length+'</p><p>成立した勝ち筋 '+h.winPaths.length+'／好走筋 '+h.placePaths.length+'</p><p>'+esc(h.decisionReason)+'</p><details><summary>今回能力・5観点・保留原因</summary><pre>'+esc(JSON.stringify({axes:h.axes.map(a=>({axis:a.axis,state:a.state,reason:a.reason})),holds:h.specificHolds},null,2))+'</pre></details><details><summary>過去走・展開材料・相手比較・EYE候補</summary><pre>'+esc(JSON.stringify(h.reportedAnalysis,null,2))+'</pre></details><details><summary>115項目</summary>'+h.items.map(i=>'<details><summary>'+esc(i.item+' '+i.name+' '+i.state)+'</summary><pre>'+esc(JSON.stringify({reason:i.reason,findings:i.findings},null,2))+'</pre></details>').join('')+'</details></article>').join('');
 return '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>REBORN2 NORMAL 非公開診断</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:800px;margin:auto;padding:16px;background:#eef2f2;color:#20352e}article{background:white;border:1px solid #ccd8d3;border-radius:12px;padding:14px;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}summary{cursor:pointer}h1{font-size:22px}h2{font-size:18px}</style><h1>佐賀5R｜NORMAL 非公開事実診断</h1><p>正式予想・原本完全照合・実競走評価承認ではありません。材料時点 '+esc(out.analysisTiming.featureCutoff)+'／分析時刻 '+esc(out.analysisTiming.analysisAt)+'</p><p>未確認の証拠を補完していません。SABC正式評価なし。</p>'+cards+'</html>';
}
