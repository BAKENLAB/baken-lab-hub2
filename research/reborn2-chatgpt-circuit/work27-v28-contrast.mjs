// V28: exact Work27 intake into the same V27 analysis, plus bounded condition/pace predicates.
// All data synthetic, never a formal score, grade, or forecast.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as up from './work26-pinned/stage26-varied-synthetic-producer-v0.1.mjs';
import {validate27,project27} from './work27-pinned/stage27-controlled-contrast-producer-v0.1.mjs';
import {loadV27,analyzeV27} from './work26-v27-integrated.mjs';
import {dependencyReader,uniq,signedGap} from './research-ability-core.mjs';
const read=p=>readFileSync(new URL('./work27-pinned/'+p.split('/').at(-1),import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex'),blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const parse=b=>JSON.parse(b.toString('utf8')),need=(v,m)=>{if(!v)throw Error(m)},eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ptr=(v,p)=>p.split('/').slice(1).reduce((o,k)=>o?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],v);
const pin=p=>{const b=read(p.path);need(blob(b)===p.blob&&sha(b)===p.sha256,'PIN '+p.path);return b};
export function loadV28(){
 const previous=loadV27(),ib=read('stage27-final-handoff-v0.1.json');
 need(blob(ib)==='fcbceb2ff2a6eb482b4d6f3f0b015e96f882e954','INDEX');
 const i=parse(ib);need(i.parent.blob==='ca46b670d6a8f8fdd0880019c189fe89c83c094a'&&i.scope==='EXPLICITLY_SYNTHETIC_NEVER_OFFICIAL'&&i.gates.formal_admissions===0,'PARENT_SCOPE');
 const upBytes=readFileSync(new URL('./work26-pinned/stage26-varied-synthetic-producer-v0.1.mjs',import.meta.url));need(blob(upBytes)===i.upstream.blob&&sha(upBytes)===i.upstream.sha256,'UPSTREAM');
 const pinned=Object.fromEntries(Object.entries(i.pins).map(([k,p])=>[k,pin(p)]));
 const raw=parse(pinned['stage27-controlled-raw-v0.1.json']).cases.concat([parse(pinned['stage27-pace-contrast-v0.1.json']).raw_case]);
 const oi=parse(pinned['stage27-output-index-v0.1.json']),rb=parse(pinned['stage27-readback-v0.1.json']);
 const cases=new Map();need(raw.length===13&&rb.pins.length===4&&oi.pins.length===4,'RAW_COUNT');
 for(const b of rb.pins){
  const {blob:_,...rest}=b;assert.deepEqual(rest,oi.pins.find(q=>q.path===b.path));
  const batch=parse(pin(b));
  for(const c of b.cases){
   const r=raw.find(x=>x.case_id===c.id),compact=ptr(batch,c.pointer);
   need(r&&compact&&compact.case_id===c.id&&sha(JSON.stringify(r))===c.raw_sha256,'RAW_BIND');
   need(new Set(r.leader_measurements.map(x=>x.event_id)).size===r.leader_measurements.length&&r.leader_measurements.every(m=>[...m.distances_m,...m.elapsed_ms,m.uncertainty_ms].every(Number.isFinite)),'LEADER_INPUT');
   need(validate27(r,up),'VALIDATE27');const o=project27(r,up);
   need(sha(JSON.stringify(o))===c.full_projection_sha256&&compact.full_projection_sha256===c.full_projection_sha256,'PROJECTION_HASH');
   need(o.evidence.length===c.evidence&&o.pairs.length===c.pairs&&o.formal_admissions===0&&!o.analysis_sufficient,'COUNTS');
   const expected={...o,followups:o.followups.map(({reference_observation,later_observation,...l})=>({...l,reference_row_locator:[l.reference_event,l.opponent],later_row_locator:[l.followup_event,l.opponent]})),full_projection_sha256:c.full_projection_sha256};
   assert.deepEqual(compact,expected);
   const lookup=new Map(o.evidence.map(e=>[e.evidence_id,e]));need(lookup.size===o.evidence.length&&o.evidence.every(e=>!e.formal_usable&&e.source_sha256===c.raw_sha256&&eq(ptr(r,e.pointer),e.value)),'POINTERS');
   for(const m of o.marginLinks){need(m.refs.every((x,j)=>lookup.get(x)?.root===m.roots[j])&&m.refs.every(x=>lookup.get(x)?.event_id===m.event),'MARGIN_REFS');}
   for(const l of compact.followups)for(const loc of [l.reference_row_locator,l.later_row_locator])need(o.events.find(e=>e.event_id===loc[0])?.rows.some(x=>x.id===loc[1]&&x.finish),'LOCATOR');
   need(!cases.has(c.id),'DUP_CASE');cases.set(c.id,{r,o,f:{pairs:o.pairs,active_ids:o.active_ids}});
  }
 }
 need(cases.size===13,'CASE_COUNT');
 const rankB=read('chapter1-100-items.json'),eyeB=read('rank-eye-canonical.json'),designB=read('DESIGN-SABC-SYNTHESIS-20261126.md');
 need(blob(rankB)==='7c1108bd84562800bc41f65fd2fd1ff1b58f5080'&&blob(eyeB)==='64105a0f0fb802bc1c45eb78a1169f64aa5dcd16'&&blob(designB)==='4d8af63ef119d032ae07de392721df94bd8ccce6','CANONICAL_PIN');
 const rank=parse(rankB).groups.flatMap(g=>g.items).map(x=>({...x,item:'RANK'+x.id})),eye=parse(eyeB).eye.items.map(x=>({...x,item:'EYE'+x.id}));
 need(rank.length===100&&eye.length===15&&new Set([...rank,...eye].map(x=>x.item)).size===115,'ITEMS');
 return {previous,cases:new Map([...previous.cases,...cases]),work27:cases,canonical:[...rank,...eye],rankDefinitions:parse(eyeB).rank.definitions};
}
export function analyzeV28(L,name,withdraw=null,options={}){
 const pack=L.cases.get(name);need(pack,'CASE');const {r,o}=pack;
 // Same analyzer for all 20 Work26/27 worlds, never merge their evidence.
 const out=analyzeV27(L,name,withdraw,{placeThreshold:options.placeThreshold??null});
 const all=new Map(o.evidence.map(e=>[e.evidence_id,e])),field=(ev,h,k)=>o.evidence.find(e=>e.event_id===ev&&e.subject_id===h&&e.field===k);
 const {get,lineage}=dependencyReader(all,withdraw,e=>e.subject_id===null||e.field==='id'?[]:[field(e.event_id,e.subject_id,'id')?.evidence_id,...(e.field==='status'?[]:[field(e.event_id,e.subject_id,'status')?.evidence_id])].filter(Boolean));
 const ok=e=>e&&get(e.evidence_id)&&e.state==='SYNTHETIC_OBSERVATION',value=e=>ok(e)?e.value:null,id=e=>e?.evidence_id;
 const refs=es=>lineage(es.filter(Boolean)).filter(ok).map(id);
 const t=o.events[0],H=o.events.slice(1),root=(xs)=>uniq(xs.map(k=>all.get(k)?.root).filter(Boolean));
 const add=(horse,item,decision,ids,missing=[])=>{const x=refs(ids);const q={horse,item,decision,refs:x,roots:root(x),missing,formal:false};out.trace.push(q);return q};
 const leaders=[];
 for(const e of H){
  const m=field(e.event_id,null,'leader_crossings'),v=value(m);if(!v)continue;
  const seg=v.elapsed_ms.slice(1).map((n,j)=>{const dt=n-v.elapsed_ms[j],d=v.distances_m[j+1]-v.distances_m[j],u=2*v.uncertainty_ms;return {from_m:v.distances_m[j],to_m:v.distances_m[j+1],ms:dt,mps:d*1000/dt,low:dt>u?d*1000/(dt+u):null,high:dt>u?d*1000/(dt-u):null}});
  leaders.push({event:e.event_id,segments:seg,refs:refs([id(m)]),scope:v.scope,individual_clock_inference:false});
 }
 const proximity=[];
 for(const e of H)for(const q of e.relative){
  const [a,b]=q.refs.map(k=>get(k));if(!ok(a)||!ok(b)||!out.historical.some(h=>h.event===e.event_id&&h.horse===q.a)||!out.historical.some(h=>h.event===e.event_id&&h.horse===q.b))continue;
  const gaps=[a,b].map(z=>Math.abs(z.value.positions_m[q.a]-z.value.positions_m[q.b]));
  const ids=[...q.refs,id(field(e.event_id,q.a,'id')),id(field(e.event_id,q.b,'id')),id(field(e.event_id,q.a,'status')),id(field(e.event_id,q.b,'status'))];
  proximity.push({event:e.event_id,a:q.a,b:q.b,gaps_m:gaps,bound_m:2*r.measurement.snapshot_uncertainty_m,refs:refs(ids),pressure:null,load:null});
 }
 const allHistoryKnown=out.historical.map(h=>h.horse);
 const absent=[];
 // Explicit no-admissible observation in this case: compare expected event identities from pinned CONTROL, not borrow results.
 if(name==='PEER_NO_ASOF'){
  const control=L.work27.get('CONTROL').o;
  for(const l of control.followups.filter(z=>!H.some(e=>e.event_id===z.followup_event))){
   const subject=field(l.reference_event,l.subject,'id'),peer=field(l.reference_event,l.opponent,'id');
   if(ok(subject)&&ok(peer))absent.push({subject:l.subject,peer:l.opponent,reference:l.reference_event,event:l.followup_event,state:'NO_ADMISSIBLE_OBSERVATION',not_loss:true,refs:refs([id(subject),id(peer)])});
  }
 }
 for(const h of out.runners){
  const currentKnown=h.identity_known&&h.status==='ACTIVE',own=h.historical??[],conditionPaths=[],pacePaths=[];
  const g=value(t.geometry),tc=value(t.conditions);
  for(const a of own){
   const e=H.find(x=>x.event_id===a.event),pc=value(e.conditions),pg=value(e.geometry),pastGate=value(field(a.event,h.slot,'gate_number')),nowGate=h.gate_number;
   const dims={distance:pc&&tc?pc.distance_m===tc.distance_m:null,surface:pc&&tc?pc.surface===tc.surface:null,going:pc&&tc?pc.going===tc.going:null,venue:pc&&tc?pc.venue===tc.venue:null,class_label:pc&&tc?pc.class_label===tc.class_label:null,direction:pg&&g?pg.direction===g.direction:null,first_turn:pg&&g?pg.first_turn_m===g.first_turn_m:null,straight:pg&&g?pg.straight_m===g.straight_m:null,gate:pastGate!==null&&nowGate!==null?pastGate===nowGate:null,weight:a.weight_delta_g===null?null:a.weight_delta_g===0};
   const mismatches=Object.keys(dims).filter(k=>dims[k]===false),unknown=Object.keys(dims).filter(k=>dims[k]===null);
   const ids=refs([id(e.conditions),id(t.conditions),id(e.geometry),id(t.geometry),id(field(a.event,h.slot,'gate_number')),id(field(t.event_id,h.slot,'gate_number')),id(field(a.event,h.slot,'weight_grams')),id(field(t.event_id,h.slot,'weight_grams')),id(field(a.event,h.slot,'finish')),id(field(a.event,h.slot,'id'))]);
   // Matching one dimension supports only historical transfer relevance on that dimension, not suitability or winning.
   const gateState=dims.gate===null?'GATE_UNKNOWN':dims.gate?'SAME_GATE_CONTEXT':'CHANGED_GATE_CONTEXT';
   const state=unknown.length?'CONTEXT_INCOMPLETE':mismatches.length?'TRANSFER_REQUIRES_CONDITION_RESPONSE':'OBSERVED_CONTEXT_MATCH_ONLY';
   conditionPaths.push({event:a.event,dims,mismatches,unknown,state,gateState,refs:ids,past_finish:a.finish,causal_response:null});
   add(h.slot,'RANK43',dims.distance===null?'DISTANCE_UNKNOWN':dims.distance?'SAME_DISTANCE_OBSERVATION':'DISTANCE_TRANSFER_UNPROVEN',[id(e.conditions),id(t.conditions)],['NO_MATCHED_DISTANCE_RESPONSE']);
   add(h.slot,'RANK53',gateState,[id(field(a.event,h.slot,'gate_number')),id(field(t.event_id,h.slot,'gate_number')),...a.rankTrace.refs],['GATE_ROLE_CAUSAL_EFFECT_UNKNOWN']);
   add(h.slot,'RANK54',dims.weight===null?'WEIGHT_UNKNOWN':dims.weight?'SAME_WEIGHT_CONTEXT':'CHANGED_WEIGHT_CONTEXT',[id(field(a.event,h.slot,'weight_grams')),id(field(t.event_id,h.slot,'weight_grams'))],['WEIGHT_RESPONSE_UNKNOWN']);
   add(h.slot,'RANK02',a.finish===null?'FINISH_UNKNOWN':'PAST_FINISH',[id(field(a.event,h.slot,'finish'))]);
   add(h.slot,'RANK05',a.clock===null?'CLOCK_UNKNOWN':'PAST_CLOCK',[id(field(a.event,h.slot,'finish_ms'))]);
   const lead=leaders.find(q=>q.event===a.event);
   const comparisons=[];
   if(lead&&a.intervals){
    for(const [j,x] of a.intervals.entries()){
     const from=a.positions?.[j]?.distance_m,to=a.positions?.[j+1]?.distance_m,y=lead.segments.find(s=>s.from_m===from&&s.to_m===to);
     if(!y||x.low===null||y.low===null)continue;
     comparisons.push({from_m:from,to_m:to,state:x.low>y.high?'FASTER_THAN_LEADER_CROSSING_INTERVAL':x.high<y.low?'SLOWER_THAN_LEADER_CROSSING_INTERVAL':'UNCERTAINTY_OVERLAP',individual_mps:x.mps,leader_mps:y.mps});
    }
   }
   const paceRefs=refs([...(lead?.refs??[]),...a.speedTrace.refs]);
   // Distinguish the demonstrated ability to complete a measured historical pace from unmeasured load tolerance.
   const evidenceState=!lead?'LEADER_PACE_UNAVAILABLE':!a.intervals?'INDIVIDUAL_RESPONSE_UNAVAILABLE':comparisons.length?'MEASURED_INDIVIDUAL_RESPONSE_AT_OBSERVED_PACE':'NO_COMPARABLE_SEGMENTS';
   const pstate={event:a.event,state:evidenceState,comparisons,leader_segments:lead?.segments??null,refs:paceRefs,physiological_tolerance:null,current_pace:null,pressure:null};
   pacePaths.push(pstate);
   add(h.slot,'RANK19',lead?'OBSERVED_LEADER_PACE':'LEADER_PACE_UNKNOWN',lead?.refs??[],lead?[]:['LEADER_NOT_STIPULATED']);
   add(h.slot,'RANK08',evidenceState,paceRefs,['NO_MATCHED_LOAD_COMPARISON']);
   add(h.slot,'RANK23','PRESSURE_LOAD_UNRESOLVED',[],['NO_PHYSIOLOGICAL_LOAD_OR_MATCHED_PRESSURE']);
  }
  h.condition_paths=conditionPaths;h.pace_paths=pacePaths;
  h.unknown_ability=h.status!=='CANCELLED'&&(!currentKnown||!own.length);
  // Condition/pace predicates explicitly constrain which observed paths can be invoked, never force current feasibility.
  if(h.WIN&&h.PLACE){
   const candidates=(h.repeat_paths??[]).map(p=>{
    const c=conditionPaths.find(z=>z.event===p.event),pace=pacePaths.find(z=>z.event===p.event);
    const context=c?.state??'CONTEXT_INCOMPLETE',measurement=pace?.state??'LEADER_PACE_UNAVAILABLE';
    const blockers=uniq([...(c?.mismatches??[]).map(k=>'TRANSFER_'+k.toUpperCase()),...(c?.unknown??[]).map(k=>'UNKNOWN_'+k.toUpperCase()),...(measurement!=='MEASURED_INDIVIDUAL_RESPONSE_AT_OBSERVED_PACE'?['MEASURED_RESPONSE_NOT_AVAILABLE']:[]),'CURRENT_PACE_NOT_OBSERVED','CLASS_STRENGTH_NOT_ESTABLISHED']);
    const base={event:p.event,context,measurement,blockers,refs:uniq([...p.refs,...(c?.refs??[]),...(pace?.refs??[])]),current_feasibility:'UNRESOLVED',historical_pace_support:measurement==='MEASURED_INDIVIDUAL_RESPONSE_AT_OBSERVED_PACE'?pace.comparisons:null,context_transfer_eligible:context==='OBSERVED_CONTEXT_MATCH_ONLY'};
    return {win:{...base,requirement:p.win},place:{...base,requirement:p.place}};
   });
   h.WIN.contextual_paths=candidates.map(z=>z.win);h.PLACE.contextual_paths=candidates.map(z=>z.place);
   h.WIN.current_pace_fit=null;h.PLACE.current_pace_fit=null;
  }
  const peer=out.followups.filter(z=>z.subject===h.slot),missing=absent.filter(z=>z.subject===h.slot);
  h.peer_context={observed:peer,missing,stable_strength:null};
  const traces=out.trace.filter(z=>z.horse===h.slot),eye=h.eye??[];
  h.items=L.canonical.map(def=>{
   const x=traces.filter(z=>z.item===def.item),e=eye.find(z=>z.item===def.item),material=uniq([...x.flatMap(z=>z.refs),...(e?.observations??[]).flatMap(z=>z.refs)]);
   const state=!currentKnown?h.status==='CANCELLED'?'NOT_APPLICABLE_CANCELLED':'UNKNOWN_CURRENT_IDENTITY':material.length?'OBSERVATION_OR_REVIEW_ONLY':'UNASSESSED_OR_HELD';
   return {item:def.item,name:def.name,state,refs:material,roots:root(material),finding:x.map(z=>z.decision),missing:uniq(x.flatMap(z=>z.missing).concat(e?.missing??[])),semantic_effect_proven:false,grade_effect_proven:false};
  });
  const axis=(name,support,counter,unknown)=>({name,state:!currentKnown?'UNKNOWN':support.length&&counter.length?'MIXED':support.length?'SUPPORT':counter.length?'COUNTER':'UNKNOWN',scope:'HISTORICAL_OR_CONDITIONAL_ONLY',support,counter,unknown});
  h.perspectives=[
   axis('A 基礎能力の実証',own.filter(z=>z.finish===1).map(z=>({event:z.event,finish:z.finish})),[],['COMPARABLE_CLASS_STRENGTH']),
   axis('B 現在の能力発揮',conditionPaths.filter(z=>z.state==='OBSERVED_CONTEXT_MATCH_ONLY'),[],['CAUSAL_CONDITION_RESPONSE',...conditionPaths.flatMap(z=>z.mismatches.map(k=>'TRANSFER_'+k.toUpperCase()))]),
   axis('C 今回の相手比較',h.WIN?.conditional_repeat_support??[],h.WIN?.required_reversals??[],['CURRENT_PAIR_ORDER','PEER_STRENGTH']),
   axis('D 展開耐性',pacePaths.filter(z=>z.state==='MEASURED_INDIVIDUAL_RESPONSE_AT_OBSERVED_PACE'),[],['CURRENT_PACE','PRESSURE_LOAD_TOLERANCE']),
   axis('E 好転・悪化・反証',[],[],['CURRENT_RELEVANCE','NO_CAUSAL_IMPROVEMENT_PROOF',...missing.map(z=>'NO_ASOF_'+z.event)])
  ];
  h.grade=null;
 }
 // Attach a parent lineage key for inherited facts; never count across cases or stages.
 out.lineage=o.evidence.map(e=>({id:e.evidence_id,root:e.root,case_id:name,parent_family_key:e.event_id.startsWith('S26:H')||e.event_id==='S26:T'?sha(JSON.stringify(['S26',e.event_id,e.subject_id,e.field])):null,value_digest:sha(JSON.stringify(e.value)),synthetic:true}));
 return {...out,leaders,proximity,missing_followups:absent,unknown_ability:out.runners.filter(h=>h.unknown_ability).map(h=>h.slot),rank_definitions:L.rankDefinitions,formal:false,grade:null};
}
