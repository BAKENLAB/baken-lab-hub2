// V30 research only: no official observations, grade or prediction.
import {loadV29,analyzeV29,classifyInterval} from './work28-v29-feasibility.mjs';
import {dependencyReader,uniq} from './research-ability-core.mjs';
export {loadV29 as loadV30};
const need=(x,m)=>{if(!x)throw Error(m)};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const reverse=x=>x==='AHEAD'?'BEHIND':x==='BEHIND'?'AHEAD':'UNKNOWN';
const order=(x,u)=>x>u?'AHEAD':x< -u?'BEHIND':'UNKNOWN';
const decision=(min,max,t)=>t===null?null:min>t?'CONTRADICTED_UNDER_ASSUMPTIONS':max<=t?'SUPPORTED_UNDER_ASSUMPTIONS':'UNRESOLVED_UNDER_ASSUMPTIONS';
// A single shared partial order, not independent pair choices. Missing edges stay unknown.
export function jointField(roster,pairs,threshold=null){
 need(Array.isArray(roster)&&roster.every(x=>typeof x==='string'&&x.length)&&new Set(roster).size===roster.length,'ROSTER');
 need(threshold===null||Number.isInteger(threshold)&&threshold>=1&&threshold<=roster.length,'THRESHOLD');
 const seen=new Set(),graph=new Map(roster.map(h=>[h,new Set()])),n=roster.length;
 for(const p of pairs){
  need(graph.has(p.a)&&graph.has(p.b)&&p.a!==p.b&&['AHEAD','BEHIND','UNKNOWN'].includes(p.order),'PAIR');
  const key=JSON.stringify([p.a,p.b].sort());need(!seen.has(key),'DUPLICATE_PAIR');seen.add(key);
  if(p.order==='AHEAD')graph.get(p.a).add(p.b);
  if(p.order==='BEHIND')graph.get(p.b).add(p.a);
 }
 need(seen.size===n*(n-1)/2,'INCOMPLETE_ROSTER_RELATIONS');
 const closure=new Map(roster.map(h=>[h,new Set(graph.get(h))]));
 for(const k of roster)for(const a of roster)if(closure.get(a).has(k))for(const b of closure.get(k))closure.get(a).add(b);
 if(roster.some(h=>closure.get(h).has(h)))return {state:'CONTRADICTED_SHARED_ORDER',envelopes:[],prediction:false};
 return {state:n<2?'NOT_APPLICABLE':'CONSISTENT_PARTIAL_ORDER',envelopes:roster.map(h=>{
  const rival_ahead=roster.filter(a=>closure.get(a).has(h)).length,rival_behind=closure.get(h).size,unknown=n-1-rival_ahead-rival_behind,min=1+rival_ahead,max=n-rival_behind;
  return {slot:h,min,max,rival_ahead,rival_behind,unknown,win:n<2?null:decision(min,max,1),place:n<2?null:decision(min,max,threshold),threshold,current_feasibility:'UNRESOLVED',prediction:false};
 }),prediction:false};
}
// Explicit common-start checkpoint and finish measurements in the SAME historical event.
export function terminalSegment({a,b,lastA,lastB,finishA,finishB,rankA,rankB,distance,checkpoint,uncertainty}){
 if(![lastA,lastB,finishA,finishB,distance,checkpoint,uncertainty].every(finite)||!Number.isInteger(rankA)||!Number.isInteger(rankB)||rankA<1||rankB<1||uncertainty<0||checkpoint<=0||distance<=checkpoint||lastA<=0||lastB<=0||finishA-lastA<=2*uncertainty||finishB-lastB<=2*uncertainty)return {state:'MISSING_OR_INVALID_TERMINAL',segment:null};
 const u=2*uncertainty,s=classifyInterval(lastB-lastA,finishB-finishA,u,2*u);
 const rankOrder=rankA<rankB?'AHEAD':rankA>rankB?'BEHIND':'UNKNOWN';
 if((s.end_order!=='UNKNOWN'&&s.end_order!==rankOrder))return {state:'CLOCK_FINISH_CONTRADICTION',segment:null};
 const dtA=finishA-lastA,dtB=finishB-lastB,m=distance-checkpoint;
 return {state:'OBSERVED_TERMINAL',segment:{...s,from_m:checkpoint,to_m:distance,a,b,elapsed_a_ms:dtA,elapsed_b_ms:dtB,average_a_mps:m*1000/dtA,average_b_mps:m*1000/dtB,average_a_bounds_mps:[m*1000/(dtA+u),m*1000/(dtA-u)],average_b_bounds_mps:[m*1000/(dtB+u),m*1000/(dtB-u)],finish_order:rankOrder,checkpoint_persistence:s.start_order!=='UNKNOWN'&&rankOrder!=='UNKNOWN'?(s.start_order===rankOrder?'OBSERVED_CONSISTENT':'OBSERVED_COUNTEREXAMPLE'):'UNRESOLVED'}};
}
export function analyzeV30(L,name,withdraw=null,options={}){
 const threshold=options.placeThreshold??null,out=analyzeV29(L,name,withdraw,options),{r,o}=L.cases.get(name),[target,...history]=o.events,active=out.roster.possible_active;
 const field=(ev,h,k)=>o.evidence.find(e=>e.event_id===ev&&e.subject_id===h&&e.field===k),id=e=>e?.evidence_id,all=new Map(o.evidence.map(e=>[id(e),e]));
 const {get,lineage}=dependencyReader(all,withdraw,e=>e.subject_id===null||e.field==='id'?[]:[id(field(e.event_id,e.subject_id,'id')),...(e.field==='status'?[]:[id(field(e.event_id,e.subject_id,'status'))])].filter(Boolean));
 const ok=e=>e&&get(id(e))&&e.state==='SYNTHETIC_OBSERVATION',v=e=>ok(e)?e.value:null,refs=es=>lineage(es.map(id).filter(Boolean)).filter(ok).map(id);
 const hs=(ev,h)=>out.historical.find(x=>x.event===ev&&x.horse===h);
 const terminal=[],scenarios=[];
 for(const e of history){
  const ev=e.event_id,geometry=v(e.geometry),conditions=v(e.conditions),distance=conditions?.distance_m??null,checkpoint=geometry?.checkpoints_m?.at(-1)??null;
  const targetDistance=v(target.conditions)?.distance_m??null;
  const pairs=[];
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j],p=out.pair_progress_v29.find(x=>x.event===ev&&x.a===a&&x.b===b),last=p?.intervals.at(-1);
   const ca=field(ev,a,'checkpoint_ms'),cb=field(ev,b,'checkpoint_ms'),fa=field(ev,a,'finish_ms'),fb=field(ev,b,'finish_ms'),ra=field(ev,a,'finish'),rb=field(ev,b,'finish');
   const ta=v(ca),tb=v(cb),ha=hs(ev,a),hb=hs(ev,b);
   const t=p&&last&&last.to_m===checkpoint&&r.measurement.checkpoint_scope==='COURSE_DISTANCE_CROSSING_ELAPSED_FROM_COMMON_START'?terminalSegment({a,b,lastA:ta?.at(-1),lastB:tb?.at(-1),finishA:v(fa),finishB:v(fb),rankA:ha?.finish,rankB:hb?.finish,distance,checkpoint,uncertainty:r.measurement.clock_uncertainty_ms}):{state:'MISSING_OR_INVALID_TERMINAL',segment:null};
   const termRefs=t.segment?refs([ca,cb,fa,fb,ra,rb,e.geometry,e.conditions]):[];
   const rankOrder=p?.finish_order===a?'AHEAD':p?.finish_order===b?'BEHIND':'UNKNOWN';
   const rankRefs=rankOrder==='UNKNOWN'?[]:refs([ra,rb]);
   const checkpointOrder=last?.end_order??'UNKNOWN';
   const persistence=checkpointOrder!=='UNKNOWN'&&rankOrder!=='UNKNOWN'?(checkpointOrder===rankOrder?'OBSERVED_CONSISTENT':'OBSERVED_COUNTEREXAMPLE'):'UNRESOLVED';
   const row={event:ev,a,b,checkpoint,distance,target_distance:targetDistance,transfer:distance!==null&&targetDistance!==null&&distance===targetDistance?'SAME_DISTANCE_NOT_TRANSFER_PROOF':'DISTANCE_CHANGED_OR_UNKNOWN',checkpoint_order:checkpointOrder,finish_order:rankOrder,persistence,terminal:t,checkpoint_refs:p?.intervalRefs??[],finish_refs:rankRefs,terminal_refs:termRefs,refs:uniq([...(p?.intervalRefs??[]),...rankRefs,...termRefs])};
   pairs.push(row);terminal.push(row);
  }
  const create=(kind,predicate,scope)=>{
   const relations=pairs.map(p=>({a:p.a,b:p.b,order:predicate(p),refs:p.refs}));
   return {event:ev,kind,scope,relations,field:jointField(active,relations,threshold),actual_current_feasibility:'UNRESOLVED',prediction:false};
  };
  scenarios.push(create('CHECKPOINT_OBSERVED',p=>p.checkpoint_order,'HISTORICAL_CHECKPOINT_ONLY'));
  scenarios.push(create('FINISH_OBSERVED',p=>p.terminal.state==='CLOCK_FINISH_CONTRADICTION'?'UNKNOWN':p.finish_order,'HISTORICAL_FINISH_ORDER_AMONG_CURRENT_POSSIBLE_RUNNERS'));
  const counter=pairs.filter(p=>p.persistence==='OBSERVED_COUNTEREXAMPLE');
  const persist=create('CHECKPOINT_PERSISTS_TO_FINISH',p=>p.checkpoint_order,'COUNTERFACTUAL_NOT_OBSERVED_FINISH');
  persist.counterexamples=counter.map(p=>({a:p.a,b:p.b,refs:p.refs}));
  if(counter.length)persist.field={state:'CONTRADICTED_BY_OBSERVED_FINISH',envelopes:[],prediction:false};
  // No measured changed-pace response means no conditional claim. All possible runners kept.
  scenarios.push(persist,create('CHANGED_PACE_OR_CONTESTED_LEAD',()=> 'UNKNOWN','UNIDENTIFIED_CURRENT_RESPONSE'));
 }
 for(const h of out.runners){
  const valid=h.identity_known&&h.status==='ACTIVE',rows=valid?terminal.filter(p=>p.a===h.slot||p.b===h.slot).map(p=>{
   const s=p.terminal.segment,sign=p.a===h.slot?1:-1;
   return {...p,rival:sign===1?p.b:p.a,checkpoint_order:sign===1?p.checkpoint_order:reverse(p.checkpoint_order),finish_order:sign===1?p.finish_order:reverse(p.finish_order),subject_segment:s?{...classifyInterval(sign*s.start,sign*s.end,s.endpointBound,s.changeBound),from_m:s.from_m,to_m:s.to_m,elapsed_ms:sign===1?s.elapsed_a_ms:s.elapsed_b_ms,rival_elapsed_ms:sign===1?s.elapsed_b_ms:s.elapsed_a_ms}:null};
  }):[];
  const paths=valid?scenarios.map(s=>({event:s.event,kind:s.kind,scope:s.scope,state:s.field.state,envelope:s.field.envelopes.find(x=>x.slot===h.slot)??null,counterexamples:s.counterexamples??[],refs:uniq(s.relations.flatMap(x=>x.refs)),current_feasibility:'UNRESOLVED'})):[];
  const findings=[];
  for(const p of rows){
   const z=p.subject_segment;
   const add=(item,state,roots,observation)=>findings.push({item,state,refs:uniq(roots),observation,formal:false,current_relevance:'UNPROVEN'});
   if(p.persistence==='OBSERVED_COUNTEREXAMPLE')add('RANK18','CHECKPOINT_PERSISTENCE_REFUTED',p.refs,{rival:p.rival,checkpoint:p.checkpoint_order,finish:p.finish_order});
   if(z){
    add('RANK08','TERMINAL_INTERVAL_AVERAGE_NOT_PHYSIOLOGICAL_ENDURANCE',p.terminal_refs,z);
    add('RANK18',z.kind,p.terminal_refs,z);
    if(z.start_order==='BEHIND'&&z.end_order==='AHEAD')add('RANK21','TERMINAL_PAIR_RECOVERY',p.terminal_refs,z);
    if(p.finish_order==='AHEAD')add('RANK12',z.start_order==='AHEAD'?'TERMINAL_PAIR_LEAD_RETAINED':'TERMINAL_PAIR_CONVERSION',p.terminal_refs,z);
    if(p.finish_order==='BEHIND'&&z.change==='GAIN')add('RANK29','TERMINAL_GAIN_DESPITE_PAIR_LOSS_REVIEW',p.terminal_refs,z);
   }
  }
  for(const path of paths.filter(p=>p.kind==='CHECKPOINT_PERSISTS_TO_FINISH'&&p.state==='CONTRADICTED_BY_OBSERVED_FINISH'))findings.push({item:'RANK100',state:'SHARED_PATH_REJECTED_BY_TERMINAL_COUNTEREVIDENCE',refs:path.refs,observation:{event:path.event},formal:false,current_relevance:'UNPROVEN'});
  h.terminal_v30=rows;h.scenarios_v30=paths;h.findings_v30=findings;
  // Preserve old data only as explicitly superseded diagnostics, not competing decision outputs.
  h.legacy_v29={conditional_scenarios:h.conditional_scenarios,findings:h.v29_findings,semantic_effects:h.semantic_effects_v29,scope:'SUPERSEDED_FOR_FINISH_DECISIONS'};
  h.conditional_scenarios=paths;
  if(h.WIN){h.WIN.conditional_scenarios=paths.filter(p=>p.kind!=='CHECKPOINT_OBSERVED').map(p=>({...p,conditional_state:p.envelope?.win??p.state}));h.WIN.state='UNRESOLVED';}
  if(h.PLACE){h.PLACE.conditional_scenarios=threshold===null?[]:paths.filter(p=>p.kind!=='CHECKPOINT_OBSERVED').map(p=>({...p,conditional_state:p.envelope?.place??p.state}));h.PLACE.state='UNRESOLVED';}
  h.items=h.items.map(x=>{const f=findings.filter(z=>z.item===x.item);return {...x,refs:uniq([...x.refs,...f.flatMap(z=>z.refs)]),v30_findings:f,v30_semantic_scope:f.length?'HISTORICAL_OR_CONDITIONAL_ONLY':null,grade_effect_proven:false};});
  h.eye_feedback_v30=valid?(h.eye_feedback_v29??[]).map(x=>({...x,reviewed:findings.filter(f=>['RANK18','RANK21'].includes(f.item)),current_relevance:'UNPROVEN',independent_vote:false,canonical_return:false})):[];
  h.grade=null;
 }
 return {...out,terminal_v30:terminal,shared_scenarios_v30:scenarios,formal:false,grade:null};
}
