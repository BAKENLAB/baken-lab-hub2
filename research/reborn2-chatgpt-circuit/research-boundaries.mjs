// Research boundary diagnostics only; never issues a rank.
export function inspectProposedDecision({proposed_rank=null,comparison_support=[],major_counter=[],unknowns=[],winning_paths=[],placing_paths=[]}){
 const allowed=[null,'S','A','B','C'];
 if(!allowed.includes(proposed_rank))throw Error('RANK_INVALID');
 const reason=unknowns.length?'MATERIAL_UNKNOWN':major_counter.length?'COUNTEREVIDENCE_PRESENT':winning_paths.length?'CONDITIONAL_PATHS_PRESENT':'WINNING_PATH_UNESTABLISHED';
 return {proposed_rank,rank_candidate:null,reason,comparison_support,major_counter,unknowns,winning_paths,placing_paths,distinct_winning_scenarios:[...new Set(winning_paths.map(x=>x.scenario_id))].sort(),boundary_conflicts:proposed_rank==='C'&&!comparison_support.length?['C_REQUIRES_AFFIRMATIVE_COUNTEREVIDENCE']:[],formal_adoption:false};
}
export function denominatorReport({targetRaces,rows}){
 const count=(p)=>rows.filter(p).length;
 return {target_races:targetRaces,ledger_rows:rows.length,actual_starts:count(r=>r.start_status==='FINISHED'||r.start_status==='DNF_STARTED'||r.start_status==='DQ_STARTED'),excluded:count(r=>r.start_status==='EXCLUDED_NOT_STARTED'||r.start_status==='CANCELLED_NOT_STARTED'),unknown_start:count(r=>r.start_status==='START_STATUS_UNKNOWN'),evaluated:count(r=>['FINISHED','DNF_STARTED','DQ_STARTED'].includes(r.start_status)&&['S','A','B','C'].includes(r.rank)),unevaluated:count(r=>['FINISHED','DNF_STARTED','DQ_STARTED'].includes(r.start_status)&&!['S','A','B','C'].includes(r.rank)),result_pending:count(r=>r.result_confirmed!==true),dead_heat:count(r=>r.dead_heat_group!=null)};
}
