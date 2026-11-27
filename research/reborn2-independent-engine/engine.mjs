import { analyzeV29, conditionalEnvelope, loadV29 } from '../reborn2-chatgpt-circuit/work28-v29-feasibility.mjs';

const replayQueue='EQUAL_FIRST_CHECKPOINT_START';
const allowedAxes=['A','B','C','D','E'];
const allowedClaims=new Set(['WIN_PATH','PLACE_PATH','RELATIVE_DISADVANTAGE']);

// Scenario starts are declared intervals, never inferred from popularity, assigned gate, or race laps.
// Past pair changes and their uncertainty come from the existing measurement circuit.
export function stressScenario({path,subject,rivals,starts,threshold=null}){
  if(new Set(rivals).size!==rivals.length || rivals.includes(subject) ||
    threshold!==null&&(!Number.isInteger(threshold)||threshold<1||threshold>rivals.length+1))
    throw Error('SCENARIO_FIELD_OR_THRESHOLD');
  const range=slot=>{
    const r=starts?.[slot];
    if(r===undefined)return null;
    if(!Array.isArray(r)||r.length!==2||!r.every(Number.isFinite)||r[0]>r[1])throw Error('SCENARIO_INTERVAL');
    return r;
  };
  const own=range(subject);
  const relations=rivals.slice().sort().map(rival=>{
    const other=range(rival);
    const past=path?.relations?.filter(r=>r.rival===rival)??[];
    const [r]=past;
    if(!own||!other||past.length!==1||!Number.isFinite(r.net_change_ms)||
        !Number.isFinite(r.change_bound_ms)||r.change_bound_ms<0||!r.refs?.length)
      return {rival,order:'UNKNOWN',interval_ms:null,refs:[],reason:'START_OR_PAST_CHANGE_UNAVAILABLE'};
    const interval=[other[0]-own[1]+r.net_change_ms-r.change_bound_ms,
      other[1]-own[0]+r.net_change_ms+r.change_bound_ms];
    const order=interval[0]>0?'AHEAD':interval[1]<0?'BEHIND':'UNKNOWN';
    return {rival,order,interval_ms:interval,refs:[...new Set(r.refs)].sort(),reason:order==='UNKNOWN'?'OVERLAP':'BOUNDED_CONDITIONAL_ORDER'};
  });
  return {relations,rank_bounds_under_assumptions:conditionalEnvelope(relations,threshold),
    assumption:'DECLARED_START_INTERVALS_AND_REPEATED_HISTORICAL_RELATIVE_CHANGE',
    observed_current_pace:false,prediction:false};
}

// Research policy probe. All five axes need supplied, independently reviewed findings.
// Nothing here generates a grade from a candidate observation or sets release approval.
export function reviewGradeBoundary({axes,claim}){
  if(!allowedClaims.has(claim)||!Array.isArray(axes)||axes.length!==5||
    new Set(axes.map(x=>x.axis)).size!==5||!axes.every(x=>allowedAxes.includes(x.axis)))
    return {grade:null,reason:'MISSING_REVIEW_CONTRACT',formal:false};
  const reviewed=axes.every(x=>x.current_relevance_reviewed===true&&
    ['SUPPORT','COUNTER','NEUTRAL'].includes(x.direction)&&
    Array.isArray(x.evidence_ids)&&x.evidence_ids.length&&x.evidence_ids.every(id=>typeof id==='string'&&id));
  if(!reviewed)return {grade:null,reason:'INCOMPLETE_CURRENT_EVIDENCE',formal:false};
  const directions=new Map();
  for(const axis of axes)for(const id of axis.evidence_ids){
    if(!directions.has(id))directions.set(id,new Set());
    directions.get(id).add(axis.direction);
  }
  if([...directions.values()].some(s=>s.has('SUPPORT')&&s.has('COUNTER')))
    return {grade:null,reason:'CONFLICTING_INTERPRETATION_OF_SHARED_EVIDENCE',formal:false};
  const byAxis=new Map(axes.map(x=>[x.axis,x.direction]));
  const hasCounter=axes.some(x=>x.direction==='COUNTER');
  let grade=null;
  if(claim==='WIN_PATH'&&!hasCounter&&[...byAxis.values()].every(x=>x==='SUPPORT'))grade='S';
  else if(claim==='WIN_PATH'&&!hasCounter&&byAxis.get('A')==='SUPPORT'&&byAxis.get('C')==='SUPPORT')grade='A';
  else if(claim==='PLACE_PATH'&&!hasCounter&&byAxis.get('B')==='SUPPORT'&&byAxis.get('D')==='SUPPORT')grade='B';
  else if(claim==='RELATIVE_DISADVANTAGE'&&byAxis.get('C')==='COUNTER'&&byAxis.get('D')==='COUNTER'&&
    ![...byAxis.values()].includes('SUPPORT'))grade='C';
  return {grade,reason:grade?'PROVISIONAL_BOUNDARY_PROBE':'HOLD_MIXED_OR_INSUFFICIENT',
    evidence_ids:[...directions.keys()].sort(),formal:false};
}

