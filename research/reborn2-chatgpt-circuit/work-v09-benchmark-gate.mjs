import {readFileSync} from 'node:fs';
const contract=JSON.parse(readFileSync(new URL('./work-v09-acceptance-link.json',import.meta.url),'utf8'));
export function inspectBenchmarkCandidate(row){
 const keys=contract.required_key,missing=keys.filter(k=>k==='distance'?!Number.isInteger(row?.[k])||row[k]<=0:typeof row?.[k]!=='string'||!row[k].trim());
 const invalid=contract.distributions.filter(k=>{const d=row?.[k];return !d||!Number.isInteger(d.n)||d.n<=0||![d.min,d.max,d.mean,d.stdev].every(Number.isFinite)||d.stdev<0||!Array.isArray(d.quartiles)||d.quartiles.length!==3||!d.quartiles.every(Number.isFinite)||d.min>d.quartiles[0]||d.quartiles[0]>d.quartiles[1]||d.quartiles[1]>d.quartiles[2]||d.quartiles[2]>d.max||d.mean<d.min||d.mean>d.max;});
 const unresolved=contract.required_gates.filter(k=>row?.[k]!==true);
 // Never turn assertions in a new research packet into formal authorization.
 return {key:Object.fromEntries(keys.map(k=>[k,row?.[k]??null])),missing_keys:missing,invalid_distributions:invalid,unresolved_gates:unresolved,observed_version:row?.observation_version??null,observation_status:missing.length||invalid.length?'INVALID_RESEARCH_PACKET':'RESEARCH_CANDIDATE_ONLY',origin_identity:'NOT_PROVEN_IDENTICAL_TO_OLD_REPLAY',benchmark_admitted:false,scoring_authorized:false,formal_consumption:false};
}
export function workV09Status(){return {...contract,formal_consumer_connected:false};}

const workbook=JSON.parse(readFileSync(new URL('./work-v09-cohort-observations.json',import.meta.url),'utf8'));
const keyOf=x=>JSON.stringify(contract.required_key.map(k=>x[k]));
export function auditWorkbookCohorts(){
 const summarize=(xs)=>({groups:xs.length,races:xs.reduce((n,x)=>n+x.n_races,0),rows:xs.reduce((n,x)=>n+x.n_horses,0),unique_keys:new Set(xs.map(keyOf)).size});
 const local=workbook.local_group_rows.map(row=>{
 const known=row.group_no===workbook.known_sample_comparison.local_group_no;
 const full=known?{...row,...Object.fromEntries(workbook.known_sample_comparison.distribution_comparison.map(x=>[x.distribution,x.workbook_new_value]))}:row;
 return {...inspectBenchmarkCandidate(full),group_no:row.group_no,full_distribution_cells_available:known,source_status:'WORKBOOK_DERIVED_AGGREGATE',official_raw_archive_verified:false};
 });
 const jra=workbook.jra_group_rows.map(row=>({group_no:row.group_no,key:Object.fromEntries(contract.required_key.map(k=>[k,row[k]])),course_layout_status:row.course_layout_status,full_distribution_cells_available:false,unresolved_gates:contract.required_gates,benchmark_admitted:false,scoring_authorized:false}));
 return {local_totals:summarize(workbook.local_group_rows),jra_totals:summarize(workbook.jra_group_rows),local,jra,known_sample_comparison:workbook.known_sample_comparison,formal_admissions:0};
}
// This is a diagnostic label lookup only. Do not map a canonical class key or infer layout.
export function lookupWorkCohortDiagnostic({circuit,observedLabelKey}){
 const rows=circuit==='JRA'?workbook.jra_group_rows:circuit==='LOCAL'?workbook.local_group_rows:[];
 if(!observedLabelKey||contract.required_key.some(k=>observedLabelKey[k]==null||observedLabelKey[k]===''))return {status:'RAW_LABEL_KEY_INCOMPLETE',candidates:[],formal_admissions:0};
 const candidates=rows.filter(row=>contract.required_key.every(k=>row[k]===observedLabelKey[k]));
 return {status:candidates.length===1?'EXACT_RAW_LABEL_RESEARCH_MATCH':candidates.length?'AMBIGUOUS_RAW_LABEL':'NO_RAW_LABEL_MATCH',candidates:candidates.map(r=>({group_no:r.group_no,n_races:r.n_races,n_horses:r.n_horses,course_version_verified:false,benchmark_admitted:false,scoring_authorized:false})),formal_admissions:0};
}
