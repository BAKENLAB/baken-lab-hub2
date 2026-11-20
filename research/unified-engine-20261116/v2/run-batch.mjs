// Offline <=5R per invocation. Selection lock is written BEFORE labels are read.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {readBatch} from './read-batch.mjs';import {createHash} from 'node:crypto';import {gzipSync,gunzipSync} from 'node:zlib';import {fileURLToPath,pathToFileURL} from 'node:url';import {resolve} from 'node:path';import {assertFresh} from './checkpoint.mjs';
import {digest} from '../input.mjs';import {buildMinetaFacts} from './features.mjs';import {VERSION,SPEC_COMMIT} from './conditions.mjs';
import {auditReconstructedRows} from '../restoration/adapter.mjs';import {replayRows,measureReplay} from '../restoration/replay.mjs';
const root=new URL('./',import.meta.url),no=Number(process.argv[2]);if(!Number.isInteger(no)||no<1||no>10)throw Error('Specify one batch number 1..10');
const stem='batch-'+String(no).padStart(2,'0'),source=fileURLToPath(new URL('../restoration/batches/'+stem+'.payload.json',root));
const outputIndex=process.argv.indexOf('--output-dir');const dir=outputIndex>=0?pathToFileURL(resolve(process.argv[outputIndex+1])+'/'):new URL('validation/',root);mkdirSync(dir,{recursive:true});
assertFresh(['selection-lock.json','summary.json','audit.payload.json','csv'].map(ext=>new URL(stem+'.'+ext,dir)));
const events=[];const load=role=>{events.push(role==='features'?'FEATURES_READ':'LABELS_READ');return readBatch(source,role);};
const feature=load('features'),rows=feature.rows,byRace=new Map();for(const r of rows){const id=[r.race_date,r.track,r.race_no].join('/');byRace.set(id,(byRace.get(id)||[]).concat(r));}if(byRace.size>5)throw Error('BATCH_TOO_LARGE');
const sourceFile=readFileSync(source),baselinePrediction=replayRows(rows),own=auditReconstructedRows(rows);const audit=own.logs.filter(l=>l.criterion!=='mineta');const raceResults=[],horseRows=[];
for(const [race_id,rs] of byRace){
 const first=rs[0],capturedAt=new Date().toISOString();
 const roster=rs.map(r=>({horse_id:r.horse_ref,horse_no:r.horse_no,horse_name:r.horse_name,status:'ACTIVE'}));
 const history=rs.flatMap(r=>r.past_runs.map(p=>({...p,horse_id:r.horse_ref,horse_name:r.horse_name,source:{ref:p.source_ref?.startsWith('/')?'https://www.jra.go.jp'+p.source_ref:p.source_ref,known_at:r.source_checked_at,sha256:feature.member_sha256,verified:false,verification_status:'TIMESTAMP_RECONSTRUCTION_NOT_INDEPENDENT_PRIOR_SOURCE_CERTIFICATION'}})));
 const input={race:{race_id,race_date:first.race_date,track:first.track,race_no:first.race_no,post_time:first.post_time,surface:first.conditions.surface,distance:first.conditions.distance},captured_at:capturedAt,roster,history,supplemental:[]};
 const mineta=buildMinetaFacts(input);let recordedCounts={FRONT:0,SEMI:0,MID:0,REAR:0,UNKNOWN:0};
 for(const r of rs){const theory=mineta.facts.get(r.horse_ref);recordedCounts[theory.mineta_T01.value.recorded_style]++;
  for(const [criterion,f] of Object.entries(theory))audit.push({race_id,horse_no:r.horse_no,horse_name:r.horse_name,criterion,condition_status:f.status,condition_matched:f.matched,details:f.value,evidence:f.evidence,missing:f.missing,points:null,score_status:'BLOCKED_UNAPPROVED_RUBRIC',formal_eye_status:'NOT_PERFORMED',source_before_reference_freeze:Date.parse(r.source_checked_at)<=Date.parse(r.frozen_at),provenance:'PREPOST_RECONSTRUCTION_NOT_FROZEN_INPUT'});
  horseRows.push({race_id,horse_no:r.horse_no,horse_name:r.horse_name,baseline_rank:r.rank_before,baseline_score:r.score_before,recorded_style:theory.mineta_T01.value.recorded_style,verified_style:theory.mineta_T01.value.style,corner_gain:theory.mineta_T01.value.corner_gain,late_advance:theory.mineta_T01.value.late_advance,style_reason:theory.mineta_T01.missing.join('|'),distance_change:theory.mineta_T06.value.change_m,first_surface:theory.mineta_T08.value.first_target_surface,full_history_verified:theory.mineta_T08.value.full_history_verified,v2_score:null,v2_rank:null,v2_eye:null,formal_status:'BLOCKED_NO_APPROVED_RUBRIC_AND_NO_ACTUAL_EYE_REVIEW'});
 }
 raceResults.push({race_id,horses:rs.length,style_coverage:mineta.style_coverage,front_share:mineta.share,recorded_style_counts:recordedCounts,baseline_outside_pool:rs.filter(r=>r.rank_before>5).map(r=>r.horse_no),pool_basis:'BASELINE_FOR_COVERAGE_NOT_V2_FINAL_RANK',required_pair_count:(rs.length-5)*(rs.length-6)/2,actual_pair_reviews:0,v2_score_status:'BLOCKED_UNAPPROVED_RUBRIC',v2_eye_status:'NOT_PERFORMED',raw_early_average_preserved:true,legacy_normalized_ratio_preserved:true});
}
const decision={version:VERSION,spec_commit:SPEC_COMMIT,batch:no,races:byRace.size,horses:rows.length,source_file_sha256:createHash('sha256').update(sourceFile).digest('hex'),source_archive_sha256:feature.archive_sha256,
 created_at:new Date().toISOString(),exploratory_already_observed_cohort:true,independent_holdout:false,v2_scoring:'BLOCKED_UNAPPROVED_RUBRIC',v2_eye:'NOT_PERFORMED',save_authorized:false,race_results:raceResults,horse_results:horseRows,legacy_prediction:baselinePrediction};
