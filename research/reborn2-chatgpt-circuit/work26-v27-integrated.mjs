// V27 synthetic-only research integration. V26 retained via shared primitives and dispatch.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadV26,analyzeV26} from './work23-v26-integrated.mjs';
import {validate,supply,sha256} from './work26-pinned/stage26-varied-synthetic-producer-v0.1.mjs';
import {uniq,dependencyReader,relativePosition,ordinalPath,signedGap,conditionDelta,winPlaceRequirements,repeatEnvelope} from './research-ability-core.mjs';
const read=path=>readFileSync(new URL('./work26-pinned/'+path.split('/').at(-1),import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const parse=b=>JSON.parse(b.toString('utf8'));
const need=(v,m)=>{if(!v)throw Error(m)};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ptr=(v,p)=>p.split('/').slice(1).reduce((o,k)=>o?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],v);
const pin=x=>{const b=read(x.path);need(blob(b)===x.blob&&sha(b)===x.sha256,'PIN '+x.path);return b};
export function loadV27(){
 const previous=loadV26(),ib=read('stage26-final-handoff-v0.1.json');
 need(blob(ib)==='ca46b670d6a8f8fdd0880019c189fe89c83c094a','INDEX');
 const i=parse(ib);need(i.schema==='WORK26_FINAL_RESEARCH_HANDOFF_0.1'&&i.scope==='EXPLICITLY_SYNTHETIC_NEVER_OFFICIAL'&&i.gates.formal_admissions===0,'INDEX_SCOPE');
 for(const x of [i.producer,i.execution,i.readback])pin(x);
 const raw=parse(pin(i.raw)),plan=parse(pin(i.full_field_plan)),cases=new Map();
 for(const b of i.batches){const out=parse(pin(b));for(const c of b.cases){
  const r=raw.cases.find(q=>q.case_id===c.id),o=ptr(out,c.output_pointer),f=plan.cases.find(q=>q.case_id===c.id);
  need(r&&o&&f&&o.case_id===c.id&&f.raw_sha256===c.raw_case_sha256&&sha(JSON.stringify(r))===c.raw_case_sha256&&o.raw_sha256===c.raw_case_sha256,'CASE_BINDING');
  need(r.history.every((e,j)=>j===0||e.event_at>r.history[j-1].event_at),'EVENT_CHRONOLOGY');
  need(r.measurement.checkpoint_scope==='COURSE_DISTANCE_CROSSING_ELAPSED_FROM_COMMON_START'&&r.measurement.snapshot_scope==='SYNCHRONIZED_COURSE_COORDINATE_NOT_ACTUAL_PATH_LENGTH'&&Number.isFinite(r.measurement.clock_uncertainty_ms)&&Number.isFinite(r.measurement.snapshot_uncertainty_m),'MEASUREMENT_SCOPE');
  need(validate(r)&&eq(supply(r,sha256),o),'PRODUCER_REPLAY');
  need(o.formal_admissions===0&&!o.analysis_sufficient&&o.evidence.length===c.evidence_records&&o.active_ids.length===c.active_count&&o.followups.length===c.followup_links,'OUTPUT_COUNTS');
  need(new Set(o.evidence.map(e=>e.evidence_id)).size===o.evidence.length&&o.evidence.every(e=>e.source_sha256===c.raw_case_sha256&&!e.formal_usable&&eq(ptr(r,e.pointer),e.value)),'EVIDENCE_POINTERS');
  need(eq(f.active_ids,o.active_ids)&&f.pairs.length===o.active_ids.length*(o.active_ids.length-1)/2,'FIELD_PLAN');
  need(!cases.has(c.id),'DUP_CASE');cases.set(c.id,{r,o,f});
 }}
 need(cases.size===7&&raw.cases.length===7,'CASE_COUNT');return {previous,cases};
}
export function analyzeResearch(loaded,name,withdraw=null){return loaded.cases.has(name)?analyzeV27(loaded,name,withdraw):analyzeV26(loaded.previous,name,withdraw);}
export function analyzeV27(loaded,name,withdraw=null,options={}){
 const threshold=Object.hasOwn(options,'placeThreshold')?options.placeThreshold:3;need(threshold===null||Number.isInteger(threshold)&&threshold>0,'RESEARCH_THRESHOLD');
 const pack=loaded.cases.get(name);need(pack,'CASE');const {r,o,f}=pack;
 const all=new Map(o.evidence.map(e=>[e.evidence_id,e])),fields=new Map(o.evidence.map(e=>[JSON.stringify([e.event_id,e.subject_id,e.field]),e]));
 const field=(event,horse,key)=>fields.get(JSON.stringify([event,horse,key]));
 if(withdraw!==null)need(all.has(withdraw),'WITHDRAW_ID');
 // Synthetic view invalidates dependencies without mutating any original evidence ID/value.
 const deps=e=>e.subject_id===null?[]:e.field==='id'?[]:e.field==='status'?[field(e.event_id,e.subject_id,'id')?.evidence_id]:[field(e.event_id,e.subject_id,'id')?.evidence_id,field(e.event_id,e.subject_id,'status')?.evidence_id];
 const {get,lineage}=dependencyReader(all,withdraw,e=>deps(e).filter(Boolean));
 const id=e=>e?.evidence_id, usable=e=>e&&get(id(e))&&e.state==='SYNTHETIC_OBSERVATION', val=e=>usable(e)?e.value:null;
 const trace=[];const note=(horse,item,decision,refs,missing=[])=>{const xs=lineage(refs.filter(Boolean)).filter(e=>e.state==='SYNTHETIC_OBSERVATION');const q={horse,item,decision,refs:xs.map(id),roots:uniq(xs.map(e=>e.root)),missing,formal:false};trace.push(q);return q;};
 const [target,...history]=o.events, targetId=target.event_id;
 const current=target.rows.map(row=>({slot:row.id,horse:val(field(targetId,row.id,'id')),status:val(field(targetId,row.id,'status')),horse_number:val(row.horse_number),gate_number:val(row.gate_number),weight:val(row.weight),identity_known:!!get(row.identity_ref)}));
 // Card slot remains an unresolved possible competitor if its identity/status is withheld.
 const active=current.filter(x=>x.status!=='CANCELLED'),knownActive=active.filter(x=>x.status==='ACTIVE');
 const roster={registered:val(target.registered_count),declared_active_count:val(target.declared_active_count),actual_starters:null,known_active:knownActive.map(x=>x.slot),possible_active:active.map(x=>x.slot),unknown_slots:active.filter(x=>!x.identity_known||x.status===null).map(x=>x.slot)};
 const hist=[],byHist=new Map();
 const key=(e,h)=>e+'|'+h;
 for(const e of history)for(const row of e.rows){
  if(val(field(e.event_id,row.id,'status'))!=='FINISHED')continue;
  const rank=field(e.event_id,row.id,'ranks'),count=e.actual_starters,g=e.geometry,c=e.conditions,rg=val(rank),n=val(count),geom=val(g),base=ordinalPath(rg);
  const positions=rg&&n!==null?rg.map((x,j)=>({...relativePosition(x,n),distance_m:geom?.checkpoints_m[j]??null})):null;
  const clock=field(e.event_id,row.id,'checkpoint_ms'),times=val(clock),u=r.measurement.clock_uncertainty_ms*2;
  let intervals=null,speed='UNRESOLVED',speedComparisons=[];
  if(geom&&times&&times.length>=3){intervals=times.slice(1).map((t,j)=>{const dt=t-times[j],d=geom.checkpoints_m[j+1]-geom.checkpoints_m[j];return {m:d,ms:dt,mps:d*1000/dt,low:dt>u?d*1000/(dt+u):null,high:dt>u?d*1000/(dt-u):null}});speedComparisons=intervals.slice(1).map((b,j)=>{const a=intervals[j];return a.low===null||b.low===null?'UNRESOLVED':b.low>a.high?'HIGHER_INTERVAL_AVERAGE':b.high<a.low?'LOWER_INTERVAL_AVERAGE':'UNCERTAINTY_OVERLAP'});speed=speedComparisons.length===1?speedComparisons[0]:speedComparisons.every(x=>x===speedComparisons[0])?speedComparisons[0]:'MIXED_INTERVAL_AVERAGES';}
  const finish=field(e.event_id,row.id,'finish'),finClock=field(e.event_id,row.id,'finish_ms'),terminal=field(e.event_id,row.id,'final600_ms');
  const winner=all.get(o.evidence.find(x=>x.pointer===row.margin.winner_pointer)?.evidence_id),winnerFinish=winner&&field(e.event_id,winner.subject_id,'finish');
  const margin=val(finish)!==null&&val(winnerFinish)===1?signedGap(val(winner),val(finClock)):null;
  const weight=field(e.event_id,row.id,'weight_grams'),nowW=field(targetId,row.id,'weight_grams');
  const d=conditionDelta(val(c)?.distance_m,val(target.conditions)?.distance_m);
  const conditionComparison=val(c)&&val(target.conditions)?{past:{venue:val(c).venue,going:val(c).going,class_label:val(c).class_label,surface:val(c).surface},current:{venue:val(target.conditions).venue,going:val(target.conditions).going,class_label:val(target.conditions).class_label,surface:val(target.conditions).surface},class_strength:null}:null;
  const gd=geom&&val(target.geometry)?{first_turn_m:val(target.geometry).first_turn_m-geom.first_turn_m,straight_m:val(target.geometry).straight_m-geom.straight_m,direction_same:val(target.geometry).direction===geom.direction}:null;
  const rankTrace=note(row.id,'RANK18',base?.pattern??'UNRESOLVED',[id(rank),id(count),id(g)],geom?[]:['GEOMETRY_MISSING']);
  const speedTrace=note(row.id,'RANK08',speed,intervals?[id(clock),id(g)]:[],['INTERVAL_AVERAGE_CANDIDATE_NOT_ENDURANCE_PROOF',...(intervals?[]:['INDIVIDUAL_INTERVAL_OR_LOCATION_MISSING'])]);
  note(row.id,'RANK21',base?.recovery?'ORDINAL_RECOVERY_ONLY':base?'NO_OBSERVED_ORDINAL_RECOVERY':'ORDINAL_UNKNOWN',[id(rank),id(count)],['CAUSE_AND_CURRENT_RELEVANCE_UNPROVEN']);
  note(row.id,'RANK44',d===null?'UNRESOLVED':d>0?'EXTENSION_CONTEXT':d<0?'SHORTENING_CONTEXT':'SAME_DISTANCE_CONTEXT',[id(c),id(target.conditions)],['CAUSAL_RESPONSE_UNPROVEN']);
  note(row.id,'RANK67',gd?gd.first_turn_m===0?'FIRST_TURN_SAME':'FIRST_TURN_CHANGED':'FIRST_TURN_UNKNOWN',[id(g),id(target.geometry)],['GEOMETRY_EFFECT_UNPROVEN']);
  note(row.id,'RANK50',gd?gd.straight_m===0?'STRAIGHT_SAME':'STRAIGHT_CHANGED':'STRAIGHT_UNKNOWN',[id(g),id(target.geometry)],['SUITABILITY_UNPROVEN']);
  note(row.id,'RANK49',gd?gd.direction_same?'DIRECTION_SAME':'DIRECTION_CHANGED':'DIRECTION_UNKNOWN',[id(g),id(target.geometry)],['SUITABILITY_UNPROVEN']);
  note(row.id,'RANK47',conditionComparison?conditionComparison.past.surface===conditionComparison.current.surface?'SURFACE_SAME':'SURFACE_CHANGED':'SURFACE_UNKNOWN',[id(c),id(target.conditions)],['SUITABILITY_UNPROVEN']);
  const marginTrace=note(row.id,'RANK03',margin===null?'MARGIN_UNAVAILABLE':'OBSERVED_TIME_MARGIN',margin===null?[]:[id(finClock),id(winner),id(winnerFinish),id(finish)]);
  const terminalTrace=note(row.id,'RANK06',val(terminal)===null?'TERMINAL_UNKNOWN':'TERMINAL_AVERAGE_ONLY',[id(terminal),id(c)]);
  const h={horse:row.id,event:e.event_id,rank:rg,positions,ordinal:base,speed,intervals,speedComparisons,finish:val(finish),clock:val(finClock),terminal_ms:val(terminal),margin_ms:margin,distance_delta_m:d,geometry_delta:gd,weight_delta_g:conditionDelta(val(weight),val(nowW)),conditionComparison,rankTrace,speedTrace,marginTrace,terminalTrace,acceleration:null,pressure_tolerance:null,causal_current_response:null};
  hist.push(h);byHist.set(key(e.event_id,row.id),h);
 }
 const relative=[];
 for(const e of history)for(const q of e.relative){
  const s=q.refs.map(k=>get(k)),a=byHist.get(key(e.event_id,q.a)),b=byHist.get(key(e.event_id,q.b));
  if(!a||!b||!s.every(x=>usable(x)))continue;
  const [x,y]=s.map(z=>z.value),gain=(y.positions_m[q.a]-x.positions_m[q.a])-(y.positions_m[q.b]-x.positions_m[q.b]),bound=4*r.measurement.snapshot_uncertainty_m;
  const state=gain>bound?'RELATIVE_COORDINATE_GAIN':gain< -bound?'RELATIVE_COORDINATE_LOSS':'UNCERTAINTY_OVERLAP';
  const refs=[...q.refs,id(field(e.event_id,q.a,'id')),id(field(e.event_id,q.b,'id')),id(field(e.event_id,q.a,'status')),id(field(e.event_id,q.b,'status'))];
  const t=note(q.a,'RANK18',state,refs);note(q.b,'RANK18',gain>bound?'RELATIVE_COORDINATE_LOSS':gain< -bound?'RELATIVE_COORDINATE_GAIN':'UNCERTAINTY_OVERLAP',refs);
  relative.push({event:e.event_id,a:q.a,b:q.b,gain,bound,state,refs:t.refs,actual_path_speed:null});
 }
 const direct=[],pairs=[];
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j],obs=[];
  if(a.identity_known&&b.identity_known&&a.status==='ACTIVE'&&b.status==='ACTIVE')for(const e of history){
   const x=byHist.get(key(e.event_id,a.slot)),y=byHist.get(key(e.event_id,b.slot));if(!x||!y||x.finish===null||y.finish===null)continue;
   const clockGap=signedGap(x.clock,y.clock),order=x.finish<y.finish?a.slot:b.slot;
   const refs=[id(field(e.event_id,a.slot,'finish')),id(field(e.event_id,b.slot,'finish')),id(field(e.event_id,a.slot,'finish_ms')),id(field(e.event_id,b.slot,'finish_ms')),id(field(targetId,a.slot,'status')),id(field(targetId,b.slot,'status')),...(x.positions&&y.positions?[...x.rankTrace.refs,...y.rankTrace.refs]:[])];
   const t=note(a.slot,'RANK35','DIRECT_HISTORICAL_ORDER_NOT_CURRENT_ORDER',refs);note(b.slot,'RANK35','DIRECT_HISTORICAL_ORDER_NOT_CURRENT_ORDER',refs);
   const q={a:a.slot,b:b.slot,event:e.event_id,order,clock_gap_b_minus_a:clockGap,first_ranks:x.positions&&y.positions?[x.positions[0].rank,y.positions[0].rank]:null,roots:t.roots,refs:t.refs};
   obs.push(q);direct.push(q);
  }
  pairs.push({a:a.slot,b:b.slot,state:obs.length?'PAST_PAIR_OBSERVATION':'UNKNOWN_PAIR',observations:obs,competition:'CONDITIONAL_ONLY'});
 }
 // Indirect comparisons use shared opponent and distinct event, never transitive order.
 const indirect=[];
 for(const p of pairs)for(const x of hist.filter(z=>z.horse===p.a&&z.finish!==null))for(const y of hist.filter(z=>z.horse===p.b&&z.event!==x.event&&z.finish!==null)){
  if(!active.find(z=>z.slot===p.a)?.identity_known||!active.find(z=>z.slot===p.b)?.identity_known)continue;
  for(const k of hist.filter(z=>z.event===x.event&&z.horse!==p.a&&z.horse!==p.b&&z.finish!==null)){
   const l=byHist.get(key(y.event,k.horse));if(!l||l.finish===null)continue;
   const refs=[x,y,k,l].flatMap(z=>['finish','finish_ms','weight_grams'].map(k=>id(field(z.event,z.horse,k))).concat(['conditions','actual_starters'].map(k=>id(field(z.event,null,k)))));
   const t=note(p.a,'RANK36','COMMON_PEER_NONTRANSITIVE',refs);note(p.b,'RANK36','COMMON_PEER_NONTRANSITIVE',refs);
   indirect.push({a:p.a,b:p.b,peer:k.horse,events:[x.event,y.event],relative_finishes:[x.finish-k.finish,y.finish-l.finish],relative_clocks:[signedGap(x.clock,k.clock),signedGap(y.clock,l.clock)],contexts:[x.conditionComparison,y.conditionComparison],refs:t.refs,roots:t.roots,current_order:null});
  }
 }
 const followups=[],laterRoots=new Map();
 for(const z of o.followups){
  const e=history.find(q=>q.event_id===z.reference_event),l=history.find(q=>q.event_id===z.followup_event);
  need(e&&l&&e.event_at<l.event_at&&l.event_at<r.cutoff,'FOLLOWUP_CHRONOLOGY');
  const x=byHist.get(key(e.event_id,z.opponent)),y=byHist.get(key(l.event_id,z.opponent)),subject=byHist.get(key(e.event_id,z.subject));
  const f2=field(l.event_id,z.opponent,'finish');
  const held=!x||!y||!subject||!get(id(f2)),state=held?'HELD_DEPENDENCY':y.finish===null?'MISSING_RESULT':y.finish===1?'OBSERVED_WIN':'OBSERVED_NONWIN';
  const refs=held?[]:[id(field(e.event_id,z.subject,'id')),id(field(e.event_id,z.opponent,'finish')),id(f2),...['finish_ms','final600_ms','ranks','weight_grams'].map(k=>id(field(l.event_id,z.opponent,k))),id(l.conditions),id(l.actual_starters),...y.marginTrace.refs];
  const t=note(z.subject,'RANK37',state,refs,held?['DEPENDENCY_WITHHELD']:[]);
  const q={subject:z.subject,peer:z.opponent,reference:e.event_id,event:l.event_id,state,finish:held?null:y.finish,margin_ms:held?null:y.margin_ms,clock:held?null:y.clock,terminal_ms:held?null:y.terminal_ms,ranks:held?null:y.rank,weight:held?null:val(field(l.event_id,z.opponent,'weight_grams')),conditions:held?null:(val(l.conditions)?Object.fromEntries(Object.entries(val(l.conditions)).filter(([k])=>k!=='geometry')):null),actual_starters:held?null:val(l.actual_starters),root:held?null:f2.root,refs:t.refs,strength:null};
  followups.push(q);if(q.root){const group=laterRoots.get(q.root)??{peer:q.peer,event:q.event,state:q.state,margin_ms:q.margin_ms,links:[]};group.links.push([q.subject,q.reference]);laterRoots.set(q.root,group);}
 }
 const runners=current.map(h=>{
  if(h.status==='CANCELLED')return {...h,WIN:null,PLACE:null,grade:null};
  if(!h.identity_known||h.status!=='ACTIVE')return {...h,assessment:'UNKNOWN_CURRENT_IDENTITY_OR_STATUS',WIN:null,PLACE:null,grade:null};
  const own=h.identity_known&&h.status==='ACTIVE'?hist.filter(z=>z.horse===h.slot):[],rivals=active.filter(z=>z.slot!==h.slot).map(z=>z.slot),req=winPlaceRequirements(rivals,threshold),peer=followups.filter(z=>z.subject===h.slot&&h.identity_known);
  const ownPairs=direct.filter(z=>z.a===h.slot||z.b===h.slot),support=ownPairs.filter(z=>z.order===h.slot),counter=ownPairs.filter(z=>z.order!==h.slot),unknown=rivals.filter(k=>!ownPairs.some(z=>z.a===k||z.b===k));
  const recovery=own.filter(z=>z.ordinal?.recovery),eye=[];
  const addEye=(item,upstream,observations,missing)=>{eye.push({item,observations,current_relevance:null,upstream,canonical_return:false,state:observations.length?'RESEARCH_OBSERVED_REVIEW_ONLY':'HELD',missing});};
  addEye('EYE03',['RANK18','RANK21'],recovery.map(z=>({event:z.event,refs:z.rankTrace.refs})),['CURRENT_REPRODUCIBILITY_UNPROVEN']);
  addEye('EYE05',['RANK37'],peer.filter(z=>z.root).map(z=>({root:z.root,state:z.state,refs:z.refs})),['CURRENT_RELEVANCE_AND_PEER_STRENGTH_UNPROVEN']);
  for(const item of ['EYE04','EYE08','EYE13','EYE14','EYE15'])addEye(item,[],[],['CANONICAL_CONDITIONS_UNPROVEN']);
  // Evidence-bearing review feeds the same analysis trace; no canonical positive effect until current relevance established.
  const review=eye.filter(z=>z.observations.length).map(z=>({item:z.item,targets:z.upstream,refs:uniq(z.observations.flatMap(v=>v.refs)),mode:'REVIEW_NOT_CANONICAL_POSITIVE'}));
  for(const q of review)for(const item of q.targets)note(h.slot,item,'EYE_REVIEW_RECONSIDER_OBSERVED_FACTS',q.refs,['CURRENT_RELEVANCE_UNPROVEN']);
  const early=own.filter(z=>z.positions?.[0]?.rank===1),others=active.filter(z=>z.slot!==h.slot),unknownRole=others.filter(z=>!z.identity_known||!hist.some(v=>v.horse===z.slot&&v.positions)).map(z=>z.slot);
  const overlap=others.filter(z=>z.identity_known&&z.status==='ACTIVE'&&hist.some(v=>v.horse===z.slot&&v.positions?.[0]?.rank===1)).map(z=>z.slot);
  const branches=[{condition:'IF_HISTORICAL_FIRST_CHECKPOINT_LEADER_SEEKS_LEAD',participants:active.map(z=>z.slot),subject_has_observed_lead:early.length>0,other_observed_leaders:overlap,unknown_role:unknownRole,pressure:null},{condition:'IF_UNKNOWN_OR_OTHER_RIVAL_SEEKS_SAME_SLOT',participants:active.map(z=>z.slot),unknown_role:unknownRole,pressure:null}];
  const repeatPaths=own.filter(z=>z.finish!==null).map(z=>{
   const observed=rivals.flatMap(k=>{const q=active.find(x=>x.slot===k),h=byHist.get(key(z.event,k));return q?.identity_known&&q.status==='ACTIVE'&&h?.finish!==null&&h?.finish!==undefined?[h]:[]});
   const unobserved=rivals.filter(k=>!observed.some(h=>h.horse===k));
   const refs=[z,...observed].map(h=>id(field(h.event,h.horse,'finish'))).concat(active.map(q=>id(field(targetId,q.slot,'status'))));
   const rec=recovery.find(q=>q.event===z.event);if(rec)refs.push(...rec.rankTrace.refs);
   const e=repeatEnvelope(z.finish,observed,unobserved,threshold);const tr=note(h.slot,'RANK35','CONDITIONAL_REPEAT_ENVELOPE_NOT_FORECAST',refs,['CURRENT_ORDER_UNPROVEN']);
   return {event:z.event,...e,refs:tr.refs,reviewed_recovery:recovery.some(q=>q.event===z.event)?'OBSERVED_ORDINAL_RECOVERY_NOT_SPEED_OR_PRESSURE':null};
  });
  const commonMissing=['CURRENT_PACE','CURRENT_LOAD','CLASS_STRENGTH','CAUSAL_DISTANCE_RESPONSE',...(unknown.length?['UNKNOWN_RIVAL_COMPARISON']:[])];
  const finishObs=own.filter(z=>z.finish!==null).map(z=>({event:z.event,finish:z.finish,field_count:z.positions?.[0]?.field_count??null,refs:lineage([id(field(z.event,h.slot,'finish')),id(field(z.event,null,'actual_starters'))]).map(id)}));
  return {...h,assessment:own.length?'PARTIAL_HISTORICAL_OBSERVATIONS':'UNKNOWN_ABILITY',historical:own,branches,eye,review,repeat_paths:repeatPaths,WIN:{...req.WIN,state:'UNRESOLVED',past_wins:finishObs.filter(z=>z.finish===1),conditional_repeat_support:support,conditional_win_paths:repeatPaths.map(q=>({event:q.event,...q.win,reviewed_recovery:q.reviewed_recovery,refs:q.refs})),required_reversals:counter,unknown_rivals:unknown,missing:commonMissing},PLACE:{...req.PLACE,state:'UNRESOLVED',historical_finishes:finishObs,conditional_pair_support:support,hypothetical_place_paths:threshold===null?[]:repeatPaths.map(q=>({event:q.event,...q.place,reviewed_recovery:q.reviewed_recovery,refs:q.refs})),nonterminal_pair_losses:counter,unknown_rivals:unknown,missing:[...commonMissing,'PLACE_THRESHOLD']},peer_roots:uniq(peer.map(z=>z.root).filter(Boolean)),grade:null};
 });
 return {case:name,scope:r.scope,roster,historical:hist,relative,direct,indirect,pairs,followups,later_roots:[...laterRoots.values()],runners,trace,withdrawal:withdraw?{id:withdraw,scope:'SYNTHETIC_WITHHOLD_ONLY',authenticated:false}:null,formal:false,grade:null};
}
