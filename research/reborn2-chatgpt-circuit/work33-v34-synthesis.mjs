// V34 synthetic-only unified current-context synthesis. No production grade, points or market inputs.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadControlledWork33,analyzeControlledWork33,enrich} from './work32-v33-current.mjs';
import {analyzeV31,jointClockFeasibility} from './work30-v31-integrated.mjs';
import {jointField} from './work29-v30-terminal.mjs';
import {dependencyReader,uniq} from './research-ability-core.mjs';
import {stressScenario,reviewGradeBoundary} from '../reborn2-v34-codex-pinned/engine.mjs';
import {synthesize} from '../reborn2-v34-codex-pinned/synthesis.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const read=n=>readFileSync(new URL('./work33-pinned/'+n,import.meta.url));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const handoff=JSON.parse(read('stage33-final-handoff-v0.2.json'));
function pin(x){const b=read(x.path.split('/').at(-1));assert.equal(blob(b),x.blob);assert.equal(sha(b),x.sha256);if(x.bytes)assert.equal(b.length,x.bytes);return b;}
export async function loadV34(){
 assert.equal(blob(read('stage33-final-handoff-v0.2.json')),'acc306c297d519c95b8a967a5d9a687c01894636');
 for(const [n,b] of [['engine.mjs','6fcfe19dbdbb052b87b73186d6c2a0df44460939'],['synthesis.mjs','fa23a3c606ce636f1663a499d76dcbe339bffcc5']])assert.equal(blob(readFileSync(new URL('../reborn2-v34-codex-pinned/'+n,import.meta.url))),b);
 pin(handoff.research_code);pin(handoff.execution_summary);
 const C=await loadControlledWork33(),fixed=new Map();
 for(const x of handoff.case_index){const raw=JSON.parse(pin(x));assert.equal(raw.id,x.id);assert.equal(raw.source_digest,x.source_digest);assert.equal(raw.bundle_sha256,x.bundle_sha256);assert.deepEqual(raw.raw,C.fixtures.find(f=>f.id===x.id).docs);fixed.set(x.id,{raw,pin:x});}
 return {C,fixed};
}
function prepare(V,id,withdraw,threshold){
 const f=V.fixed.get(id);assert.ok(f);
 const base=analyzeControlledWork33(V.C,id,{withdraw,placeThreshold:threshold,eyeEnabled:false,includePack:true});
 const after=enrich(base.loaded,id,withdraw,{placeThreshold:threshold,eyeEnabled:true});
 const {source_envelope:env}=base;
 assert.equal(env.digest,f.pin.source_digest,'INDEPENDENT_PACKET_PIN');
 assert.equal(base.source_bundle_sha256,f.pin.bundle_sha256,'INDEPENDENT_BUNDLE_PIN');
 // Bundle generation is verified against the independently recorded Work33 digest by reusing the exact producer.
 return {base,after,L:base.loaded,f};
}
// A full-field shared scenario is constructed from observed historical response, never projected as a current measured result.
function assessShared(L,id,base,after,withdraw,threshold,eyeEnabled,localize=false){
 const p=L.cases.get(id),raw=analyzeV31(L,id,withdraw,{placeThreshold:threshold}),[target,...history]=p.o.events,roster=raw.roster.possible_active;
 const all=new Map(p.o.evidence.map(e=>[e.evidence_id,e])),field=(ev,h,k)=>p.o.evidence.find(e=>e.event_id===ev&&e.subject_id===h&&e.field===k);
 const {get,lineage}=dependencyReader(all,withdraw,e=>e.subject_id===null||e.field==='id'?[]:[field(e.event_id,e.subject_id,'id')?.evidence_id,...(e.field==='status'?[]:[field(e.event_id,e.subject_id,'status')?.evidence_id])].filter(Boolean));
 const val=e=>e&&get(e.evidence_id)&&e.state==='SYNTHETIC_OBSERVATION'?e.value:null,refs=xs=>lineage(xs.filter(Boolean).map(x=>typeof x==='string'?x:x.evidence_id)).map(x=>x.evidence_id);
 const fullRoster=roster.length===raw.roster.known_active.length;
 // Incomplete official classification is not permission to create a finish rank.
 // Original verified literal individual ranks remain separately traceable.
 const literalFinish=(ev,h)=>p.o.evidence.find(e=>e.event_id===ev&&e.typed_source?.field==='finish'&&ev.startsWith(h.split('|')[0]+'|')&&e.typed_source?.subject===h.split('|').at(-1));
 const pairs=roster.flatMap((a,i)=>roster.slice(i+1).map(b=>({a,b})));
 const byEvent=history.map(e=>{
  const ev=e.event_id,ctx=base.contexts.find(x=>x.event===ev),g=val(e.geometry),tc=val(target.conditions),pc=val(e.conditions),u=p.r.measurement.clock_uncertainty_ms;
  // Historical classification integrity is independent of target participation.
   const historicalRoster=e.rows.map(r=>r.id);
   const historicalField=Number.isSafeInteger(val(e.actual_starters))&&val(e.actual_starters)===historicalRoster.length&&new Set(historicalRoster).size===historicalRoster.length&&historicalRoster.every(h=>val(field(ev,h,'id'))===h&&val(field(ev,h,'status'))==='FINISHED');
   const knownField=historicalField&&fullRoster&&historicalRoster.length===roster.length&&historicalRoster.every(h=>roster.includes(h));
   const historicalRefs=refs([e.actual_starters,e.geometry,e.conditions,...historicalRoster.flatMap(h=>[field(ev,h,'id'),field(ev,h,'status')])]);
  const comparison=base.pairResponse.flatMap(x=>x.comparisons.filter(c=>c.event===ev));
  const gateWeight=roster.every(h=>['gate_number','weight_grams'].every(k=>{const a=val(field(ev,h,k)),b=val(field(target.event_id,h,k));return a!==null&&b!==null&&a===b;}));
  const contextMatched=ctx?.state==='SAME_REPORTED_RACE_CONTEXT'&&gateWeight;
  const roleEvidence=roster.map(h=>{const r=field(ev,h,'ranks'),cp=field(ev,h,'checkpoint_ms'),rr=val(r),cc=val(cp);return {horse:h,ranks:rr,checkpoints:cc,refs:rr&&cc?refs([r,cp]):[]};});
  const leader=field(ev,null,'leader_crossings'),lc=val(leader),pace=base.cross_measurement_review.find(x=>x.event===ev),sharedPaceConflict=pace?.state==='CONFLICT_HOLD_JOINED_PACE_INFERENCE',paceUsable=!!lc&&!sharedPaceConflict&&roleEvidence.every(r=>Array.isArray(r.ranks)&&Array.isArray(r.checkpoints));
  return {ev,ctx,g,tc,pc,u,knownField,historicalField,historicalRoster,historicalRefs,contextMatched,gateWeight,roleEvidence,paceUsable,sharedPaceConflict,leader:lc,leaderRefs:lc?refs([leader]):[],comparison,refs:refs([e.conditions,target.conditions,e.geometry,target.geometry,e.actual_starters,...roster.flatMap(h=>['id','status','gate_number','weight_grams'].flatMap(k=>[field(ev,h,k),field(target.event_id,h,k)]))])};
 });
 // Every historically observed field trajectory is an alternative, not a predicted starting queue.
 // Explicit current conditions, exact field identity, and comparable role/pace observations are required for a supported research path.
 const scenarios=byEvent.flatMap(x=>(x.g?.checkpoints_m??[null]).map((checkpoint,j)=>{
  const starts=Object.fromEntries(x.roleEvidence.filter(r=>Number.isFinite(r.checkpoints?.[j])).map(r=>[r.horse,[r.checkpoints[j]-x.u,r.checkpoints[j]+x.u]]));
  let rankClockConflict=false;
  const edges=pairs.map(({a,b})=>{
   const pa=field(x.ev,a,'checkpoint_ms'),pb=field(x.ev,b,'checkpoint_ms'),fa=field(x.ev,a,'finish_ms'),fb=field(x.ev,b,'finish_ms'),av=val(pa),bv=val(pb),af=val(fa),bf=val(fb);
   let d=base.pairResponse.find(k=>k.a===a&&k.b===b)?.comparisons.find(k=>k.event===x.ev);
   if(localize&&!d&&x.historicalField&&x.historicalRoster.includes(a)&&x.historicalRoster.includes(b)){
    const ra=literalFinish(x.ev,a),rb=literalFinish(x.ev,b),ar=val(ra),br=val(rb);
    const supplied=x.historicalRoster.map(h=>val(literalFinish(x.ev,h))).filter(Number.isInteger);
    // Do not use incomplete or inconsistent literal ranks as a complete official classification.
    // Independently supplied unique ranks can corroborate only this pair's clock order.
    if(Number.isInteger(ar)&&Number.isInteger(br)&&ar!==br&&new Set(supplied).size===supplied.length&&supplied.length<x.historicalRoster.length){
     const roots=refs([ra,rb,field(x.ev,a,'id'),field(x.ev,b,'id'),field(x.ev,a,'status'),field(x.ev,b,'status'),...x.historicalRefs]);
     d={order:ar<br?'AHEAD':'BEHIND',rank_refs:roots,refs:roots,pair_context:'PARTIAL_LITERAL_RANK_CLOCK_ONLY'};
    }
   }
   if(!x.historicalField||!d||!Number.isFinite(av?.[j])||!Number.isFinite(bv?.[j])||!Number.isFinite(af)||!Number.isFinite(bf)||!Number.isFinite(x.u))return {a,b,order:'UNKNOWN',refs:[],interval_ms:null};
   const change=(bf-af)-(bv[j]-av[j]);
    // Historical observations must not depend on the target card. Keep
    // transfer assumptions separately, and do not interpret this bound as a prediction.
    const roots=refs([pa,pb,fa,fb,...d.rank_refs.filter(id=>all.get(id)?.event_id===x.ev),...x.historicalRefs]);
    const transferRefs=refs([...d.refs,...x.refs]);
   const z=stressScenario({path:{relations:[{rival:b,net_change_ms:change,change_bound_ms:4*x.u,refs:roots}]},subject:a,rivals:[b],starts,threshold:null}).relations[0];
   // Preserve literal rank and numeric evidence separately. An incompatible numeric edge is withheld.
   if(z.order!=='UNKNOWN'&&z.order!==d.order)rankClockConflict=true;
   return {a,b,order:z.order!=='UNKNOWN'&&z.order!==d.order?'UNKNOWN':z.order,refs:roots,historical_refs:roots,transfer_refs:transferRefs,interval_ms:z.interval_ms,observed_order:d.order,change_ms:change,checkpoint_m:checkpoint,...(localize?{pair_context:d.pair_context}:{})};
  });
  const numeric=jointClockFeasibility(roster,edges.filter(e=>e.interval_ms).map(e=>({a:e.a,b:e.b,delta:(e.interval_ms[0]+e.interval_ms[1])/2,bound:(e.interval_ms[1]-e.interval_ms[0])/2,refs:e.refs})));
  const f=jointField(roster,edges,threshold),valid=f.state!=='CONTRADICTED_SHARED_ORDER'&&numeric.state!=='CONTRADICTED_NUMERIC_DIFFERENCES'&&(!localize||(!rankClockConflict&&!x.sharedPaceConflict));
  return {id:x.ev+'@'+checkpoint,event:x.ev,kind:'OBSERVED_FIELD_RESPONSE_SCENARIO',checkpoint_m:checkpoint,starts,edges,field:f,numeric,valid,contextMatched:x.contextMatched,knownField:x.knownField,historicalField:x.historicalField,currentRosterCertain:fullRoster,paceUsable:x.paceUsable,leader:x.leader,roleEvidence:x.roleEvidence,refs:uniq([...x.refs,...x.leaderRefs,...edges.flatMap(e=>e.refs),...x.roleEvidence.flatMap(r=>r.refs)]),applicability:x.contextMatched&&x.knownField&&x.paceUsable&&valid?'COMPARABLE_SYNTHETIC_RESPONSE':localize&&x.historicalField&&valid&&edges.some(e=>e.interval_ms)?'LOCAL_OBSERVED_RESPONSE_ONLY':'CONDITIONAL_OR_HELD',prediction:false,actual_current_feasibility:'UNRESOLVED'};
 }));
 // EYE discovery returns an earlier, explicitly bounded checkpoint response to the same shared scenario analyzer.
 // Baseline and addition run the real common analyzer, preserve baseline paths, and add only verified discovery predicates.
 const feedback=[];
 if(eyeEnabled)for(const e of after.eyeReturns){
  const supporting=e.observation.events,matching=byEvent.filter(x=>supporting.includes(x.ev));
  if(matching.length!==supporting.length||matching.some(x=>!x.contextMatched||!x.knownField||!x.paceUsable))continue;
  const distance=e.observation.checkpoint_m,subject=e.subject,rival=e.rival,baselineScenario=scenarios.find(x=>x.event===supporting[0]&&x.checkpoint_m===distance);
  if(!baselineScenario||!baselineScenario.valid)continue;
  // Re-evaluate all rivals at the discovery checkpoint using the same Codex stress function and the actual reference trajectory.
  const ref=matching[0],j=ref.g.checkpoints_m.indexOf(distance);if(j<0)continue;
  const starts=Object.fromEntries(ref.roleEvidence.map(r=>[r.horse,[r.checkpoints[j]-ref.u,r.checkpoints[j]+ref.u]]));
  const relations=pairs.map(({a,b})=>{
   const rows=byEvent.filter(x=>x.contextMatched&&x.knownField&&x.paceUsable).flatMap(x=>{
    const k=x.g.checkpoints_m.indexOf(distance),pa=field(x.ev,a,'checkpoint_ms'),pb=field(x.ev,b,'checkpoint_ms'),fa=field(x.ev,a,'finish_ms'),fb=field(x.ev,b,'finish_ms'),av=val(pa),bv=val(pb),af=val(fa),bf=val(fb);
    if(k<0||![av?.[k],bv?.[k],af,bf].every(Number.isFinite))return [];
    const gain=(bf-af)-(bv[k]-av[k]),bound=4*x.u,roots=refs([pa,pb,fa,fb,...x.refs]);
    return [{event:x.ev,gain,bound,refs:roots}];
   });
   if(!rows.length||!starts[a]||!starts[b])return {a,b,order:'UNKNOWN',interval_ms:null,refs:[],observations:rows};
   // Retain all comparable responses, including adverse runs, in the interval. Never cherry-pick EYE positives.
   const lower=Math.min(...rows.map(r=>r.gain-r.bound)),upper=Math.max(...rows.map(r=>r.gain+r.bound)),roots=uniq(rows.flatMap(r=>r.refs));
   const z=stressScenario({path:{relations:[{rival:b,net_change_ms:(lower+upper)/2,change_bound_ms:(upper-lower)/2,refs:roots}]},subject:a,rivals:[b],starts,threshold:null}).relations[0];
   return {a,b,order:z.order,interval_ms:z.interval_ms,refs:roots,observations:rows};
  });
  const fieldResult=jointField(roster,relations,threshold),numeric=jointClockFeasibility(roster,relations.filter(r=>r.interval_ms).map(r=>({a:r.a,b:r.b,delta:(r.interval_ms[0]+r.interval_ms[1])/2,bound:(r.interval_ms[1]-r.interval_ms[0])/2,refs:r.refs})));
  if(fieldResult.state==='CONTRADICTED_SHARED_ORDER'||numeric.state==='CONTRADICTED_NUMERIC_DIFFERENCES')continue;
  const b=baselineScenario.field.envelopes.find(h=>h.slot===subject),a=fieldResult.envelopes.find(h=>h.slot===subject),pair=relations.find(r=>[r.a,r.b].includes(subject)&&[r.a,r.b].includes(rival)),order=pair?.a===subject?pair.order:pair?.order==='AHEAD'?'BEHIND':pair?.order==='BEHIND'?'AHEAD':'UNKNOWN';
  const state=order==='AHEAD'?'CONDITIONAL_RECOVERY_SUPPORTED_AFTER_COUNTER_REVIEW':order==='BEHIND'?'RECOVERY_ROUTE_COUNTERED':'RECOVERY_ROUTE_UNRESOLVED_AFTER_COUNTER_REVIEW';
  const roots=uniq([...e.refs,...(e.counter_refs??[]),...relations.flatMap(r=>r.refs)]);
  feedback.push({id:e.id,subject,rival,checkpoint_m:distance,before:{event:baselineScenario.id,checkpoint_m:baselineScenario.checkpoint_m,envelope:b,edges:baselineScenario.edges},after:{envelope:a,edges:relations,numeric},state,refs:roots,counter_refs:e.counter_refs??[],changed:!eq(b,a)||!eq(baselineScenario.edges.map(r=>r.interval_ms),relations.map(r=>r.interval_ms)),order_changed:!eq(b,a),same_checkpoint:true,independent_vote:false,formal:false});
  scenarios.push({id:e.id,kind:'EYE03_RECOMPUTED_SHARED_SCENARIO',checkpoint_m:distance,starts,edges:relations,field:fieldResult,numeric,valid:true,contextMatched:true,knownField:true,paceUsable:true,refs:roots,applicability:'CONDITIONAL_DISCOVERY_RESPONSE_NOT_CURRENT_POSITION',prediction:false,actual_current_feasibility:'UNRESOLVED'});
 }
 return {scenarios,feedback,raw};
}
// Research boundary based on explicit comparable field paths, not the number of supportive axes.
// The exact PR95 boundary probe is retained as diagnostic; its all-axis rule is NOT promoted to policy.
function summarizeHorse(h,common,legacy,shared,threshold){
 const {scenarios,feedback}=shared,active=h.status==='ACTIVE'&&h.identity_known;
 const comparable=scenarios.filter(s=>s.kind==='OBSERVED_FIELD_RESPONSE_SCENARIO'&&s.applicability==='COMPARABLE_SYNTHETIC_RESPONSE');
 const paths=comparable.filter(s=>s.checkpoint_m===Math.max(...comparable.filter(t=>t.event===s.event).map(t=>t.checkpoint_m))).map(s=>({event:s.event,envelope:s.field.envelopes.find(x=>x.slot===h.slot),refs:s.refs,role:s.roleEvidence.find(r=>r.horse===h.slot),scope:'HISTORICAL_RESPONSE_TRANSFER_HYPOTHESIS'})).filter(x=>x.envelope);
 const positives=paths.filter(x=>x.envelope.max===1),places=paths.filter(x=>threshold!==null&&x.envelope.max<=threshold),negative=paths.filter(x=>x.envelope.min>1),badPlace=paths.filter(x=>threshold!==null&&x.envelope.min>threshold);
 const relevantFeedback=feedback.filter(e=>e.subject===h.slot);
 const possibleUnknown=common.roster.possible_active.some(x=>!common.roster.known_active.includes(x));
 const relevant=active&&!possibleUnknown&&paths.length>0;
 const missingComparable=scenarios.some(s=>s.kind==='OBSERVED_FIELD_RESPONSE_SCENARIO'&&s.contextMatched&&(!s.knownField||!s.paceUsable||!s.valid));
 const gradeEvidence=uniq(paths.flatMap(x=>x.refs)),repeat=new Set(positives.map(x=>x.event)).size>1;
 // No S from this fixture alone: current state and scenario coverage are unmeasured.
 // A/B/C are provisional research candidates for this stipulated comparable synthetic context, not official grades.
 let candidate=null,reason='CURRENT_COMPARABLE_EVIDENCE_INSUFFICIENT';
 if(relevant&&positives.length){candidate='A';reason=repeat?'REPEATED_COMPARABLE_WIN_ROUTE_CURRENT_PACE_UNMEASURED':'OBSERVED_COMPARABLE_WIN_ROUTE_WITH_TRANSFER_LIMITS';}
 else if(relevant&&places.length){candidate='B';reason='CONCRETE_COMPARABLE_PLACE_ROUTE_LIMITED_WIN_EVIDENCE';}
 else if(relevant&&!missingComparable&&threshold!==null&&badPlace.length&&badPlace.length===paths.length&&paths.every(x=>x.envelope.min===x.envelope.max)){candidate='C';reason='ALL_OBSERVED_COMPARABLE_FIELD_ROUTES_SHOW_RELATIVE_DISADVANTAGE';}
 const dirs={A:positives.length||places.length?'SUPPORT':badPlace.length?'COUNTER':'UNKNOWN',B:relevant?'SUPPORT':'UNKNOWN',C:positives.length||places.length?'SUPPORT':badPlace.length?'COUNTER':'UNKNOWN',D:paths.length?(negative.length&&positives.length?'MIXED':positives.length||places.length?'SUPPORT':badPlace.length?'COUNTER':'UNKNOWN'):'UNKNOWN',E:(negative.length||relevantFeedback.some(f=>f.counter_refs.length||f.state==='RECOVERY_ROUTE_COUNTERED'))?(positives.length||places.length||relevantFeedback.some(f=>f.state==='CONDITIONAL_RECOVERY_SUPPORTED_AFTER_COUNTER_REVIEW')?'MIXED':'COUNTER'):relevantFeedback.some(f=>f.state==='CONDITIONAL_RECOVERY_SUPPORTED_AFTER_COUNTER_REVIEW')?'SUPPORT':'UNKNOWN'};
 const axes=h.axes.map(a=>{const support=active?positives.concat(places.filter(x=>!positives.includes(x))):[],counter=active?negative:[],f=a.axis==='E'||a.axis==='D'?relevantFeedback:[];return {...a,legacy_facts:legacy?.axes?.find(x=>x.axis===a.axis)?.facts??[],state:!active?'UNKNOWN':dirs[a.axis],current_support:[],current_counter:[],research_support:dirs[a.axis]==='SUPPORT'||dirs[a.axis]==='MIXED'?support:[],research_counter:dirs[a.axis]==='COUNTER'||dirs[a.axis]==='MIXED'?counter:[],discovery_feedback:f,scope:'SYNTHETIC_COMPARABLE_PATH_NOT_OBSERVED_CURRENT_CAPABILITY'};});
 const boundary=reviewGradeBoundary({axes:axes.map(a=>({axis:a.axis,current_relevance_reviewed:false,direction:'NEUTRAL',evidence_ids:gradeEvidence})),claim:'WIN_PATH'});
 const used=new Set([...gradeEvidence,...relevantFeedback.flatMap(x=>x.refs)]),audit=h.items.map(i=>{const rerun=['RANK18','RANK21','RANK100'].includes(i.item)?relevantFeedback.map(f=>({state:f.state,checkpoint_m:f.checkpoint_m,before:f.before.envelope,after:f.after.envelope,refs:f.refs,order_changed:f.order_changed})):[];return {...i,v34_reanalysis:rerun,decision_refs:i.refs.filter(r=>used.has(r)),decision_effect:rerun.length?'SHARED_SCENARIO_RECOMPUTED_CONDITIONAL_ONLY':i.refs.some(r=>used.has(r))?'REFERENCED_BY_RESEARCH_PATH_NOT_ISOLATED_EFFECT':'NO_PROVEN_DECISION_EFFECT',grade_effect_proven:false};});
 return {...h,axes,items:audit,WIN:{...h.WIN,comparable_paths:positives,counter_paths:negative,discovery_paths:relevantFeedback.map(f=>({id:f.id,state:f.state,envelope:f.after.envelope,refs:f.refs})),overall:'UNRESOLVED'},PLACE:{...h.PLACE,comparable_paths:places,counter_paths:badPlace,discovery_paths:relevantFeedback.map(f=>({id:f.id,state:f.state,envelope:f.after.envelope,refs:f.refs})),overall:'UNRESOLVED'},eye_reanalysis:relevantFeedback,research_grade:candidate,research_reason:reason,grade:null,formal:false,decision_refs:gradeEvidence,pr95_boundary_probe:boundary,material_unknowns:['CURRENT_PACE_AND_ROLE','CURRENT_FORM_AND_FULL_SCENARIO_COVERAGE',...(possibleUnknown?['UNKNOWN_RIVAL']:[])]};
}
export function analyzeV34(V,id,{withdraw=null,placeThreshold=2,eyeEnabled=true,localize=false}={}){
 const {base,after,L,f}=prepare(V,id,withdraw,placeThreshold);
 // Exact PR95 five-axis synthesis consumes the same verified common input; no independent fixture or market data.
 L.diagnostics={groups:118,held:826};
 const legacy=synthesize({loaded:L,fixture:id,withdraw,placeThreshold});
 const shared=assessShared(L,id,base,after,withdraw,placeThreshold,eyeEnabled,localize),common=eyeEnabled?after:base;
 const runners=common.runners.map(h=>summarizeHorse(h,common,legacy.runners.find(x=>x.slot===h.slot),shared,placeThreshold));
 return {schema:'REBORN2_V34_RESEARCH_SYNTHESIS',id,source_digest:base.source_digest,source_packet:base.source_packet,...(base.admissionTrace?{admissionTrace:base.admissionTrace}:{}),roster:common.roster,baseline:base.runners.map(h=>({slot:h.slot,WIN:h.WIN,PLACE:h.PLACE,items:h.items,axes:h.axes})),scenarios:shared.scenarios,feedback:shared.feedback,runners,groups:118,held:826,formal:false,grade:null,policy:'PROVISIONAL_RESEARCH_CANDIDATE_NOT_FORMAL_SABC',source_pin:f.pin.blob};
}



