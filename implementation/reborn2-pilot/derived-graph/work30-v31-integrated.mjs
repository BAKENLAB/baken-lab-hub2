import {observationState,comparableState,freshFixtureGraph} from './graph-context.mjs';
// Codex06 derived from frozen research/reborn2-chatgpt-circuit/work30-v31-integrated.mjs; original Git blob 6e812e54ea096f55b2307d05659faaf4824711f2.
const FROZEN_SOURCE_URL=new URL('../../../research/reborn2-chatgpt-circuit/work30-v31-integrated.mjs',import.meta.url);
// V31 research only. Replay pinned Work30 source bytes, adapt to the existing V27->V30 analyzer.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execute30,verify30} from '../../../research/reborn2-chatgpt-circuit/work30-pinned/stage30-byte-pipeline-v0.1.mjs';
import {loadV30,analyzeV30,jointField} from './work29-v30-terminal.mjs';
import {dependencyReader,uniq,signedGap} from '../../../research/reborn2-chatgpt-circuit/research-ability-core.mjs';
const need=(x,m)=>{if(!x)throw Error(m)};
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const pin=(name,b,s)=>{const x=readFileSync(new URL('./work30-pinned/'+name,FROZEN_SOURCE_URL));need(blob(x)===b&&sha(x)===s,'WORK30_PIN '+name);return x};
const parse=x=>JSON.parse(x.toString('utf8'));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function loadV31(){
 const L=loadV30();
 pin('stage30-byte-pipeline-v0.1.mjs','091590f121c3c94a04406a64cd598a894e7570ac','ab85574c47070b38cf748a00f54cc77ad04f0540190ee2207de1686565848cac');
 const b=parse(pin('stage30-synthetic-bundles-v0.1.json','a668a6ef5ff7cb5e98387dc80a6a8b47d68b92d9','1358d5111aa0efd0b996fc54663e66f917c9c5b8cbc670d4f9fc23a50c729f88'));
 const p=parse(pin('stage30-codex-packets-v0.1.json','acfad8ac2d401b6c8f71964f4502c9cfb20d9281','e633b4df9244c37e59eb793d11e68d1ae6bb48b67eff1cb08acf7b11ed7cb7f4'));
 need(b.scope==='SYNTHETIC_ONLY'&&p.scope==='SYNTHETIC_ONLY'&&b.fixtures.length===2&&p.outputs.length===2,'WORK30_SCOPE');
 assert.deepEqual(b.canonical,L.canonical.map(({item,name})=>({item,name})));
 const work30=new Map(),cases=new Map(L.cases);
 for(const f of b.fixtures){
  const out=execute30(f.input,f.registry,b.canonical,sha,verify30),issuer=f.input.manifest.issuer,saved=p.outputs.find(x=>x.packet.issuer===issuer);
  assert.deepEqual(out,saved);need(out.state==='TEST_PACKET'&&out.packetDigest===sha(JSON.stringify(out.packet))&&out.packet.observations.length===12,'WORK30_REPLAY');
  const raw=f.input.documents.map(d=>{const bytes=Buffer.from(d.bytes);need(sha(bytes)===d.digest,'RAW_REHASH');return {doc:d,x:parse(bytes)};});
  const name='WORK30_'+issuer.split(':').at(-1),pack=adapt30(out,raw);
  work30.set(name,{out,raw,pack});cases.set(name,pack);
 }
 return {...L,cases,work30};
}
// Preserve actual packet evidence IDs; extra IDs bind exact raw fields, not invented source values.
export function adapt30(out,raw){
 const p=out.packet;need(out.state==='TEST_PACKET'&&p.scope==='SYNTHETIC_ONLY_NEVER_OFFICIAL'&&p.formal_admissions===0&&p.benchmark_admissions===0&&!p.scoring_authorized,'OFFICIAL_DISABLED');
 const issuer=p.issuer;need(['TEST:JRA','TEST:NAR'].includes(issuer),'ISSUER');
 const card=raw.find(x=>x.x.kind==='TARGET_CARD'),hist=raw.find(x=>x.x.kind==='HISTORICAL_RESULT');need(card&&hist&&raw.length===2&&card.x.issuer===issuer&&hist.x.issuer===issuer&&card.x.eventId===p.targetId&&hist.x.eventId!==p.targetId,'RAW_EVENT_BIND');
 const id=x=>issuer+'|'+x,ev=x=>id(x.eventId),evidence=[],rawRefs=new Map(),obs=new Map(p.observations.map(o=>[o.evidenceId,o]));
 need(obs.size===p.observations.length&&new Set(p.observations.map(o=>o.root)).size===obs.size,'DUPLICATE');
 const add=(event,subject,field,value,pointer,source,extra={})=>{const root=[issuer,event,subject,field].join('|'),eid=extra.evidence_id??sha(JSON.stringify([root,source.doc.digest,pointer]));const x={evidence_id:eid,event_id:event,subject_id:subject,field,value,pointer,root:extra.root??root,state:'SYNTHETIC_OBSERVATION',formal_usable:false,source_sha256:source.doc.digest,depends_on:extra.depends_on??[],...extra};need(!evidence.some(q=>q.evidence_id===eid),'DUPLICATE_ADAPTER_ID');evidence.push(x);return x};
 const buildRows=source=>source.x.rows.map((r,i)=>{
  const event=ev(source.x),h=id(r.nativeId),ptr='/rows/'+i;
  const identity=add(event,h,'id',h,ptr+'/nativeId',source,{native_id:r.nativeId,raw_value:r.nativeId});
  const status=add(event,h,'status',r.status,ptr+'/status',source);
  const number=add(event,h,'horse_number',r.no,ptr+'/no',source);
  const gate=r.gate===undefined?null:add(event,h,'gate_number',r.gate,ptr+'/gate',source);
  rawRefs.set(event+'|'+h,{identity,status,number,gate});
  return {id:h,identity_ref:identity.evidence_id,horse_number:number,gate_number:gate,weight:null,margin:{winner_pointer:null}};
 });
 const tr=buildRows(card),hr=buildRows(hist),H=ev(hist.x),T=ev(card.x);
 need(same(p.runners.map(r=>[r.nativeId,r.no,r.status]),card.x.rows.map(r=>[r.nativeId,r.no,r.status])),'ROSTER_BIND');
 const count=add(H,null,'actual_starters',hist.x.actualStarters,'/actualStarters',hist);
 const registered=add(T,null,'registered_count',tr.length,'/rows',card,{derivation:'RAW_ROW_COUNT'});
 const declared=add(T,null,'declared_active_count',card.x.rows.filter(x=>x.status==='ACTIVE').length,'/rows',card,{derivation:'RAW_ACTIVE_COUNT'});
 const distance=add(H,null,'conditions',{distance_m:hist.x.distanceM},'/distanceM',hist,{derivation:'DISTANCE_ONLY_NO_SURFACE'});
 const finishMap=new Map(p.observations.filter(x=>x.field==='finish').map(x=>[x.subject,x])),winner=[...finishMap.values()].find(x=>x.value===1);
 need(winner&&finishMap.size===hist.x.actualStarters,'STARTER_BIND');
 const winnerClock=p.observations.find(x=>x.field==='finish_clock'&&x.subject===winner.subject);
 for(const row of hr)row.margin.winner_pointer=winnerClock?.pointer??null;
 const findRaw=(subject)=>hist.x.rows.find(r=>r.nativeId===subject);
 for(const o of p.observations){
  need(o.formal===false&&o.receipt.issuer===issuer&&o.receipt.eventId===hist.x.eventId&&o.receipt.sourceDigest===hist.doc.digest&&o.evidenceId===sha(JSON.stringify([o.root,o.receipt.sourceDigest,o.pointer]))&&o.dependencies.every(k=>obs.has(k)&&k!==o.evidenceId),'OBS_BIND');
  const sub=o.subject===null?null:id(o.subject),r=findRaw(o.subject),m=o.measurement,extra={evidence_id:o.evidenceId,root:o.root,depends_on:[...o.dependencies],packet_field:o.field,measurement:m,receipt:o.receipt};
  let field=o.field,value=o.value;
  if(o.field==='finish'){need(r?.finish===value&&m.actualStarters===hist.x.actualStarters&&Number.isInteger(value)&&value>=1&&value<=hist.x.actualStarters&&m.status==='FINISHED','FINISH_BOUND');extra.depends_on.push(count.evidence_id);}
  if(o.field==='finish_clock'){need(r?.clockMs===value&&m.unit==='ms'&&m.distanceM===hist.x.distanceM,'CLOCK_BIND');field='finish_ms';}
  if(o.field==='individual_final600'){need(r?.final600Ms===value&&m.unit==='ms'&&m.toM===hist.x.distanceM&&m.toM-m.fromM===600,'TERMINAL_BIND');field='final600_ms';}
  if(o.field==='race_leader_laps'){need(same(value,hist.x.leaderLaps.valuesMs)&&same(m.boundariesM,hist.x.leaderLaps.boundariesM)&&m.unit==='ms'&&m.scope==='RACE_LEADER','LAP_BIND');let n=0;value={elapsed_ms:[0,...value.map(v=>n+=v)],distances_m:m.boundariesM,uncertainty_ms:null,scope:'RACE_LEADER_EXPLICIT_REPORTED_CLOCK'};field='leader_crossings';}
  if(o.field==='passing_order'){need(same(value,hist.x.passing.groups)&&m.actualStarters===hist.x.actualStarters&&m.checkpointM===hist.x.passing.checkpointM,'PASSING_BIND');extra.depends_on.push(count.evidence_id);}
  if(o.field==='winner_margin'){need(r&&value===r.clockMs-findRaw(winner.subject).clockMs,'MARGIN_BIND');extra.depends_on.push(winner.evidenceId,finishMap.get(o.subject).evidenceId);}
  if(o.field==='historical_peer_result'){const peer=findRaw(value.peerNativeId);need(peer&&r&&r.nativeId!==peer.nativeId&&peer.finish===value.peerFinish,'PEER_BIND');const a=rawRefs.get(T+'|'+sub),b=rawRefs.get(T+'|'+id(peer.nativeId));need(a?.status.value==='ACTIVE'&&b?.status.value==='ACTIVE','PEER_NOT_CURRENT_ACTIVE');extra.depends_on.push(a.identity.evidence_id,a.status.evidence_id,b.identity.evidence_id,b.status.evidence_id);}
  add(H,sub,field,value,o.pointer,hist,extra);
 }
 const active=tr.filter(x=>rawRefs.get(T+'|'+x.id).status.value==='ACTIVE').map(x=>x.id);
 const target={event_id:T,rows:tr,registered_count:registered,declared_active_count:declared,actual_starters:null,conditions:null,geometry:null,relative:[]};
 const past={event_id:H,event_at:hist.x.eventAt,rows:hr,actual_starters:count,conditions:distance,geometry:null,relative:[]};
 return {r:{scope:'WORK30_EXACT_SYNTHETIC_ONLY',cutoff:p.cutoff,measurement:{checkpoint_scope:null,clock_uncertainty_ms:null,snapshot_uncertainty_m:null}},o:{events:[target,past],evidence,followups:[],active_ids:active},f:{active_ids:active,pairs:[]},packet:p};
}
export function analyzeV31(L,name,withdraw=null,options={}){
 const w=L.work30.get(name);if(!w)return attachClockFeasibility(analyzeV30(L,name,withdraw,options));
 const {pack}=w,all=new Map(pack.o.evidence.map(e=>[e.evidence_id,e])),[target,hist]=pack.o.events;
 need(withdraw===null||all.has(withdraw),'WITHDRAW_ID');
 const out=analyzeV30(L,name,withdraw,options);
 const f=(event,subject,field)=>pack.o.evidence.find(e=>e.event_id===event&&e.subject_id===subject&&e.field===field);
 const {get,lineage}=dependencyReader(all,withdraw,e=>e.subject_id===null||e.field==='id'?[]:[f(e.event_id,e.subject_id,'id')?.evidence_id,...(e.field==='status'?[]:[f(e.event_id,e.subject_id,'status')?.evidence_id])].filter(Boolean));
 const use=e=>e&&get(e.evidence_id),refs=es=>lineage(es.filter(Boolean).map(e=>e.evidence_id)).map(e=>e.evidence_id);
 const supply=(h,k)=>f(hist.event_id,h,k),active=out.roster.known_active;
 for(const h of out.runners){
  if(h.status!=='ACTIVE'||!h.identity_known)continue;
  const own=out.historical.find(x=>x.horse===h.slot),margin=supply(h.slot,'winner_margin'),peer=supply(h.slot,'historical_peer_result'),passing=supply(null,'passing_order'),lap=supply(null,'leader_crossings'),clock=supply(h.slot,'finish_ms'),final=supply(h.slot,'final600_ms'),finish=supply(h.slot,'finish');
  const findings=[];
  const note=(item,state,observation,es,scope='HISTORICAL_ONLY')=>{const x={horse:h.slot,item,decision:state,state,observation,refs:refs(es),scope,formal:false,independent_vote:false};findings.push(x);out.trace.push(x);};
  if(use(finish)&&own?.finish!==null)note('RANK02','COMMON_ANALYZER_PAST_FINISH',own.finish,[finish]);
  if(use(clock)&&own?.clock!==null)note('RANK05','COMMON_ANALYZER_PAST_CLOCK',own.clock,[clock]);
  if(use(final)&&own?.terminal_ms!==null)note('RANK06','COMMON_ANALYZER_FINAL600',own.terminal_ms,[final]);
  if(use(margin)&&own?.margin_ms===margin.value)note('RANK03','COMMON_ANALYZER_VERIFIED_WINNER_GAP',own.margin_ms,[margin,finish]);
  if(use(lap)&&out.leaders.some(x=>x.event===hist.event_id))note('RANK19','COMMON_ANALYZER_HISTORICAL_LAP',out.leaders.find(x=>x.event===hist.event_id).segments,[lap]);
  if(use(passing))note('RANK17','GROUPED_CHECKPOINT_CANDIDATE_NOT_CORNER',passing.value,[passing],'CANDIDATE_ONLY');
  const other=peer?pack.packet.issuer+'|'+peer.value.peerNativeId:null;
  const direct=out.direct.find(x=>x.event===hist.event_id&&[x.a,x.b].includes(h.slot)&&[x.a,x.b].includes(other));
  if(use(peer)&&direct&&active.includes(other)&&other!==h.slot)note('RANK35','COMMON_ANALYZER_DIRECT_COMPARISON',direct.order===h.slot?'PAST_PAIR_WON':'PAST_PAIR_LOST',[peer]);
  // Derived margin/peer withdrawal removes that supply route, but independent clock/rank evidence can still survive.
  const evidenceForPath=findings.filter(x=>['RANK02','RANK03','RANK05','RANK06','RANK19','RANK35'].includes(x.item));
  const relation=findings.find(x=>x.item==='RANK35');
  const terminalDiff=use(final)&&other&&use(supply(other,'final600_ms'))?signedGap(final.value,supply(other,'final600_ms').value):null;
  const relationState=relation?.observation??'UNKNOWN';
  const needs=relationState==='PAST_PAIR_LOST'?'REVERSE_OBSERVED_RIVAL_ORDER':relationState==='PAST_PAIR_WON'?'RETAIN_OBSERVED_RIVAL_ORDER':'ESTABLISH_RIVAL_ORDER';
  const path={event:hist.event_id,rival:other,requirement:needs,historical_relation:relationState,reported_final600_advantage_ms:terminalDiff,reported_winner_gap_ms:findings.find(x=>x.item==='RANK03')?.observation??null,current_feasibility:'UNRESOLVED',current_conditions:null,measurement_uncertainty_ms:null,refs:uniq([...evidenceForPath.flatMap(x=>x.refs),...(terminalDiff===null?[]:refs([final,supply(other,'final600_ms')]))]),formal:false};
  h.WIN={...h.WIN,evidence_paths:[path],state:'UNRESOLVED'};
  h.PLACE={...h.PLACE,evidence_paths:[path],state:'UNRESOLVED'};
  h.items=h.items.map(x=>{const fs=findings.filter(y=>y.item===x.item);if(!fs.length)return x;return {...x,state:fs.every(y=>y.scope==='CANDIDATE_ONLY')?'CANDIDATE_ONLY':'SYNTHETIC_COMMON_ANALYZER_OBSERVATION',refs:uniq([...x.refs,...fs.flatMap(y=>y.refs)]),v31_findings:fs,grade_effect_proven:false};});
  h.v31_consumption=findings;
 }
 return attachClockFeasibility({...out,work30_scope:'EXACT_PINNED_REPLAY_COMMON_ANALYZER',formal:false,grade:null});
}

