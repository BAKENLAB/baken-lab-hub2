import { analyzeV30, loadV30 } from '../reborn2-chatgpt-circuit/work29-v30-terminal.mjs';

const dimensions={
 A:['RANK08','RANK12','RANK21','RANK29'],
 B:[],
 C:['RANK18'],
 D:[],
 E:['RANK29','RANK100']
};
const sharedRoots=x=>[...new Set(x)].sort();
const predicate=f=>f.state==='SHARED_PATH_REJECTED_BY_TERMINAL_COUNTEREVIDENCE'?'DECISIVE_FOR_ASSUMPTION':
 f.state==='TERMINAL_GAIN_DESPITE_PAIR_LOSS_REVIEW'?'MIXED_HISTORICAL':
 ['TERMINAL_PAIR_LEAD_RETAINED','TERMINAL_PAIR_CONVERSION','TERMINAL_PAIR_RECOVERY'].includes(f.state)?
 'HISTORICAL_SUPPORT':'OBSERVATION_ONLY';

function axesFor(horse){
  return Object.entries(dimensions).map(([axis,ids])=>{
    const facts=horse.findings_v30.filter(f=>ids.includes(f.item)&&f.refs.length).map(f=>({
      item:f.item,predicate:predicate(f),evidence_refs:sharedRoots(f.refs),observation:f.observation,
      applicability:'HISTORICAL_ONLY'
    }));
    const other=axis==='B'?horse.condition_paths??[]:axis==='D'?horse.pace_paths??[]:[];
    const state=horse.status==='CANCELLED'?'NOT_APPLICABLE':
      horse.status!=='ACTIVE'||!horse.identity_known?'UNKNOWN_IDENTITY_OR_STATUS':
      facts.length||other.length?'OBSERVED_CURRENT_RELEVANCE_UNPROVEN':'MISSING';
    return {axis,state,facts,conditions_or_pace:other,current_support:[],current_counter:[]};
  });
}

function semanticAudit(horse,names){
  return horse.items.map(item=>{
    const findings=horse.findings_v30.filter(f=>f.item===item.item&&f.refs.length);
    const pathEffect=findings.some(f=>predicate(f)==='DECISIVE_FOR_ASSUMPTION');
    const capabilityEffect=findings.some(f=>['HISTORICAL_SUPPORT','MIXED_HISTORICAL'].includes(predicate(f)));
    const currentEffect=false;
    return {id:item.item,name:names.get(item.item),state:horse.status==='CANCELLED'?'NOT_APPLICABLE':
      findings.length?'OBSERVED_FINDING':item.refs.length?'REFERENCED':'MISSING',
      refs:sharedRoots(item.refs),historical_capability_effect:capabilityEffect,
      current_condition_effect:currentEffect,conditional_path_effect:pathEffect,grade_effect:false,
      effect_origin:pathEffect?'V30_TERMINAL_COUNTEREXAMPLE':capabilityEffect?'V30_FINDING_CONSUMED_BY_AXIS':null,
      inherited_v29_conditional_effect:item.semantic_effect_proven===true,missing:item.missing};
  });
}

export function synthesize({loaded=loadV30(),fixture,withdraw=null,placeThreshold=null}){
  const run=analyzeV30(loaded,fixture,withdraw,{placeThreshold});
  const names=new Map(loaded.canonical.map(x=>[x.item,x.name]));
  if(names.size!==115||loaded.diagnostics.groups!==118||loaded.diagnostics.held!==826)
    throw Error('CANONICAL_CONTRACT_CHANGED');
  const runners=run.runners.map(horse=>{
    const axes=axesFor(horse);
    const audit=semanticAudit(horse,names);
    if(audit.length!==115||new Set(audit.map(x=>x.id)).size!==115||audit.some(x=>!x.name))
      throw Error('INCOMPLETE_ITEM_AUDIT');
    const review=horse.scenarios_v30.map(path=>({
      event:path.event,kind:path.kind,scope:path.scope,state:path.state,
      win_under_assumptions:path.envelope?.win??null,
      place_under_assumptions:path.envelope?.place??null,
      current_feasibility:'UNPROVEN',refs:sharedRoots(path.refs)
    }));
    const feedback=(horse.eye_feedback_v30??[]).map(f=>{
      const matches=horse.findings_v30.filter(x=>f.targets.includes(x.item)&&x.refs.some(ref=>f.refs.includes(ref)));
      return {item:f.item,state:matches.length?'HISTORICAL_DISCOVERY_BOUND_CURRENT_RELEVANCE_UNPROVEN':
        'NO_BOUND_OBSERVED_FINDING',targets:f.targets,refs:sharedRoots(f.refs),
        returned_to_current_analysis:false,conditional_path_effect:false};
    });
    const blockedPaths=review.filter(p=>p.state==='CONTRADICTED_BY_OBSERVED_FINISH'||
      p.state==='CONTRADICTED_SHARED_ORDER');
    const decision={
      grade:null,formal:false,
      boundaries:{
        S:{state:'HELD',requires:['CURRENT_WIN_PATH','REPRODUCIBILITY','MAJOR_COUNTER_RECONCILED']},
        A:{state:'HELD',requires:['CURRENT_WIN_CONTENTION','CONDITION_AND_RIVAL_LINK']},
        B:{state:'HELD',requires:['CURRENT_CONCRETE_PLACE_PATH']},
        C:{state:'HELD',requires:['CURRENT_COMPARATIVE_DISADVANTAGE','COMPETING_POSITIVE_PATH_REVIEW']}
      },
      decisive_historical_counterexamples:blockedPaths.map(p=>({event:p.event,kind:p.kind,refs:p.refs})),
      unresolved:['CURRENT_RELEVANCE','CURRENT_RESPONSE_TO_PACE','CURRENT_RIVAL_COMPARISON']
    };
    const held=horse.status==='CANCELLED'?'NOT_APPLICABLE':!horse.identity_known||horse.status!=='ACTIVE'?
      'HOLD_IDENTITY_OR_STATUS':'HOLD_CURRENT_TRANSFER_AND_PACE_RESPONSE';
    return {slot:horse.slot,axes,audit,paths:review,eye_feedback:feedback,
      evidence_roots:sharedRoots(axes.flatMap(a=>a.facts.flatMap(f=>f.evidence_refs))),
      grade_decision:{...decision,state:held}};
  });
  const byItem=Object.fromEntries([...names].map(([id,name])=>{
    const rows=runners.flatMap(h=>h.audit.filter(x=>x.id===id));
    return [id,{name,missing:rows.filter(x=>x.state==='MISSING').length,
      not_applicable:rows.filter(x=>x.state==='NOT_APPLICABLE').length,
      referenced:rows.filter(x=>x.state==='REFERENCED').length,
      observed:rows.filter(x=>x.state==='OBSERVED_FINDING').length,
      historical_effect:rows.filter(x=>x.historical_capability_effect).length,
      path_effect:rows.filter(x=>x.conditional_path_effect).length,grade_effect:0}];
  }));
  return {runners,byItem,held:loaded.diagnostics.held,groups:loaded.diagnostics.groups,formal:false};
}