export function researchReplay({fixture,scenarios=[],placeThreshold=null,withdraw=null,loaded=loadV29()}){
  const result=analyzeV29(loaded,fixture,withdraw,{placeThreshold});
  const possible=result.roster.possible_active;
  const runners=result.runners.map(horse=>{
    const paths=horse.identity_known&&horse.status==='ACTIVE'?scenarios.map(s=>{
      const candidates=horse.conditional_scenarios.filter(p=>p.event===s.event&&p.queue===replayQueue);
      return {scenario:s.id,event:s.event,...stressScenario({path:candidates.length===1?candidates[0]:null,
        subject:horse.slot,rivals:possible.filter(x=>x!==horse.slot),starts:s.starts,threshold:placeThreshold})};
    }):[];
    const audit=horse.items.map(item=>({item:item.item,state:item.state,evidence_refs:[...new Set(item.refs)].sort(),
      declared_name:loaded.canonical.find(d=>d.item===item.item)?.name??null,
      dependency_state:item.refs.length?'REFERENCED':'NO_REFERENCE',
      current_applicability:horse.status==='CANCELLED'?'NOT_APPLICABLE':'UNPROVEN',
      effect:item.semantic_effect_proven===true?'CONDITIONAL_EFFECT_DEMONSTRATED':'NOT_DEMONSTRATED',
      grade_effect:false,missing:item.missing}));
    return {slot:horse.slot,status:horse.status,paths,audit,research_grade:null,current_ability:null,
      eye:horse.eye_feedback_v29,formal:false};
  });
  const audits=runners.flatMap(h=>h.audit);
  if(runners.some(h=>h.audit.length!==115||new Set(h.audit.map(a=>a.item)).size!==115||
    h.audit.some(a=>a.declared_name===null)))throw Error('CANONICAL_AUDIT_INCOMPLETE');
  return {fixture,runners,audit_summary:{slots:audits.length,without_reference:audits.filter(a=>a.dependency_state==='NO_REFERENCE').length,
    conditional_effects:audits.filter(a=>a.effect==='CONDITIONAL_EFFECT_DEMONSTRATED').length,grade_effects:0},
    held:loaded.diagnostics.held,groups:loaded.diagnostics.groups,formal:false};
}

// Re-evaluate the existing common circuit when an EYE-linked source is withdrawn.
// Returning the same source can never create a second vote or imply independent evidence.
export function reviewEyeFeedback({loaded=loadV29(),fixture,slot,event,withdraw}){
  const original=analyzeV29(loaded,fixture);
  const horse=original.runners.find(h=>h.slot===slot);
  const linked=horse?.eye_feedback_v29?.filter(f=>f.refs.includes(withdraw))??[];
  if(!linked.length)return {state:'NO_BOUND_EYE_SOURCE',effect:false,formal:false};
  const replay=analyzeV29(loaded,fixture,withdraw);
  const affected=replay.runners.find(h=>h.slot===slot);
  const targets=new Set(linked.flatMap(f=>f.targets));
  const select=h=>h.v29_findings.filter(f=>targets.has(f.item)&&f.refs.length).map(f=>({
    item:f.item,state:f.state,refs:f.refs.slice().sort()
  }));
  const before=select(horse),after=select(affected);
  const path=h=>h.conditional_scenarios.filter(x=>x.event===event).map(x=>({queue:x.queue,win:x.envelope.win}));
  return {state:'WITHDRAWAL_REPLAY_OF_SHARED_SOURCE',before,after,before_paths:path(horse),after_paths:path(affected),
    effect:JSON.stringify(before)!==JSON.stringify(after),independent_vote:false,formal:false};
}