// Joint numeric differences: d = time(b)-time(a). Unknown edges add no constraint.
export function jointClockFeasibility(roster,pairs){
 need(new Set(roster).size===roster.length,'CLOCK_ROSTER');
 const edges=[],seen=new Set();
 for(const p of pairs){
  need(roster.includes(p.a)&&roster.includes(p.b)&&p.a!==p.b&&Number.isFinite(p.delta)&&Number.isFinite(p.bound)&&p.bound>=0&&Array.isArray(p.refs)&&p.refs.length>0,'CLOCK_PAIR');
  const key=JSON.stringify([p.a,p.b].sort());need(!seen.has(key),'CLOCK_DUP_PAIR');seen.add(key);
  edges.push({a:p.a,b:p.b,max:p.delta+p.bound,refs:p.refs},{a:p.b,b:p.a,max:-p.delta+p.bound,refs:p.refs});
 }
 const d=new Map(roster.map(h=>[h,0])),prev=new Map();let last=null;
 for(let i=0;i<roster.length;i++){
  last=null;
  for(const e of edges)if(d.get(e.b)>d.get(e.a)+e.max){d.set(e.b,d.get(e.a)+e.max);prev.set(e.b,e);last=e.b;}
  if(last===null)break;
 }
 if(last!==null){for(let i=0;i<roster.length;i++)last=prev.get(last)?.a??last;const cycle=[],start=last;do{const e=prev.get(last);if(!e)break;cycle.push(e);last=e.a;}while(last!==start&&cycle.length<=roster.length+1);return {state:'CONTRADICTED_NUMERIC_DIFFERENCES',refs:uniq(cycle.flatMap(e=>e.refs)),cycle:cycle.map(e=>({a:e.a,b:e.b,max:e.max})),prediction:false};}
 return {state:pairs.length?'CONSISTENT_BOUNDED_DIFFERENCES_NOT_RACE_DYNAMICS':'NO_MEASURED_DIFFERENCES',refs:uniq(pairs.flatMap(p=>p.refs)),constraint_count:edges.length,prediction:false};
}
function attachClockFeasibility(out){
 for(const s of out.shared_scenarios_v30){
  const observed=out.terminal_v30.filter(p=>p.event===s.event&&p.terminal.segment&&!p.finish_conflict);
  const pairs=observed.flatMap(p=>{
   const t=p.terminal.segment;
   if(s.kind==='CHECKPOINT_OBSERVED')return [{a:p.a,b:p.b,delta:t.start,bound:t.endpointBound,refs:p.checkpoint_refs}];
   if(s.kind==='FINISH_OBSERVED')return [{a:p.a,b:p.b,delta:t.end,bound:t.endpointBound,refs:p.terminal_refs}];
   if(s.kind==='EQUAL_FIRST_CHECKPOINT_TO_FINISH'&&p.net_first_to_finish_ms!==null)return [{a:p.a,b:p.b,delta:p.net_first_to_finish_ms,bound:p.net_bound_ms,refs:p.refs}];
   return [];
  }).filter(p=>p.refs.length);
  s.numeric_feasibility=jointClockFeasibility(out.roster.possible_active,pairs);
 }
 return out;
}
// Contrast two genuinely distinct historical races; differences are observed, not causal.
export function compareV31Response(L,name,subject,rival,first,second,withdraw=null){
 const q=analyzeV31(L,name,withdraw),pack=L.cases.get(name),all=new Map(pack.o.evidence.map(e=>[e.evidence_id,e]));
 need(first!==second&&subject!==rival,'DISTINCT_HISTORY_AND_HORSE');
 const field=(event,horse,k)=>pack.o.evidence.find(e=>e.event_id===event&&e.subject_id===horse&&e.field===k);
 const {get,lineage}=dependencyReader(all,withdraw,e=>e.subject_id===null||e.field==='id'?[]:[field(e.event_id,e.subject_id,'id')?.evidence_id,...(e.field==='status'?[]:[field(e.event_id,e.subject_id,'status')?.evidence_id])].filter(Boolean));
 const val=e=>e&&get(e.evidence_id)&&e.state===observationState(L)?e.value:null;
 const read=event=>{const a=q.historical.find(h=>h.event===event&&h.horse===subject),b=q.historical.find(h=>h.event===event&&h.horse===rival),d=q.direct.find(x=>x.event===event&&[x.a,x.b].includes(subject)&&[x.a,x.b].includes(rival)),c=field(event,null,'conditions'),wa=field(event,subject,'weight_grams'),wb=field(event,rival,'weight_grams'),ga=field(event,subject,'gate_number'),gb=field(event,rival,'gate_number'),es=[c,wa,wb,ga,gb].filter(Boolean),x=val(c);return {event,relative_finish:d?d.order===subject?'AHEAD':'BEHIND':'UNKNOWN',reported_advantage_ms:d?signedGap(a?.clock,b?.clock):null,subject_rank:a?.finish??null,rival_rank:b?.finish??null,subject_terminal_ms:a?.terminal_ms??null,rival_terminal_ms:b?.terminal_ms??null,conditions:x,subject_weight:val(wa),rival_weight:val(wb),subject_gate:val(ga),rival_gate:val(gb),refs:uniq([...(d?.refs??[]),...lineage(es.map(e=>e.evidence_id)).map(e=>e.evidence_id)])};};
 const a=read(first),b=read(second),dims=['distance_m','venue','surface','going','class_label'],changed=dims.filter(k=>a.conditions?.[k]!=null&&b.conditions?.[k]!=null&&a.conditions[k]!==b.conditions[k]);
 return {subject,rival,first:a,second:b,changed_dimensions:changed,observed_reversal:a.relative_finish!=='UNKNOWN'&&b.relative_finish!=='UNKNOWN'&&a.relative_finish!==b.relative_finish,reported_advantage_change_ms:a.reported_advantage_ms===null||b.reported_advantage_ms===null?null:b.reported_advantage_ms-a.reported_advantage_ms,causal_response:null,current_relevance:'UNPROVEN_MULTIPLE_CONDITIONS_CHANGED',formal:false};
}
