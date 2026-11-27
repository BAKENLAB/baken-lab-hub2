import {fingerprint} from './recompute-full-rank.mjs';
const uniq=xs=>[...new Set(xs)].sort();
const list=x=>Array.isArray(x)?x:[];
const marketKey=k=>/odds|popularity|market|tansho|ninki|人気|オッズ/i.test(k);
function rejectMarket(x){if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){if(marketKey(k))throw Error('MARKET_IN_ABILITY_INPUT');rejectMarket(v);}}
const canonicalPaths=xs=>list(xs).map(p=>({...p,roots:uniq(list(p.roots)),counter_ids:uniq(list(p.counter_ids)),unknown_ids:uniq(list(p.unknown_ids)),required_events:uniq(list(p.required_events))})).sort((a,b)=>a.id.localeCompare(b.id));
const rootMap=xs=>{const m=new Map();for(const x of list(xs)){if(!x?.root_id)continue;if(m.has(x.root_id)&&fingerprint(m.get(x.root_id))!==fingerprint(x))throw Error('CONFLICTING_ORIGINAL_ROOT');m.set(x.root_id,x);}return [...m.values()].sort((a,b)=>a.root_id.localeCompare(b.root_id));};
// These are obligation checks on EXPLICIT synthetic witness assertions. Not a rule that infers strength from racing data.
export function boundaryResearch(f){
 rejectMarket(f);
 const roots=rootMap(f.roots),rootIds=new Set(roots.map(x=>x.root_id));
 const win=canonicalPaths(f.winning_paths),place=canonicalPaths(f.placing_paths);
 const counter=list(f.counters).slice().sort((a,b)=>a.id.localeCompare(b.id));
 const unknown=list(f.unknowns).slice().sort((a,b)=>a.id.localeCompare(b.id));
 const activeCounter=counter.filter(c=>c.resolved!==true||!c.correction_root||!rootIds.has(c.correction_root)||c.correction_verified!==true);
 const path=(p)=>{const material=activeCounter.filter(c=>c.material===true&&list(c.path_ids).includes(p.id));const uncertainties=unknown.filter(u=>u.material===true&&list(u.path_ids).includes(p.id));
  const verified=p.roots.length>0&&p.roots.every(id=>rootIds.has(id));return {id:p.id,fixture_support_asserted:p.support_asserted===true,roots:p.roots,current_fit:p.current_fit??'UNKNOWN',comparison:p.current_comparison??'UNKNOWN',conditions:p.required_events,unresolved_counter_ids:material.map(x=>x.id),material_unknown_ids:uncertainties.map(x=>x.id),obligation_met:verified&&p.support_asserted===true&&p.current_fit==='SUPPORTED'&&p.current_comparison==='SUPPORTED'&&!material.length&&!uncertainties.length,particularly_strong_asserted:p.particularly_strong_asserted===true};};
 const w=win.map(path),p=place.map(path);
 const identity=f.identity_verified===true&&f.target_bound===true;
 const globalUnknown=unknown.filter(u=>u.material===true&&u.global===true),globalCounter=activeCounter.filter(c=>c.material===true&&c.global===true);
 const core=identity&&!globalUnknown.length&&!globalCounter.length;
 const cWitness=f.positive_disadvantage?.supported===true&&list(f.positive_disadvantage.roots).length>0&&list(f.positive_disadvantage.roots).every(id=>rootIds.has(id))&&f.positive_disadvantage.comparable===true&&f.supporting_paths_reviewed===true;
 const obligations={S:core&&w.some(x=>x.obligation_met&&x.particularly_strong_asserted),A:core&&w.some(x=>x.obligation_met),B:core&&p.some(x=>x.obligation_met),C:core&&cWitness&&!w.some(x=>x.obligation_met)&&!p.some(x=>x.obligation_met)};
 const fixtureCandidates=Object.keys(obligations).filter(k=>obligations[k]);
 const payload={horse_id:f.horse_id,roots,winning_paths:w,placing_paths:p,active_counter_ids:activeCounter.map(c=>c.id),correction_history:counter.filter(c=>!activeCounter.includes(c)).map(c=>({id:c.id,correction_root:c.correction_root})),material_unknowns:unknown.filter(u=>u.material===true),nonmaterial_unknowns:unknown.filter(u=>u.material!==true),five_axis_findings:list(f.five_axis_findings),scenario_assumptions:list(f.scenarios),conditional_requirements:uniq([...w,...p].flatMap(q=>q.conditions)),conditions_changes:list(f.condition_changes),obligations};
 return {...payload,fixture_candidate_grades:f.fixture_only===true?fixtureCandidates:[],fixture_only:f.fixture_only===true,individual_assessment_status:!identity?'IDENTITY_HOLD':!core?'MATERIAL_HOLD':fixtureCandidates.length?'OBLIGATIONS_REVIEWED':'INSUFFICIENT_SUPPORT',candidate_grade:null,grade_basis:null,rule_version:'RESEARCH_BOUNDARY_UNAPPROVED',decision_status:'FORMAL_JUDGMENT_DISABLED',research_open:false,formal_consumption:0,digest:fingerprint(payload)};
}
export function compareAnalysts(a,b){
 const ids=uniq([...Object.keys(a),...Object.keys(b)]),cross={},mismatches=[];
 for(const id of ids){const x=a[id]??'UNASSESSED',y=b[id]??'UNASSESSED';const k=x+'|'+y;cross[k]=(cross[k]??0)+1;if(x!==y)mismatches.push({horse_id:id,first:x,second:y});}
 return {n:ids.length,exact_match:ids.length-mismatches.length,agreement:ids.length?(ids.length-mismatches.length)/ids.length:null,cross,mismatches,correctness_proven:false};
}
export function researchBoundaryFromAnalysis({analysis,target}){
 return analysis.audit.runners.map(h=>{const p=analysis.winning.runners.find(x=>x.horse_no===h.horse_no);return {horse_no:h.horse_no,horse_id:h.horse_id,race_id:target.race_id,roster_version:target.roster_version??null,cutoff:target.cutoff,evidence_version:analysis.evidence_version,winning_paths:p?.winning_paths??[],placing_paths:p?.placing_paths??[],material_unknowns:p?.unknowns??[],analysis_states:h.items.map(i=>({item_id:i.item_id,state:i.analysis_state})),five_axis_findings:null,materiality_status:'UNVALIDATED',candidate_grade:null,decision_status:h.active===false?'NOT_APPLICABLE':!h.horse_id?'IDENTITY_HOLD':'FORMAL_JUDGMENT_DISABLED',formal_consumption:0};});
}
export function inspectDiscovery(f){
 rejectMarket(f);
 const roots=rootMap(f.roots),rootIds=new Set(roots.map(r=>r.root_id));
 const pathways=list(f.mechanisms).slice().sort((a,b)=>a.id.localeCompare(b.id)).map(m=>{
 const rr=uniq(list(m.roots));const mechanismBound=rr.length>0&&rr.every(r=>rootIds.has(r));
 const current=m.current_relevance==='SUPPORTED',fit=m.fit==='SUPPORTED';
 const counters=list(m.counters).slice().sort((a,b)=>a.id.localeCompare(b.id));
 const unresolved=counters.filter(c=>c.material===true&&!(c.resolved===true&&c.correction_verified===true&&rootIds.has(c.correction_root)));
 const material=list(m.unknowns).filter(u=>u.material===true);
 const distinction=['RECOVERY','ABILITY_INCREASE','MIXED','UNKNOWN'].includes(m.change_kind)?m.change_kind:'UNKNOWN';
 const actualPath=m.winning_path_supported===true||m.placing_path_supported===true;
 const status=!mechanismBound||!current||!fit||material.length||unresolved.length?'HOLD_MATERIAL':m.effect_supported===true&&actualPath?'CANDIDATE_RESEARCH':m.effect_refuted===true?'NOT_SUPPORTED':'HOLD_MATERIAL';
 return {id:m.id,root_ids:rr,change_kind:distinction,status,observed:m.observed??null,mechanism:m.mechanism??null,current_relevance:m.current_relevance??'UNKNOWN',fit:m.fit??'UNKNOWN',winning_path_supported:m.winning_path_supported===true,placing_path_supported:m.placing_path_supported===true,counterevidence:counters,material_unknowns:material,historical_time:m.historical_time??null,required_events:uniq(list(m.required_events)),strength_definition:'UNAPPROVED',effect_supported_asserted:m.effect_supported===true};
 });
 const status=f.active===false?'NOT_APPLICABLE':f.identity_verified!==true?'HOLD_MATERIAL':pathways.some(p=>p.status==='CANDIDATE_RESEARCH')?'CANDIDATE_RESEARCH':pathways.some(p=>p.status==='HOLD_MATERIAL')||f.all_items_reviewed!==true||f.material_coverage_complete!==true?'HOLD_MATERIAL':'NOT_SUPPORTED';
 const payload={horse_id:f.horse_id,roots,pathways,status,all_items_reviewed:f.all_items_reviewed===true,material_coverage_complete:f.material_coverage_complete===true};
 return {...payload,fixture_only:f.fixture_only===true,fixture_eligible:f.fixture_only===true&&status==='CANDIDATE_RESEARCH',ability_eligible:null,eye_candidate:null,decision_status:'FORMAL_SELECTION_DISABLED',formal_consumption:0,digest:fingerprint(payload)};
}
export function discoveryFieldSummary(rows){
 const active=rows.filter(r=>r.status!=='NOT_APPLICABLE');
 return {active_count:active.length,reviewed_count:active.filter(r=>r.all_items_reviewed).length,candidate_ids:active.filter(r=>r.status==='CANDIDATE_RESEARCH').map(r=>r.horse_id).sort(),held_ids:active.filter(r=>r.status==='HOLD_MATERIAL').map(r=>r.horse_id).sort(),field_status:!active.length?'NO_ACTIVE':active.some(r=>r.status==='HOLD_MATERIAL')?'MATERIAL_HOLD':active.some(r=>r.status==='CANDIDATE_RESEARCH')?'RESEARCH_CANDIDATES':'REVIEWED_NO_SUPPORTED_CANDIDATES',formal_selection:null};
}
export function researchDiscoveryFromAnalysis(analysis){
 return analysis.audit.runners.map(h=>{const eye=analysis.eye.find(x=>x.horse_no===h.horse_no);const path=analysis.winning.runners.find(x=>x.horse_no===h.horse_no);return {horse_no:h.horse_no,horse_id:h.horse_id,status:h.active===false?'NOT_APPLICABLE':'HOLD_MATERIAL',all_items_reviewed:eye?.items.length===15,material_coverage_complete:false,observations:eye?.items??[],winning_paths:path?.winning_paths??[],placing_paths:path?.placing_paths??[],current_relevance:'UNVALIDATED',ability_eligible:null,eye_candidate:null,formal_consumption:0};});
}
