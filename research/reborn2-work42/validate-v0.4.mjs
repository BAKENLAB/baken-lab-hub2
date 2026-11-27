// Research-only canonical supply contract. No official acquisition or grades.
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=m=>{throw Error(m)}, need=(v,m)=>{if(!v)fail(m)}, int=Number.isSafeInteger;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b), unique=a=>new Set(a).size===a.length;
const exact=(o,k,m)=>need(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===[...k].sort().join('|'),m);
const id=x=>typeof x==='string'&&/^TEST:[A-Za-z0-9_-]+$/.test(x);
const date=x=>{need(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x),'INVALID_TIME');const t=Date.parse(x);need(Number.isFinite(t)&&new Date(t).toISOString()===x,'INVALID_TIME');return t;};
const iso=n=>new Date(n*1000).toISOString();
const base=['kind','issuer','eventId','version','publishedAt','updatedAt','rows','conditions','geometry'];
const conditions=['distance_m','surface','going','venue','class_label','class_version','effective_from','effective_until'];
const geometry=['direction','first_turn_m','straight_m','checkpoints_m','course_version','effective_from','effective_until'];
const safeLabel=x=>typeof x==='string'&&/^(?:TEST:[A-Za-z0-9_-]+|DIRT|TURF|RIGHT|LEFT|STRAIGHT|TEST_LITERAL)$/.test(x);
export function validateLeader(rows,cps,distance,values,boundaries,clockKey='clockMs',cpKey='checkpointMs'){
 need(Array.isArray(rows)&&rows.length>0&&Array.isArray(cps)&&cps.length>0&&cps.every((x,i)=>int(x)&&x>(cps[i-1]??0)&&x<distance),'CHECKPOINT_GEOMETRY');
 need(eq(boundaries,[0,...cps,distance])&&values.length===cps.length+1,'LAP_GEOMETRY');
 let cumulative=0;for(const [i,l] of values.entries()){need(int(l)&&l>0,'LAP_VALUE');cumulative+=l;need(cumulative===Math.min(...rows.map(r=>i===cps.length?r[clockKey]:r[cpKey][i])),'LEADER_CROSSING_'+boundaries[i+1]);}
}
function validateDoc(d){
 const card=d.kind==='TARGET_CARD';
 need(card||d.kind==='HISTORICAL_RESULT','DOCUMENT_KIND');exact(d,card?[...base,'scheduledPost']:[...base,'eventAt','distanceM','registeredCount','actualStarters','precisionMs','leaderLaps','passing'],'DOCUMENT_FIELDS');
 need(['TEST:NAR','TEST:JRA'].includes(d.issuer)&&id(d.eventId)&&d.version===1,'IDENTITY_VERSION');
 need([d.publishedAt,d.updatedAt].every(int)&&0<=d.publishedAt&&d.publishedAt<=d.updatedAt,'SOURCE_TIME');
 const when=card?d.scheduledPost:d.eventAt;
 need(int(when)&&when>=0&&(card?d.updatedAt<when:when<d.publishedAt),'EVENT_TIME');
 if(d.conditions!==null)exact(d.conditions,conditions,'CONDITIONS_FIELDS');if(d.geometry!==null)exact(d.geometry,geometry,'GEOMETRY_FIELDS');
 const c=d.conditions,g=d.geometry,cp=g?.checkpoints_m??null,dist=c?.distance_m??d.distanceM??null;
 if(c)need(int(c.distance_m)&&c.distance_m>600&&['DIRT','TURF'].includes(c.surface)&&[c.going,c.venue,c.class_label,c.class_version].every(x=>id(x)),'CONDITIONS');
 for(const x of [c,g].filter(Boolean))need(int(x.effective_from)&&int(x.effective_until)&&x.effective_from<=when&&when<x.effective_until,'CONDITION_EFFECTIVE_TIME');
 if(g)need(int(dist)&&['RIGHT','LEFT'].includes(g.direction)&&id(g.course_version)&&[g.first_turn_m,g.straight_m].every(v=>int(v)&&v>0&&v<dist)&&Array.isArray(cp)&&cp.length===3&&cp[0]===g.first_turn_m&&cp.every((v,i)=>int(v)&&v>(cp[i-1]??0)&&v<dist)&&cp.includes(dist-600),'GEOMETRY');
 need(Array.isArray(d.rows)&&d.rows.length>=2&&unique(d.rows.map(r=>r.nativeId))&&unique(d.rows.map(r=>r.no)),'ROSTER');
 for(const r of d.rows){
  exact(r,card?['nativeId','no','status','gate','weightG']:['nativeId','no','status','gate','weightG','finish','clockMs','final600Ms','checkpointMs','checkpointRanks','officialMargin'],'ROW_FIELDS');
  need(id(r.nativeId)&&int(r.no)&&r.no>0&&(r.gate===null||int(r.gate)&&r.gate>0&&r.gate<=d.rows.length)&&(r.weightG===null||int(r.weightG)&&r.weightG>=40000&&r.weightG<=80000),'ROW_IDENTITY');
  need(card?['ACTIVE','CANCELLED','UNKNOWN'].includes(r.status):r.status==='FINISHED','ROW_STATUS');
  if(!card){
   need(r.clockMs===null||int(r.clockMs)&&r.clockMs>0,'INDIVIDUAL_CLOCK');
   need(r.final600Ms===null||int(r.final600Ms)&&r.final600Ms>0&&(r.clockMs===null||r.final600Ms<r.clockMs),'FINAL600_VALUE');
   need(r.finish===null||int(r.finish)&&r.finish>0&&r.finish<=d.rows.length,'FINISH_VALUE');
   if(r.checkpointMs!==null){need(Array.isArray(r.checkpointMs)&&r.checkpointMs.length===(cp?.length??3)&&r.checkpointMs.every((v,i,a)=>int(v)&&v>(a[i-1]??0))&&(r.clockMs===null||r.clockMs>r.checkpointMs.at(-1)),'INDIVIDUAL_CLOCK');if(cp&&r.clockMs!==null&&r.final600Ms!==null)need(r.clockMs-r.checkpointMs[cp.indexOf(dist-600)]===r.final600Ms,'FINAL600_MISMATCH');}
   if(r.checkpointRanks!==null)need(Array.isArray(r.checkpointRanks)&&r.checkpointRanks.length===(cp?.length??3)&&r.checkpointRanks.every(v=>int(v)&&v>0&&v<=d.rows.length),'CHECKPOINT_RANK');
   need(r.officialMargin===null||safeLabel(r.officialMargin),'MARGIN_LITERAL');
  }
 }
 if(!card){
  need(int(d.distanceM)&&d.distanceM>600&&(!c||d.distanceM===c.distance_m)&&d.registeredCount===d.rows.length&&d.actualStarters===d.rows.length&&int(d.precisionMs)&&d.precisionMs>0,'STARTERS_PRECISION');
  const completeClock=d.rows.every(r=>int(r.clockMs)),completeCp=d.rows.every(r=>Array.isArray(r.checkpointMs));
  for(const r of d.rows){
   if(completeClock&&r.finish!==null)need(r.finish===1+d.rows.filter(q=>q.clockMs<r.clockMs).length,'FINISH_CLOCK_ORDER');
   if(completeCp&&r.checkpointRanks!==null)need(eq(r.checkpointRanks,r.checkpointMs.map((v,i)=>1+d.rows.filter(q=>q.checkpointMs[i]<v).length)),'CHECKPOINT_RANK');
  }
  if(d.leaderLaps!==null){const l=d.leaderLaps;exact(l,['unit','scope','boundariesM','valuesMs'],'LAP_FIELDS');need(l.unit==='ms'&&l.scope==='RACE_LEADER'&&Array.isArray(l.boundariesM)&&Array.isArray(l.valuesMs)&&l.boundariesM[0]===0&&l.boundariesM.at(-1)===d.distanceM&&l.boundariesM.length===l.valuesMs.length+1&&l.boundariesM.every((x,i,a)=>int(x)&&(!i||x>a[i-1]))&&l.valuesMs.every(v=>int(v)&&v>0),'LAP_SCOPE');
   if(cp)need(eq(l.boundariesM,[0,...cp,d.distanceM]),'LAP_GEOMETRY');
   let cum=0;for(const [i,v] of l.valuesMs.entries()){cum+=v;const finish=i===l.valuesMs.length-1;const j=cp?.indexOf(l.boundariesM[i+1])??-1;const times=d.rows.map(r=>finish?r.clockMs:j>=0?r.checkpointMs?.[j]:null).filter(int);
    if(times.length)need(cum<=Math.min(...times),'LEADER_CROSSING_KNOWN_BOUND');if(times.length===d.rows.length)need(cum===Math.min(...times),'LEADER_CROSSING_'+l.boundariesM[i+1]);
   }
  }
  if(d.passing!==null){const p=d.passing;exact(p,['checkpointM','groups','semantics'],'PASSING_FIELDS');need(p.semantics==='SOURCE_GROUPED_ORDER'&&Array.isArray(p.groups)&&p.groups.every(a=>Array.isArray(a)&&a.length>0)&&int(p.checkpointM)&&p.checkpointM>0&&p.checkpointM<d.distanceM,'PASSING');const order=p.groups.flat();need(order.length===d.rows.length&&unique(order)&&order.every(n=>d.rows.some(r=>r.no===n)),'PASSING_ROSTER');const j=cp?.indexOf(p.checkpointM)??-1;if(j>=0){const clocks=order.map(n=>d.rows.find(r=>r.no===n).checkpointMs?.[j]).filter(int);need(clocks.every((v,i)=>i===0||v>=clocks[i-1]),'PASSING_ORDER');}}
 }

}
export function source(d,{captureAt=76,uncertaintyMs=1000}={}){
 const bytes=JSON.stringify(d);return {raw:bytes,sha256:sha(bytes),issuer:d.issuer,eventId:d.eventId,version:d.version,publishedAt:iso(d.publishedAt),updatedAt:iso(d.updatedAt),capturedAt:iso(captureAt),uncertaintyMs};
}
export function makeEnvelope(docs){return {schema:'REBORN2_WORK42_SUPPLY_0.4',scope:'SYNTHETIC_ONLY',cutoff:iso(90),scheduledPost:iso(docs[0].scheduledPost),documents:docs.map(d=>source(d))};}
export function validateEnvelope(e){
 exact(e,['schema','scope','cutoff','scheduledPost','documents'],'ENVELOPE_FIELDS');need(e.schema==='REBORN2_WORK42_SUPPLY_0.4'&&e.scope==='SYNTHETIC_ONLY','SCOPE');
 const cut=date(e.cutoff),post=date(e.scheduledPost);
 // Common producer 31 has a fixed synthetic clock; do not pretend it supports real timestamps.
 need(cut===90000&&post===100000&&cut<post,'COMMON_SYNTHETIC_CLOCK');
 need(Array.isArray(e.documents)&&e.documents.length>0,'DOCUMENTS');
 const docs=[],roots=[],seen=new Set();
 for(const s of e.documents){
  exact(s,['raw','sha256','issuer','eventId','version','publishedAt','updatedAt','capturedAt','uncertaintyMs'],'SOURCE_FIELDS');
  need(typeof s.raw==='string'&&/^[\x00-\x7f]+$/.test(s.raw)&&s.raw.length<100000&&sha(s.raw)===s.sha256,'RAW_HASH');
  const d=JSON.parse(s.raw);need(eq(JSON.stringify(d),s.raw),'RAW_CANONICAL_BYTES');validateDoc(d);
  need(s.issuer===d.issuer&&s.eventId===d.eventId&&s.version===d.version,'RAW_IDENTITY_BINDING');
  const p=date(s.publishedAt),u=date(s.updatedAt),a=date(s.capturedAt);need(p===d.publishedAt*1000&&u===d.updatedAt*1000,'RAW_TIME_BINDING');
  need(int(s.uncertaintyMs)&&s.uncertaintyMs>=0&&p<=u&&u<=a&&a+s.uncertaintyMs<=cut&&a+s.uncertaintyMs<post,'SOURCE_TIME_BOUND');
  // The existing producer seals at t=77 with 1 s uncertainty; no silent chronology translation.
  need(a===76000&&s.uncertaintyMs===1000&&u<=75000,'COMMON_CAPTURE_CLOCK');
  need(!seen.has(d.eventId),'EVENT_DUPLICATE');seen.add(d.eventId);docs.push(d);
  const root=sha(JSON.stringify([d.issuer,d.eventId,d.version,s.sha256,'/']));roots.push({id:root,issuer:d.issuer,eventId:d.eventId,version:d.version,pointer:'/',rawSha256:s.sha256,depends:[]});
  for(const [i,r] of d.rows.entries()){const pointer='/rows/'+i;roots.push({id:sha(JSON.stringify([root,pointer,r.nativeId,r.no])),issuer:d.issuer,eventId:d.eventId,horseId:r.nativeId,no:r.no,pointer,rawSha256:s.sha256,depends:[root]});}
 }
 const card=docs[0];need(card.kind==='TARGET_CARD'&&card.scheduledPost*1000===post&&docs.filter(d=>d.kind==='TARGET_CARD').length===1&&docs.every(d=>d.issuer===card.issuer),'TARGET_CARD');
 need(docs.slice(1).every(d=>d.eventId!==card.eventId&&d.eventAt*1000<cut),'TARGET_RESULT_LEAK');
 return {docs,roots,analysisSha256:sha(JSON.stringify(e))};
}