// V35 step 1: independent hypothetical starts, on the SAME verified shared circuit.
// A branch is a stress antecedent, never an observation or a forecast. An event's
// complete response is kept together, rather than cherry-picking each rival.
export function analyzeV35(V,id,{withdraw=null,placeThreshold=2,eyeEnabled=true,branches=[],localize=false}={}){
 const common=analyzeV34(V,id,{withdraw,placeThreshold,eyeEnabled,localize}),roster=common.roster.possible_active;
 const observations=common.scenarios.filter(s=>s.kind==='OBSERVED_FIELD_RESPONSE_SCENARIO');
 const {base,L}=prepare(V,id,withdraw,placeThreshold);
 const p=L.cases.get(id),u=p.r.measurement.clock_uncertainty_ms;
 const pairs=roster.flatMap((a,i)=>roster.slice(i+1).map(b=>({a,b})));
 const active=new Set(common.roster.known_active);
 const branchesSeen=new Set();
 const scenarios=branches.map(b=>{
  assert.ok(typeof b.id==='string'&&b.id&&!branchesSeen.has(b.id),'BRANCH_ID');branchesSeen.add(b.id);
  assert.ok(b.starts&&Object.keys(b.starts).every(h=>roster.includes(h)),'BRANCH_ROSTER');
  for(const v of Object.values(b.starts))assert.ok(Array.isArray(v)&&v.length===2&&v.every(t=>Number.isFinite(t)&&t>=0)&&v[0]<=v[1],'BRANCH_START');
  assert.ok(Number.isFinite(b.checkpoint_m),'BRANCH_CHECKPOINT');
  // The source event identifies a response alternative, not an observed current role.
  const s=observations.find(x=>x.event===b.response_event&&x.checkpoint_m===b.checkpoint_m);
  const comparable=!!s&&s.applicability==='COMPARABLE_SYNTHETIC_RESPONSE';
  const partial=localize&&s?.applicability==='LOCAL_OBSERVED_RESPONSE_ONLY';
  const edges=pairs.map(({a,b:other})=>{
   const e=s?.edges.find(x=>x.a===a&&x.b===other);
   const oldOrder=e?.interval_ms?.[0]>0?'AHEAD':e?.interval_ms?.[1]<0?'BEHIND':'UNKNOWN';
   const consistent=oldOrder==='UNKNOWN'||oldOrder===e?.observed_order;
   const usable=(comparable||partial)&&active.has(a)&&active.has(other)&&consistent&&Number.isFinite(e?.change_ms)&&Number.isFinite(u)&&u>=0&&e.refs.length;
   const z=stressScenario({path:usable?{relations:[{rival:other,net_change_ms:e.change_ms,change_bound_ms:4*u,refs:e.refs}]}:null,subject:a,rivals:[other],starts:b.starts,threshold:null}).relations[0];
   return {a,b:other,order:z.order,interval_ms:z.interval_ms,refs:z.refs,change_ms:usable?e.change_ms:null,change_bound_ms:usable?4*u:null};
  });
  const numeric=jointClockFeasibility(roster,edges.filter(e=>e.interval_ms).map(e=>({a:e.a,b:e.b,delta:(e.interval_ms[0]+e.interval_ms[1])/2,bound:(e.interval_ms[1]-e.interval_ms[0])/2,refs:e.refs})));
  const field=jointField(roster,edges,placeThreshold),valid=field.state!=='CONTRADICTED_SHARED_ORDER'&&numeric.state!=='CONTRADICTED_NUMERIC_DIFFERENCES'&&(!localize||s?.valid===true);
  // Check whether the declared start order is consistent with the historical role.
  // Matching role order is evidence of a comparable alternative, NOT today's actual pace.
  // Source checkpoint ranks come from verified V34 roleEvidence; use source starts for ordering only.
  const roleConflicts=pairs.filter(({a,b:other})=>{
   const a0=b.starts[a],b0=b.starts[other],pa=s?.starts?.[a],pb=s?.starts?.[other];
   if(!a0||!b0||!pa||!pb)return false;
   return (a0[1]<b0[0]&&pa[0]>pb[1])||(b0[1]<a0[0]&&pb[0]>pa[1]);
  });
  const complete=roster.every(h=>b.starts[h])&&edges.every(e=>e.interval_ms);
  return {id:b.id,checkpoint_m:b.checkpoint_m,response_event:b.response_event,starts:b.starts,
   antecedent:'EXPLICIT_SYNTHETIC_START_ASSUMPTION',observed_current_pace:false,prediction:false,
   comparable,...(localize?{partial}:{}),roleConflicts,complete,valid,edges,field,numeric,
   condition_refs:comparable?base.contexts.find(c=>c.event===s.event)?.refs??[]:[],
   historical_role_refs:comparable?uniq(s.roleEvidence.flatMap(r=>r.refs)):[],
   actual_current_applicability:'UNPROVEN'};
 });
 const runners=common.runners.map(h=>{
  const paths=scenarios.map(s=>{
   const e=s.field.envelopes.find(x=>x.slot===h.slot);
   const historical=observations.find(o=>o.event===s.response_event&&o.checkpoint_m===s.checkpoint_m);
   const past=historical?.field.envelopes.find(x=>x.slot===h.slot);
   const involved=s.edges.filter(x=>x.a===h.slot||x.b===h.slot);
   const roots=uniq(involved.flatMap(x=>x.refs));
   const oriented=involved.map(x=>({rival:x.a===h.slot?x.b:x.a,gain:x.change_ms===null?null:x.a===h.slot?x.change_ms:-x.change_ms,bound:x.change_bound_ms,refs:x.refs}));
   const recovery=oriented.filter(x=>x.gain!==null&&x.gain>x.bound&&s.starts[h.slot]?.[0]>s.starts[x.rival]?.[1]);
   const losses=oriented.filter(x=>x.gain!==null&&x.gain< -x.bound);
   const eye=common.feedback.filter(f=>f.subject===h.slot&&f.checkpoint_m===s.checkpoint_m);
   const eyeCounters=eye.filter(f=>f.counter_refs.length||f.state==='RECOVERY_ROUTE_COUNTERED');
   const axes=[
    {axis:'A',state:past?.max<=placeThreshold?'SUPPORT':past?.min>placeThreshold?'COUNTER':'UNKNOWN',refs:historical?.edges.filter(x=>x.a===h.slot||x.b===h.slot).flatMap(x=>x.refs)??[],fact:{observed_historical_envelope:past??null}},
    {axis:'B',state:s.comparable&&s.complete&&!s.roleConflicts.length?'CONDITIONAL_SUPPORT':'UNKNOWN',refs:uniq([...s.condition_refs,...s.historical_role_refs]),fact:{context_match:s.comparable,role_conflicts:s.roleConflicts,actual_current:'UNPROVEN'}},
    {axis:'C',state:!e||!s.valid?'UNKNOWN':e.max<=placeThreshold?'CONDITIONAL_SUPPORT':e.min>placeThreshold?'COUNTER':'UNKNOWN',refs:roots,fact:{conditional_field_envelope:e??null}},
    {axis:'D',state:recovery.length&&losses.length?'MIXED':recovery.length?'CONDITIONAL_RECOVERY':losses.length?'ROUTE_COUNTER':oriented.every(x=>x.gain!==null)&&oriented.length?'MEASURED_RESPONSE':'UNKNOWN',refs:uniq(oriented.flatMap(x=>x.refs)),fact:{recovery,losses,relative_changes:oriented}},
    {axis:'E',state:eyeCounters.length?'COUNTER_REVIEW_REQUIRED':eye.length?'DISCOVERY_REVIEW_UNRESOLVED':'UNKNOWN',refs:uniq(eye.flatMap(x=>[...x.refs,...x.counter_refs])),fact:{feedback:eye.map(x=>({id:x.id,state:x.state,counter_refs:x.counter_refs}))}}
   ];
   const [a,b,c,d,f]=axes;
   // This conservative bridge makes five assessments causal inputs to a
   // conditional route candidate. It is not a calibrated or canonical SABC rule.
   // Unknown E is not itself a negative; an unresolved material EYE review holds.
   const blocked=[];
   if(!active.has(h.slot)||!s.valid||!e)blocked.push('INVALID_OR_UNKNOWN_RUNNER');
   if(a.state!=='SUPPORT')blocked.push('HISTORICAL_ABILITY_NOT_SUPPORTED_FOR_THIS_ROUTE');
   if(b.state!=='CONDITIONAL_SUPPORT')blocked.push('TRANSFER_ANTECEDENT_NOT_SUPPORTED');
   if(c.state!=='CONDITIONAL_SUPPORT')blocked.push('COMPARATIVE_ROUTE_NOT_SUPPORTED');
   if(d.state==='UNKNOWN')blocked.push('RESPONSE_NOT_MEASURED');
   if(f.state==='COUNTER_REVIEW_REQUIRED')blocked.push('UNRESOLVED_DISCOVERY_COUNTER');
   if(f.state==='DISCOVERY_REVIEW_UNRESOLVED')blocked.push('UNRESOLVED_DISCOVERY_APPLICABILITY');
   const win=!blocked.length&&e.max===1,place=!blocked.length&&e.max<=placeThreshold;
   return {scenario:s.id,axes,envelope:e??null,blocked,WIN:win?'CONDITIONALLY_SUPPORTED':'UNRESOLVED',PLACE:place?'CONDITIONALLY_SUPPORTED':'UNRESOLVED',candidate:win?'A':place?'B':null,scope:'RESEARCH_ANTECEDENT_ONLY',prediction:false};
  });
  const candidate=paths.some(x=>x.candidate==='A')?'A':paths.some(x=>x.candidate==='B')?'B':null;
  return {...h,historical_candidate_v34:h.research_grade,research_grade:candidate,grade:null,formal:false,
   conditional_paths_v35:paths,WIN:{...h.WIN,conditional_paths:paths.filter(x=>x.WIN==='CONDITIONALLY_SUPPORTED'),overall:'UNRESOLVED'},
   PLACE:{...h.PLACE,conditional_paths:paths.filter(x=>x.PLACE==='CONDITIONALLY_SUPPORTED'),overall:'UNRESOLVED'},
   research_reason:candidate?'CONDITIONAL_STRESS_ROUTE_ONLY':'INSUFFICIENT_CONDITIONAL_ROUTE_SUPPORT',
   unresolved:['CURRENT_FORM','CURRENT_ROLE_PACE','ALTERNATIVE_COVERAGE','S_ROBUSTNESS','C_VS_UNKNOWN','POSITIVE_EYE_DAG_ADMISSION']};
 });
 return {...common,schema:'REBORN2_V35_PARTIAL_CURRENT_TRANSFER',historical_scenarios:observations,conditional_scenarios:scenarios,runners,
  formal:false,grade:null,policy:'PARTIAL_STRESS_BRIDGE_NOT_CANONICAL_SABC'};
}
