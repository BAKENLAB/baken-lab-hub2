// V29 isolated research; no official values, scores, grades or forecasts.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadV28,analyzeV28} from './work27-v28-contrast.mjs';
import {dependencyReader,uniq} from './research-ability-core.mjs';
const need=(x,m)=>{if(!x)throw Error(m)};
const id=e=>e?.evidence_id;
const digest=(a,b)=>createHash(a).update(b).digest('hex');
const blob=b=>digest('sha1',Buffer.concat([Buffer.from('blob '+b.length+'\0'),b]));
const bytes=p=>readFileSync(new URL('./work28-pinned/'+p.split('/').at(-1),import.meta.url));
const json=b=>JSON.parse(b.toString('utf8'));
export function diagnostic28(m,g,canonical){
 need(m.schema==='WORK28_REAL_CANDIDATE_COMPACT_0.1'&&m.scope==='EXISTING_LOCATOR_METADATA_ONLY_NO_OFFICIAL_VALUES'&&m.formal_admissions===0&&m.eligible_values.length===0&&m.global_item_state.formal_state==='HELD'&&!m.global_item_state.analysis_sufficient&&!m.global_item_state.eligible_values.length,'DIAGNOSTIC_SCOPE');
 const defs=new Map(canonical.map(x=>[x.item,x.name]));
 need(defs.size===115&&m.itemDictionary.length===115&&new Set(m.itemDictionary.map(x=>x.item)).size===115&&m.itemDictionary.every(x=>defs.get(x.item)===x.name),'DIAGNOSTIC_CANONICAL');
 const dict=new Map(m.itemDictionary.map(x=>[x.item,x]));
 need(m.JRA.runners.length===18&&m.LOCAL.runners.length===12&&m.LOCAL.target.current_card===null&&m.LOCAL.target.current_card_status==='POSTSTART_RETRIEVAL_REJECTED','DIAGNOSTIC_ROSTER');
 const raw=[...m.JRA.runners,...m.LOCAL.runners];
 need(new Set(raw.map(x=>x.issuer+':'+x.horse_no)).size===30&&m.JRA.runners.every(x=>x.issuer==='JRA')&&m.LOCAL.runners.every(x=>x.issuer==='NAR'),'DIAGNOSTIC_UNIQUE');
 need(g.formal_admissions===0&&g.groups.length===118&&new Set(g.groups.map(x=>x.group_id)).size===118&&g.groups.filter(x=>x.circuit==='JRA').length===88&&g.groups.filter(x=>x.circuit==='LOCAL').length===30&&g.groups.every(x=>x.gates.length===7&&new Set(x.gates.map(y=>y.gate)).size===7&&x.gates.every(y=>y.state==='HELD'&&y.existing_proof===null&&y.formal_usable===false)),'HELD_GATES');
 const runners=raw.map(r=>{
  need(r.history_refs.every(x=>x.formal_usable===false&&x.raw_bytes_verified===false&&x.publication_at===null),'HISTORY_AUTHORITY');
  need(r.items.length===115&&new Set(r.items.map(x=>x[0])).size===115,'RUNNER_ITEMS');
  const items=r.items.map(x=>{
   need(x.length===5&&defs.has(x[0])&&['PARTIAL','MISSING_OR_UNMAPPED'].includes(x[1])&&[...x[2],...x[3]].every(n=>Number.isInteger(n)&&n>=0&&n<r.history_refs.length)&&x[4].every(p=>Array.isArray(p)&&p.length===2&&Number.isInteger(p[0])&&p[0]>=0&&p[0]<m.pins.length&&typeof p[1]==='string'&&p[1].startsWith('/')),'LOCATOR_SHAPE');
   return {item:x[0],name:defs.get(x[0]),supply:x[1],authority:'UNAUTHENTICATED',admission:'HELD',applicability:'UNDETERMINED',evaluation:'NOT_EVALUATED',value:null,required:dict.get(x[0]).required_materials,missing:[...m.global_item_state.reasons,...(x[1]==='MISSING_OR_UNMAPPED'?['MISSING_OR_UNMAPPED_LOCATOR']:['LOCATOR_ONLY_NOT_OBSERVATION'])]};
  });
  return {issuer:r.issuer,slot:r.horse_no,identity:'UNAUTHENTICATED',WIN:null,PLACE:null,grade:null,items};
 });
 const partial=runners.flatMap(x=>x.items).filter(x=>x.supply==='PARTIAL').length;
 need(partial===813&&runners.flatMap(x=>x.items).length===3450,'DIAGNOSTIC_COUNTS');
 return {scope:'DIAGNOSTICS_ONLY_NO_ANALYSIS',runners,partial,missing:3450-partial,formal:0,values:[],groups:118,held:826};
}
export function loadV29(){
 const L=loadV28(),ib=bytes('stage28-final-handoff-v0.1.json');
 need(blob(ib)==='064c5118cdb859e9a1df16e5f9cf39f3d5a4a00a','WORK28_INDEX');
 const i=json(ib);need(i.scope==='EXISTING_LOCATOR_DIAGNOSTICS_ONLY_NO_OFFICIAL_VALUES'&&i.pins.length===4&&i.summary.formal_item_rows===0,'WORK28_INDEX_SCOPE');
 const p=new Map(i.pins.map(x=>{const b=bytes(x.path);need(blob(b)===x.blob&&digest('sha256',b)===x.sha256,'WORK28_PIN');return [x.path.split('/').at(-1),b]}));
 const m=json(p.get('stage28-real-candidate-compact-v0.1.json')),g=json(p.get('stage28-real-source-gates-v0.1.json'));
 return {...L,diagnostics:diagnostic28(m,g,L.canonical),work28:{m,g}};
}
// Positive advantage means subject crosses the same checkpoint earlier than rival.
// Endpoint error = two clocks, change error = four; independent bounds are conservative.
export function classifyInterval(start,end,endpointBound,changeBound=2*endpointBound){
 need([start,end,endpointBound,changeBound].every(Number.isFinite)&&endpointBound>=0&&changeBound>=2*endpointBound,'INTERVAL_INPUT');
 const sign=x=>x>endpointBound?'AHEAD':x< -endpointBound?'BEHIND':'UNKNOWN';
 const a=sign(start),b=sign(end),delta=end-start,change=delta>changeBound?'GAIN':delta< -changeBound?'LOSS':'UNKNOWN';
 let kind='UNRESOLVED';
 if(a==='BEHIND'&&b==='AHEAD'&&change==='GAIN')kind='OVERTAKE_BETWEEN_CHECKPOINTS';
 else if(a==='AHEAD'&&b==='BEHIND'&&change==='LOSS')kind='LEAD_LOST_BETWEEN_CHECKPOINTS';
 else if(a==='BEHIND'&&b==='BEHIND')kind=change==='GAIN'?'DEFICIT_REDUCTION':change==='LOSS'?'DEFICIT_WIDENING':'DEFICIT_CHANGE_UNRESOLVED';
 else if(a==='AHEAD'&&b==='AHEAD')kind=change==='GAIN'?'LEAD_EXTENSION':change==='LOSS'?'LEAD_EROSION':'LEAD_CHANGE_UNRESOLVED';
 return {start,end,delta,endpointBound,changeBound,start_order:a,end_order:b,change,kind};
}
const orient=(x,sign)=>({...classifyInterval(sign*x.start,sign*x.end,x.endpointBound,x.changeBound),from_m:x.from_m,to_m:x.to_m});
export function conditionalEnvelope(relations,threshold){
 need(threshold===null||Number.isInteger(threshold)&&threshold>0,'PLACE_THRESHOLD');
 const ahead=relations.filter(x=>x.order==='BEHIND').length,behind=relations.filter(x=>x.order==='AHEAD').length,unknown=relations.length-ahead-behind;
 const min=1+ahead,max=min+unknown;
 const decide=t=>min>t?'CONTRADICTED_UNDER_ASSUMPTIONS':max<=t?'SUPPORTED_UNDER_ASSUMPTIONS':'UNRESOLVED_UNDER_ASSUMPTIONS';
 return {min,max,ahead,behind,unknown,win:decide(1),place:threshold===null?null:decide(threshold),threshold,current_feasibility:'UNRESOLVED',prediction:false};
}
export function analyzeV29(L,name,withdraw=null,options={}){
 const threshold=options.placeThreshold??null;
 const out=analyzeV28(L,name,withdraw,{placeThreshold:threshold}),{r,o}=L.cases.get(name);
 const all=new Map(o.evidence.map(e=>[id(e),e])),field=(ev,h,k)=>o.evidence.find(e=>e.event_id===ev&&e.subject_id===h&&e.field===k);
 const {get,lineage}=dependencyReader(all,withdraw,e=>e.subject_id===null||e.field==='id'?[]:[id(field(e.event_id,e.subject_id,'id')),...(e.field==='status'?[]:[id(field(e.event_id,e.subject_id,'status'))])].filter(Boolean));
 const ok=e=>e&&get(id(e))&&e.state==='SYNTHETIC_OBSERVATION',v=e=>ok(e)?e.value:null,refs=es=>lineage(es.filter(Boolean)).filter(ok).map(id);
 const [target,...history]=o.events,active=out.roster.possible_active;
 const historical=(e,h)=>out.historical.find(x=>x.event===e&&x.horse===h);
 const pairProgress=[];
 // No dependency on finish order, current ranking or finish clocks.
 for(const e of history)for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j];if(!historical(e.event_id,a)||!historical(e.event_id,b))continue;
  if(!out.runners.find(x=>x.slot===a)?.identity_known||!out.runners.find(x=>x.slot===b)?.identity_known)continue;
  const ea=field(e.event_id,a,'checkpoint_ms'),eb=field(e.event_id,b,'checkpoint_ms'),ta=v(ea),tb=v(eb),geo=v(e.geometry),intervals=[];
  if(ta&&tb&&geo&&ta.length===tb.length&&ta.length===geo.checkpoints_m.length){
   for(let k=1;k<ta.length;k++)intervals.push({...classifyInterval(tb[k-1]-ta[k-1],tb[k]-ta[k],2*r.measurement.clock_uncertainty_ms),from_m:geo.checkpoints_m[k-1],to_m:geo.checkpoints_m[k]});
  }
  const intervalRefs=intervals.length?refs([id(ea),id(eb),id(e.geometry)]):[];
  const coordinates=out.relative.filter(x=>x.event===e.event_id&&((x.a===a&&x.b===b)||(x.a===b&&x.b===a))).map(x=>({gain_m:x.a===a?x.gain:-x.gain,bound_m:x.bound,refs:x.refs}));
  const f=out.direct.find(x=>x.event===e.event_id&&x.a===a&&x.b===b);
  pairProgress.push({event:e.event_id,a,b,intervals,intervalRefs,coordinates,finish_order:f?.order??null,finishRefs:f?refs([id(field(e.event_id,a,'finish')),id(field(e.event_id,b,'finish'))]):[],pressure:null});
 }
 for(const h of out.runners){
  const valid=h.identity_known&&h.status==='ACTIVE',cancelled=h.status==='CANCELLED',own=h.historical??[];
  const rivals=active.filter(x=>x!==h.slot);
  const pairs=valid?pairProgress.filter(x=>x.a===h.slot||x.b===h.slot).map(x=>{
   const s=x.a===h.slot?1:-1,segments=x.intervals.map(z=>orient(z,s)),gains=segments.filter(z=>z.change==='GAIN'),losses=segments.filter(z=>z.change==='LOSS');
   return {event:x.event,rival:s===1?x.b:x.a,segments,pattern:gains.length&&losses.length?'MIXED':gains.length?'GAIN_ONLY':losses.length?'LOSS_ONLY':'UNRESOLVED',recovery:losses.some(l=>gains.some(g=>g.from_m>=l.to_m)),coordinate:x.coordinates.map(z=>({...z,gain_m:s*z.gain_m})),intervalRefs:x.intervalRefs,finishRefs:x.finishRefs,finish_order:x.finish_order};
  }):[];
  h.pair_progress_v29=pairs;
  const roles=active.map(k=>{const q=out.runners.find(x=>x.slot===k),hs=q?.historical??[];const early=hs.filter(z=>z.rank?.[0]===1),gain=hs.filter(z=>z.ordinal?.transitions.some(t=>t.ordinal_gain>0));return {slot:k,role:!q?.identity_known||!hs.some(z=>z.rank?.length)?'UNKNOWN':early.length?'OBSERVED_FIRST_CHECKPOINT_LEADER':gain.length?'OBSERVED_ORDINAL_ADVANCE':'OBSERVED_OTHER_POSITION',refs:uniq([...early,...gain].flatMap(z=>z.rankTrace.refs))};});
  // Three separate hypotheses; never treat the unknown queue/pace as a measurement.
  // A: reproduce observed start and trajectory. B: equal checkpoint start and same
  // observed net change. C: contested lead/different pace, response unidentified.
  const paths=valid?own.flatMap(a=>{
   const ps=pairs.filter(x=>x.event===a.event),context=h.condition_paths.find(x=>x.event===a.event);
   const ev=history.find(x=>x.event_id===a.event),geo=v(ev?.geometry);
   const checkpoint=geo?.checkpoints_m?.at(-1)??null;
   if(checkpoint===null)return [];
   const scenarios=[
    {queue:'REPLAY_OBSERVED_CHECKPOINT_QUEUE',pace:'ASSUME_OBSERVED_RELATIVE_RESPONSE_REPEATS',assumptions:['HISTORICAL_PAIR_CHECKPOINT_TRAJECTORIES_REPEAT','FINAL_MEASURED_CHECKPOINT_ORDER_PERSISTS_TO_FINISH']},
    {queue:'EQUAL_FIRST_CHECKPOINT_START',pace:'ASSUME_OBSERVED_NET_RELATIVE_CHANGE_REPEATS',assumptions:['HYPOTHETICAL_EQUAL_CROSSING_TIME_AT_FIRST_CHECKPOINT','HISTORICAL_NET_RELATIVE_CHANGE_REPEATS','FINAL_MEASURED_CHECKPOINT_ORDER_PERSISTS_TO_FINISH']},
    {queue:'CONTESTED_LEAD_OR_UNKNOWN_ROLE',pace:'DIFFERENT_OR_UNIDENTIFIED_PACE',assumptions:['NO_MEASURED_RESPONSE_FOR_CHANGED_QUEUE_OR_PACE']}
   ];
   return scenarios.map(sc=>{
    const relations=rivals.map(rival=>{
     const p=ps.find(x=>x.rival===rival),first=p?.segments[0],last=p?.segments.at(-1);
     const measured=!!(first&&last&&last.to_m===checkpoint);
     const gain=measured?last.end-first.start:null,bound=measured?first.changeBound:null;
     const actualOrder=measured?last.end_order:'UNKNOWN';
     let order='UNKNOWN',basis='NO_RESOLVED_SAME_CHECKPOINT_ORDER';
     if(measured&&sc.queue==='REPLAY_OBSERVED_CHECKPOINT_QUEUE'){order=actualOrder;basis='MEASURED_HISTORICAL_CHECKPOINT_ORDER';}
     if(measured&&sc.queue==='EQUAL_FIRST_CHECKPOINT_START'){order=gain>bound?'AHEAD':gain< -bound?'BEHIND':'UNKNOWN';basis='HYPOTHETICAL_START_PLUS_BOUNDED_OBSERVED_NET_CHANGE';}
     if(sc.queue==='CONTESTED_LEAD_OR_UNKNOWN_ROLE')basis='NO_IDENTIFIED_RESPONSE_TO_CHANGED_PACE';
     const required=p?.finish_order===null||!p?'UNKNOWN_HISTORICAL_FINISH':p.finish_order===h.slot?'MAINTAIN_PAST_FINISH_RELATION':'REVERSE_PAST_FINISH_RELATION';
     return {rival,order,required,conditional_relation:order==='AHEAD'?'SUPPORTED_UNDER_ASSUMPTIONS':order==='BEHIND'?'CONTRADICTED_UNDER_ASSUMPTIONS':'UNRESOLVED_UNDER_ASSUMPTIONS',net_change_ms:gain,change_bound_ms:bound,required_start_advantage_ms:gain===null?null:{sufficient_strictly_above:bound-gain,contradicted_strictly_below:-bound-gain,scope:'IF_SAME_NET_CHANGE_AND_EXACT_HYPOTHETICAL_START'},segments:p?.segments??[],refs:p?.intervalRefs??[],finish_refs:p?.finishRefs??[],basis};
    });
    const envelope=conditionalEnvelope(relations,threshold);
    return {event:a.event,checkpoint,queue:sc.queue,pace:sc.pace,roles,assumptions:[...sc.assumptions,'TRANSFER_ACROSS_CURRENT_CONDITION_DIFFERENCES_NOT_ESTABLISHED'],relations,envelope,context:context?.state??'UNKNOWN',condition_mismatches:context?.mismatches??[],condition_unknown:context?.unknown??[],queue_feasibility:'UNRESOLVED_NO_QUEUE_RESPONSE_MODEL',current_feasibility:'UNRESOLVED',refs:uniq([...relations.flatMap(x=>x.refs),...(context?.refs??[]),...roles.flatMap(x=>x.refs)])};
   });
  }):[];
  h.conditional_scenarios=paths;
  if(h.WIN&&h.PLACE){
   h.WIN.conditional_scenarios=paths.map(x=>({...x,conditional_state:x.envelope.win}));
   h.PLACE.generic_placing_research=h.PLACE.contextual_paths;
   h.PLACE.contextual_paths=threshold===null?[]:h.PLACE.contextual_paths;
   h.PLACE.conditional_scenarios=threshold===null?[]:paths.map(x=>({...x,conditional_state:x.envelope.place}));
   h.PLACE.missing=uniq(h.PLACE.missing.filter(x=>x!=='PLACE_THRESHOLD').concat(threshold===null?['PLACE_THRESHOLD']:[]));
  }
  const findings=[];
  const finding=(item,state,observation,ids,missing)=>findings.push({item,state,observation,refs:uniq(ids),missing,formal:false});
  for(const p of pairs){
   finding('RANK18',p.pattern,p.segments,p.intervalRefs,['CURRENT_REPRODUCIBILITY_UNPROVEN']);
   if(p.recovery)finding('RANK21','MEASURED_PAIR_LOSS_THEN_GAIN',p.segments,p.intervalRefs,['NOT_CAUSAL_OR_CURRENT_PROOF']);
   if(p.finish_order===h.slot&&p.segments.some(z=>z.kind==='LEAD_EXTENSION'||z.kind==='LEAD_EROSION'||z.kind==='OVERTAKE_BETWEEN_CHECKPOINTS'))finding('RANK12','HISTORICAL_PAIR_CONVERSION_OBSERVATION',{rival:p.rival,segments:p.segments},[...p.intervalRefs,...p.finishRefs],['FULL_FIELD_WIN_AND_COMPARABLE_STRENGTH_UNPROVEN']);
   if(p.finish_order&&p.finish_order!==h.slot&&p.segments.some(z=>z.change==='GAIN'))finding('RANK29','PAIR_GAIN_DESPITE_FINISH_LOSS_REVIEW',{rival:p.rival,segments:p.segments},[...p.intervalRefs,...p.finishRefs],['COMPARABLE_CLASS_AND_LOAD_UNPROVEN']);
  }
  for(const a of own){
   if(a.ordinal?.recovery)finding('RANK21','ORDINAL_RECOVERY_OBSERVED',a.ordinal.transitions,a.rankTrace.refs,['NO_CAUSAL_CURRENT_PROOF']);
   if(a.intervals?.length)finding('RANK08','INTERVAL_AVERAGE_PROFILE_ONLY',a.speedComparisons,a.speedTrace.refs,['ENDURANCE_AND_LOAD_TOLERANCE_UNPROVEN']);
  }
  h.v29_findings=findings;
  h.items=h.items.map(x=>{const f=findings.filter(z=>z.item===x.item);return {...x,state:cancelled?'NOT_APPLICABLE_CANCELLED':!valid?'UNKNOWN_CURRENT_IDENTITY_OR_STATUS':f.length?'OBSERVATION_WITH_SEMANTIC_FINDING':x.state,refs:uniq([...x.refs,...f.flatMap(z=>z.refs)]),finding:[...x.finding,...f.map(z=>z.state)],missing:uniq([...x.missing,...f.flatMap(z=>z.missing),...(x.item==='RANK22'?['NO_AUTHENTICATED_CORNER_INTERVAL_MAP']:[])]),semantic_effect_proven:false,grade_effect_proven:false};});
  const axis=(name,observations,unknown)=>({name,state:cancelled?'NOT_APPLICABLE':!valid?'UNKNOWN_IDENTITY_OR_STATUS':observations.length?'OBSERVED_NOT_CURRENT_PROOF':'UNKNOWN',observations,support:[],counter:[],unknown});
  h.perspectives=[
   axis('A 基礎能力の実証',findings.filter(x=>['RANK08','RANK12','RANK21','RANK29'].includes(x.item)),['COMPARABLE_CLASS_STRENGTH']),
   axis('B 現在の能力発揮',h.condition_paths??[],['CONDITION_CAUSAL_RESPONSE']),
   axis('C 今回の相手比較',paths.map(x=>({event:x.event,conditional:x.envelope,refs:x.refs})),['CURRENT_RIVAL_ORDER']),
   axis('D 展開耐性',h.pace_paths??[],['CURRENT_PACE','MATCHED_LOAD_TOLERANCE']),
   axis('E 好転・悪化・反証',findings.filter(x=>x.item==='RANK18'||x.item==='RANK29'),['CURRENT_RELEVANCE'])
  ];
  h.eye_feedback_v29=valid?(h.eye??[]).filter(x=>x.item==='EYE03'&&x.observations.length).map(x=>({item:x.item,targets:['RANK18','RANK21'],refs:uniq(x.observations.flatMap(z=>z.refs)),reviewed:findings.filter(f=>f.item==='RANK21'),current_relevance:'UNPROVEN',independent_vote:false,canonical_return:false})):[];
  h.grade=null;
 }
 for(const x of out.followups)x.field_missing=Object.fromEntries(['finish','clock','terminal_ms','ranks','weight','conditions','actual_starters','margin_ms'].map(k=>[k,x[k]===null||x[k]===undefined?x.state==='HELD_DEPENDENCY'?'DEPENDENCY_HELD':'NO_ADMISSIBLE_FIELD':'OBSERVED_SYNTHETIC']));
 return {...out,pair_progress_v29:pairProgress,diagnostic_scope:'SEPARATE_NO_VALUE_TRANSFER',formal:false,grade:null};
}
