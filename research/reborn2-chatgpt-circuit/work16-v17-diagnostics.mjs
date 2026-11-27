import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {workInput,workDiagnostics} from './work15-v16-diagnostics.mjs';
const read=n=>readFileSync(new URL(n,import.meta.url));
const raw=read('./work16-v13-derived-pinned.json'), prior=JSON.parse(read('./work15-v12-historical-links-pinned.json'));
const source='476fe4470f4933210627dfd508c1660ff0792f70';
const sha=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
if(sha!==source)throw Error('WORK16_BLOB_MISMATCH');
const pinned=JSON.parse(raw),old=workInput(),key=(...a)=>JSON.stringify(a);
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const fail=k=>{throw Error(k);};
const unique=(a,f,n,k)=>{if(!Array.isArray(a)||a.length!==n||new Set(a.map(f)).size!==n)fail(k);};
const flags=['course_version_verified','eligibility_verified','historical_publication_verified','capture_time_verified','permission_cleared','benchmark_admitted','scoring_authorized'];
export const work16Input=()=>structuredClone(pinned);
export function inspectWork16(c){
 if(c.schema!=='stage16.0-derived-row-receipt'||c.formal_admissions!==0||c.scoring_authorized!==false||c.production_changes!==false||c.permission!=='NOT_CLEARED'||c.source_contract.blob!==old.source_blob||c.source_group_sha256!==pinned.source_group_sha256)fail('WORK16_SCOPE');
 const gate=c.gate_rows;unique(gate,r=>r.group_id,118,'GROUP_ID');
 unique(gate,r=>r.source_pointer,118,'GROUP_POINTER');
 const expectedGroups=new Map(pinned.gate_rows.map(r=>[r.group_id,r]));
 if(gate.some(r=>!expectedGroups.has(r.group_id)||r.circuit!==expectedGroups.get(r.group_id).circuit||r.source_pointer!==expectedGroups.get(r.group_id).source_pointer||flags.some(k=>r[k]!==false)))fail('GROUP_GATE');
 const groupCounts={JRA:gate.filter(r=>r.circuit==='JRA').length,LOCAL:gate.filter(r=>r.circuit==='LOCAL').length};
 if(groupCounts.JRA!==88||groupCounts.LOCAL!==30)fail('GROUP_COUNTS');
 if(c.jc_source_sha256!==pinned.jc_source_sha256||c.jc_global_flags.outcard_observed_before_race!==false||c.jc_global_flags.officially_observed_before_race!==false||c.jc_global_flags.verified_published_at!==null)fail('JC_SCOPE');
 unique(c.jc_rows,r=>r.horse_no,18,'JC_ID');
 if(c.jc_rows.some(r=>!Number.isInteger(r.horse_no)||r.horse_no<1||r.horse_no>18||r.official_outcard_row_observed!==null||r.verified_capture_at!==null||r.jra_native_horse_id!==null||r.reported_official_outcard_row_observed!==true))fail('JC_HELD');
 unique(c.historical_rows,r=>r.evidence_id,21,'HIST_ID');
 const oldHist=new Map(prior.rows.map(r=>[r.evidence_id,r]));
 const hist=new Map(c.historical_rows.map(r=>[r.evidence_id,r]));
 for(const r of hist.values()){
 const p=oldHist.get(r.evidence_id);
 if(!p||Object.keys(p).some(k=>p[k]!==r[k])||!hash(r.source_sha256)||r.person_valid_period!==null||r.verified_acquired_at!==null||r.formal_admission!==false||r.horse_id?.issuer!=='NAR'||!/^\d+$/.test(r.horse_id?.id??'')||['jockey','trainer'].some(k=>r[k+'_id']?.issuer!=='NAR'||r[k+'_id']?.role!==k||!/^\d+$/.test(r[k+'_id']?.id??'')))fail('HIST_BINDING');
 }
 const oldKey=r=>key(r.peer_id,r.later_race,r.reference_race,r.reference_subject_id);
 const prev=new Set(old.relations.map(oldKey));
 const rel=c.peer_relations.map(r=>({...r,later_race:r.candidate_event}));
 unique(rel,oldKey,137,'REL_ID');unique(rel,r=>r.ledger_pointer,137,'REL_POINTER');
 if(c.peer_ledger_sha256!==pinned.peer_ledger_sha256)fail('REL_SOURCE');
 for(const r of rel){
 const h=hist.get(r.reference_evidence_id),race=h?.evidence_id?.split(':').slice(0,-1).join(':');
 if(!prev.has(oldKey(r))||!h||race!==r.reference_race||h.horse_id.id!==r.reference_subject_id||h.source_sha256!==r.reference_result_dom_sha256||h.historical_runner_no!==r.reference_subject_runner_no||!Number.isInteger(r.reference_peer_runner_no)||r.reference_peer_runner_no<1||r.reference_peer_runner_no===r.reference_subject_runner_no||r.peer_id===r.reference_subject_id||r.target_cutoff_verified_at!==null||r.comparability_verified!==false||r.target_cutoff_exclusive_date!=='2026-11-25')fail('REL_LINK');
 }
 const priorDiag=workDiagnostics({...old,patches:c.source_contract.patches,relations:rel});
 const inventory=c.item_inventory.items;unique(inventory,r=>key(r.domain,r.id),115,'CATALOG');
 if(inventory.filter(r=>r.domain==='RANK').length!==100||inventory.filter(r=>r.domain==='EYE').length!==15||inventory.some(r=>r.actual_item_semantic_effect_verified!==false))fail('CATALOG_SCOPE');
 const replay=Object.entries(c.replay_candidates).map(([circuit,r])=>prepareReplay(circuit,r));
 return {source_blob:source,groups:gate.length,groupCounts,gate_values:gate.length*flags.length,jc_rows:c.jc_rows.length,historical_rows:hist.size,changed_runner_numbers:[...hist.values()].filter(r=>r.target_runner_no!==r.historical_runner_no).length,relations:rel.length,joined_reference_rows:rel.length,roots:priorDiag.roots,chronology:priorDiag.counts,patches:priorDiag.patches,inventory:inventory.length,replay,formal_admissions:0,official_replay_eligible:0,raw_source_verified:false};
}
export function prepareReplay(circuit,r){
 if(!['JRA','LOCAL','LOCAL_RETROSPECTIVE'].includes(circuit)||r.formal_eligible!==false)fail('REPLAY_SCOPE');
 unique(r.rows,x=>x[0],r.field,'REPLAY_ROSTER');
 if(r.rows.some(x=>!Array.isArray(x)||!Number.isInteger(x[0])||x[0]<1||x[0]>r.field||x.some(n=>!Number.isInteger(n)||n<0)))fail('REPLAY_ROW');
 const cols=r.query_columns??r.row_columns??r.columns;
 if(!Array.isArray(cols)||r.rows.some(x=>x.length!==cols.length))fail('REPLAY_COLUMNS');
 const totals=cols.slice(1).map((_,i)=>r.rows.reduce((s,x)=>s+x[i+1],0));
 if(circuit==='JRA'&&(!eq(totals,r.totals)||r.rows.some(x=>x[2]>x[1]||x[3]>x[2]||x[5]>x[4])))fail('REPLAY_TOTALS');
 if(circuit==='LOCAL'&&(totals[0]!==r.identity_attested_prior_rows||totals[2]!==r.lap_rows||r.rows.some(x=>x[2]>x[1])))fail('REPLAY_TOTALS');
 if(circuit==='LOCAL_RETROSPECTIVE'&&(totals[0]!==r.total||r.capture_after_target!==true))fail('RETROSPECTIVE_SCOPE');
 const times=circuit==='JRA'?[r.card_capture,r.runner_capture]:circuit==='LOCAL'?[r.as_of]:[];
 if(times.some(t=>!/(Z|[+-]\d\d:\d\d)$/.test(t??'')||!(Date.parse(t)<Date.parse(r.post))))fail('REPLAY_TIME');
 return {race:r.race,circuit,field:r.field,columns:cols,totals,recorded_capture_times:times,post:r.post??null,stored_before_post:times.length>0,scope:'COVERAGE_DIAGNOSTIC_ONLY',status:'BLOCKED',blockers:['PERMISSION_NOT_CLEARED','NATIVE_ID_AND_RAW_SOURCE_NOT_INDEPENDENTLY_VERIFIED','HISTORICAL_PUBLICATION_AND_VERSION_NOT_VERIFIED','NO_AUTHORIZED_PER_RUN_PERFORMANCE_PACKET',...(circuit==='LOCAL_RETROSPECTIVE'?['CAPTURE_AFTER_TARGET']:[])],runners:r.rows.map(x=>({horse_no:x[0],coverage_counts:Object.fromEntries(cols.slice(1).map((k,i)=>[k,x[i+1]])),blockers:[...(circuit==='JRA'&&x[2]===0?['NO_CARD_ARCHIVE_MATCH']:[]),...(circuit==='LOCAL'&&x[3]===0?['NO_LINKED_RACE_LAP']:[])],horse_id:null,analysis:null})),analysis:null,formal_eligible:false};
}