const lockPath=new URL(stem+'.selection-lock.json',dir);writeFileSync(lockPath,JSON.stringify(decision,null,2)+'\n',{flag:'wx'});events.push('SELECTION_LOCK_WRITTEN');const lockHash=createHash('sha256').update(readFileSync(lockPath)).digest('hex');
if(!existsSync(lockPath))throw Error('SELECTION_NOT_LOCKED');
const label=load('labels');const legacy=measureReplay(baselinePrediction,label.rows);const {rows:legacyDetails,per_race,...legacySummary}=legacy;
const report={version:VERSION,batch:no,source_archive_sha256:feature.archive_sha256,source_member_sha256:feature.member_sha256,selection_lock_sha256:lockHash,
 races:byRace.size,horses:rows.length,audit_items:audit.length,mineta_items:rows.length*14,style_coverage:raceResults.reduce((n,r)=>n+r.style_coverage,0),
 confirmed_shortage:'Stored histories lack race_type and independently certified prior source hashes; source flags are NOT auto-promoted.',
 v2_metrics:{score_changed_horses:null,rank_changed_horses:null,eye_changed_races:null,new_captures:null,lost_captures:null},v2_status:'BLOCKED_SCORING_FORMAL_EYE_NOT_PERFORMED',
 dependency_ablation:{atomic_score:null,strict_score:null,status:'BLOCKED_APPROVED_RUBRIC_ABSENT'},legacy_reference:legacySummary,
 condition_coverage:Object.fromEntries([...new Set(audit.map(r=>r.criterion))].map(id=>[id,{rows:audit.filter(r=>r.criterion===id).length,observed_matched:audit.filter(r=>r.criterion===id&&r.condition_matched===true).length,available:audit.filter(r=>r.criterion===id&&(r.condition_status??r.acquisition_status)==='AVAILABLE').length}])),events:[...events,'MEASUREMENT_WRITTEN'],production_changed:false};
writeFileSync(new URL(stem+'.summary.json',dir),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const payload={version:VERSION,batch:no,decision,report,audit,legacy_comparison:legacyDetails};const bytes=Buffer.from(JSON.stringify(payload));
const compressed=gzipSync(bytes);if(gunzipSync(compressed).compare(bytes)!==0)throw Error('COMPRESS_ROUNDTRIP');
writeFileSync(new URL(stem+'.audit.payload.json',dir),JSON.stringify({format:'BAKEN_V2_AUDIT_GZIP_BASE64_V1',uncompressed_sha256:digest(payload),data:compressed.toString('base64')})+'\n',{flag:'wx'});
const csvCols=['race_id','horse_no','horse_name','baseline_rank','baseline_score','recorded_style','verified_style','corner_gain','distance_change','first_surface','full_history_verified','v2_score','v2_rank','v2_eye','formal_status'];const esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';
writeFileSync(new URL(stem+'.csv',dir),csvCols.join(',')+'\n'+horseRows.map(r=>csvCols.map(k=>esc(r[k])).join(',')).join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({batch:no,races:byRace.size,horses:rows.length,audit_items:audit.length,verified_styles:report.style_coverage,legacy_captures:legacySummary.captures,v2_metrics:report.v2_metrics,events:report.events}));
