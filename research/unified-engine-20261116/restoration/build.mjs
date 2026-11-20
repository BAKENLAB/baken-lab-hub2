import {readFileSync,writeFileSync} from 'node:fs';import {gzipSync} from 'node:zlib';
import {packLogs} from './audit-codec.mjs';import {createHash} from 'node:crypto';
import {replayRows,measureReplay} from './replay.mjs';import {auditReconstructedRows} from './adapter.mjs';
const dir=new URL('./',import.meta.url),read=p=>readFileSync(new URL(p,dir),'utf8'),write=(p,x)=>writeFileSync(new URL(p,dir),JSON.stringify(x,null,2)+'\n');
const rows=JSON.parse(read('cohort-input.json')).rows,labels=JSON.parse(read('official-results.json')).rows;
const prediction=replayRows(rows); // results are not passed to this function
const reference=new Map(rows.map(r=>[[r.race_date,r.track,r.race_no,r.horse_no].join('/'),r]));
const discrepancies=prediction.filter(p=>{const r=reference.get(p.race_id+'/'+p.horse_no);return Number(r.sql_rank_after)!==p.rank_after||Number(r.sql_score_after)!==p.score_after||r.sql_selected!==p.selected||Number(r.legacy_dense_rank)!==p.early_dense_rank;});
if(discrepancies.length)throw Error('SQL_JS_DISCREPANCIES_'+discrepancies.length);
const measured=measureReplay(prediction,labels),audit=auditReconstructedRows(rows);
const {rows:details,...summary}=measured;
write('measurement.json',{...summary,sql_js_discrepancies:0,independent_formal_engine:{audit_horses:audit.horses,audit_items:audit.audit_items,condition_matches:audit.central_condition_matches,scoring:audit.independent_100_point_scoring,eye:audit.formal_eye_selection},
 provenance:{history_sources_after_frozen:rows.filter(r=>Date.parse(r.source_checked_at)>Date.parse(r.frozen_at)).length,history_sources_inside_three_minute_cutoff:rows.filter(r=>Date.parse(r.source_checked_at)>=Date.parse(r.post_time)-180000).length,all_sources_before_post:audit.cohorts.every(r=>r.all_history_sources_before_post),fully_prefreeze_races:audit.cohorts.filter(r=>r.all_sources_before_reference_freeze).map(r=>r.race_id),not_an_immutable_historical_snapshot:true}});
write('horse-comparison.json',details);
const csvEscape=x=>'"'+String(x??'').replaceAll('"','""')+'"';
const cols=['race_id','horse_no','horse_name','rank_before','score_before','rank_after','score_after','score_delta','early_ratio','known','keep','early_dense_rank','eligible','eye_before','eye_after','old_selected','selected','finish','old_captured','captured','formal_eye_audit'];
writeFileSync(new URL('horse-comparison.csv',dir),cols.join(',')+'\n'+details.map(r=>cols.map(k=>csvEscape(r[k])).join(',')).join('\n')+'\n');
// Lossless dictionary encoding keeps all 15,575 detailed audit records readable
// without copying the same timestamps/provenance strings thousands of times.
const packed=packLogs(audit.logs);writeFileSync(new URL('all-horse-25-item-audit.json.gz',dir),gzipSync(Buffer.from(JSON.stringify(packed)+'\n')));
write('snapshot-manifest.json',{classification:'FIXED_NOW_PREPOST_RESEARCH_RECONSTRUCTION_NOT_FROZEN_INPUT_ARCHIVE',record_created_at:new Date().toISOString(),provenance_checked_at:'2026-11-16T07:50:56Z',
 data_source:'Read-only Supabase SELECT; no CLAIM, RPC save, UPDATE, Cron or deploy',races:46,horses:623,results_separate:true,formal_two_factor_audit_performed:false,
 guarantee:'Stored source/row/card times precede post. SHA-256 locks this export now; does not prove original FROZEN-time content.',
 files:['user-original-readonly.sql','features-readonly.sql','results-readonly.sql','cohort-input.json','official-results.json','race-times.json','measurement.json','horse-comparison.json','horse-comparison.csv','all-horse-25-item-audit.json.gz'].map(path=>({path,bytes:readFileSync(new URL(path,dir)).length,sha256:createHash('sha256').update(readFileSync(new URL(path,dir))).digest('hex')}))});
console.log(JSON.stringify({races:measured.races,horses:measured.horses,old:measured.old_captures,after:measured.captures,new:measured.new_captures,lost:measured.lost_captures,audit_items:audit.audit_items,sql_js_differences:discrepancies.length}));
