import {readFileSync} from 'node:fs';
const packet=JSON.parse(readFileSync(new URL('./work-v11-historical-row-candidates.json',import.meta.url)));
const validId=x=>x?.issuer==='NAR'&&typeof x.id==='string'&&/^\d+$/.test(x.id);
export function matchHistoricalCandidate({row,expectedHorseId,expectedRaceKey,expectedHistoricalRunnerNo=null}){
 const errors=[];
 if(!validId(row?.horse_id)||!validId(expectedHorseId)||row.horse_id.id!==expectedHorseId.id)errors.push('HORSE_ID_MISMATCH');
 if(row?.historical_race_key!==expectedRaceKey)errors.push('HISTORICAL_RACE_MISMATCH');
 if(!Number.isInteger(row?.target_runner_no)||row.target_runner_no<1||!Number.isInteger(row?.historical_runner_no)||row.historical_runner_no<1)errors.push('RUNNER_NUMBER_INVALID');
 if(expectedHistoricalRunnerNo!==null&&row?.historical_runner_no!==expectedHistoricalRunnerNo)errors.push('HISTORICAL_RUNNER_NO_MISMATCH');
 const winner=row?.finish_literal==='1';
 const validMargin=winner?row.margin_scope==='NOT_APPLICABLE'&&row.margin_literal===''||row.margin_scope==='RECORD_NOTE_NOT_MARGIN'&&row.margin_literal==='レコード':row?.margin_scope==='PRECEDING_FINISHER'&&typeof row.margin_literal==='string'&&row.margin_literal.trim().length>0;
 if(!validMargin)errors.push('MARGIN_SCOPE_UNRESOLVED');
 if(row?.formal_admission!==false)errors.push('FORMAL_FLAG_NOT_ALLOWED');
 return {evidence_id:row?.evidence_id??null,match:errors.length===0,errors,target_runner_no:row?.target_runner_no??null,historical_runner_no:row?.historical_runner_no??null,margin_literal:row?.margin_literal??null,margin_scope:row?.margin_scope??null,winner_gap:null,verified_acquired_at:row?.verified_acquired_at??null,formal_admission:false,scope:'SAVED_CANDIDATE_NOT_RAW_DOM_REVERIFICATION'};
}
export function auditWorkV11(){
 const rows=packet.rows.map(row=>matchHistoricalCandidate({row,expectedHorseId:row.horse_id,expectedRaceKey:row.historical_race_key,expectedHistoricalRunnerNo:row.historical_runner_no}));
 return {source_commit:packet.source_commit,source_blob:packet.source_blob,total:rows.length,unique_evidence_ids:new Set(rows.map(r=>r.evidence_id)).size,unique_historical_races:new Set(packet.rows.map(r=>r.historical_race_key)).size,runner_number_differences:rows.filter(r=>r.target_runner_no!==r.historical_runner_no).length,shape_matches:rows.filter(r=>r.match).length,verified_acquisition_times:rows.filter(r=>r.verified_acquired_at!==null).length,permission:packet.permission_status,formal_admissions:0,rows};
}
