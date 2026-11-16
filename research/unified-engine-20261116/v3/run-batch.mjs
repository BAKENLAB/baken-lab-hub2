// One invocation, <=5 races. No network or DB writes. Private Eval cache optional.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readBatch} from '../v2/read-batch.mjs';
import {readPacket,enrichHorse,key,sha} from './enrich.mjs';
import {auditHorse,wholeRace,ROUTES} from './routes.mjs';
import {proposedClaims,scoreInterval,intervalRanks,POLICY} from './rubric.mjs';
import {verifyEvalCache,evalForHorse} from './eval.mjs';
import {connectFormalEye} from './formal-eye.mjs';
import {readSupplemental,supplementalForHorse,rivalsForHorse} from './supplemental.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const n=Number(process.argv[2]);if(!Number.isInteger(n)||n<1||n>10)throw Error('BATCH_1_TO_10_REQUIRED');
const stem='batch-'+String(n).padStart(2,'0');
const dir=process.argv.includes('--output-dir')?resolve(process.argv[process.argv.indexOf('--output-dir')+1]):root+'v3/validation';mkdirSync(dir,{recursive:true});
for(const ext of ['lock.json','summary.json','audit.payload.json'])if(existsSync(dir+'/'+stem+'.'+ext))throw Error('CHECKPOINT_EXISTS');
const baseline=root+'restoration/batches/'+stem+'.payload.json',feature=readBatch(baseline,'features'),packet=readPacket(root+'v3/enrichment/'+stem+'.payload.json');
const rivalPacket=readPacket(root+'v3/enrichment/'+stem+'.rivals.payload.json');const supplements=readSupplemental(process.argv.includes('--supplemental')?process.argv[process.argv.indexOf('--supplemental')+1]:null);
const events=['FEATURES_READ','ENRICHMENT_READ','RIVAL_FEATURES_READ'];let cache=null,evalManifest=null;
if(process.argv.includes('--eval-cache')){cache=(await import(pathToFileURL(resolve(process.argv[process.argv.indexOf('--eval-cache')+1])))).PRIVATE_EVAL_PRIORITIES;evalManifest=verifyEvalCache(cache);}
const byRace=new Map();for(const r of feature.rows){const id=[r.race_date,r.track,r.race_no].join('/');byRace.set(id,(byRace.get(id)||[]).concat(r));}if(byRace.size>5)throw Error('BATCH_TOO_LARGE');
const facts=new Map(),audit=[],decisions=[],priorAudit=[];
for(const [race_id,raw] of byRace){
 // Whitelist drops old score/rank/EYE/combined/sql outputs before independent work.
 const rs=raw.map(r=>Object.fromEntries(['race_date','track','race_no','horse_no','horse_name','horse_ref','conditions','post_time','frozen_at','source_checked_at','history_updated_at','past_runs'].map(k=>[k,r[k]])));
 const fs=new Map();for(const r of rs){const f=enrichHorse(r,packet.rows);f.rivals=rivalsForHorse(r,f,rivalPacket.rows);f.supplemental=supplementalForHorse(r,supplements);fs.set(r.horse_no,f);facts.set(key(r),f);priorAudit.push(...f.priors.map(p=>({race_id,horse_no:r.horse_no,index:p.index,match_status:p.match_status,reason:p.reason,flat:p.flat,relative3f_verified:p.relative3f_verified,race_type_status:p.race_type_status??'UNKNOWN',archive_race_date:p.archive?.race_date??null,baseline_race_date:p.baseline.race_date,timestamp_before_frozen:p.timestamp_consistent_before_frozen??false,strict_frozen_input_proven:false,archive_run_id:p.archive?.run_id??null})));}
 const whole=wholeRace(rs,fs),ranked=intervalRanks(rs.map(r=>{const f=fs.get(r.horse_no),ev=evalForHorse(r,f,cache,evalManifest);audit.push(...auditHorse(r,f,whole,{evalFact:ev}).map(a=>({...a,race_id})));const claims=proposedClaims(r,f);return {horse_no:r.horse_no,horse_id:r.horse_ref,horse_name:r.horse_name,interval:scoreInterval(claims),cap_alternatives:POLICY.dependency_caps.map(raceCap=>scoreInterval(claims,{raceCap}))};}));
 const eye=connectFormalEye({race:{race_id},ranked,strict_input_attested:false});
 decisions.push({race_id,horses:ranked,full_field_early_verified:whole.earlyComplete,full_latest_style_verified:whole.latestComplete,formal_eye:eye,ranking_status:ranked.every(r=>r.rank!==null)?'DEVELOPMENT_COMPLETE_NOT_PRODUCTION_APPROVED':'BLOCKED_INTERVALS_OVERLAP',save_authorized:false});
}
const decision={spec_commit:'07ca810100f2fa180a5b3a036f2eaf61f21842db',version:'BAKEN_UNIFIED_RESEARCH_ENGINE_0.3',mode:POLICY.status,batch:n,races:byRace.size,horses:feature.rows.length,created_at:new Date().toISOString(),observed_at:packet.observed_at,feature_sha256:feature.member_sha256,enrichment_sha256:packet.sha256,rival_enrichment_sha256:rivalPacket.sha256,rubric_sha256:sha(readFileSync(new URL('rubric.mjs',import.meta.url))),routes:ROUTES.map(x=>x.id),eval_manifest:evalManifest,decisions,save_authorized:false,strict_frozen_input_proven:false,independent_holdout:false};
writeFileSync(dir+'/'+stem+'.lock.json',JSON.stringify(decision,null,2)+'\n',{flag:'wx'});events.push('DECISION_LOCK_WRITTEN');const decisionHash=sha(readFileSync(dir+'/'+stem+'.lock.json'));
// Labels, V2 legacy comparisons and old selection references are accessed only now.
const label=readBatch(baseline,'labels');events.push('LABELS_READ');
const oldPayload=JSON.parse(readFileSync(root+'v2/validation/'+stem+'.audit.payload.json'));
const old=JSON.parse(gunzipSync(Buffer.from(oldPayload.data,'base64')));const oldLogs=old.audit;
const coverage=Object.fromEntries(ROUTES.map(c=>{const after=audit.filter(l=>l.id===c.id),before=oldLogs.filter(l=>l.criterion===c.id);return [c.id,{rows:after.length,before_available:before.filter(l=>(l.condition_status??l.acquisition_status)==='AVAILABLE').length,before_matched:before.filter(l=>l.condition_matched===true).length,after_available:after.filter(l=>l.acquisition==='AVAILABLE').length,after_matched:after.filter(l=>l.decision==='MATCHED').length,after_not_matched:after.filter(l=>l.decision==='NOT_MATCHED').length,after_unknown:after.filter(l=>l.decision==='UNKNOWN').length,after_excluded:after.filter(l=>l.decision==='EXCLUDED').length,comparison_warning:'V2 raw observational availability vs V3 cross-source/asof gates; not identical certification thresholds'}];}));
const summary={batch:n,races:byRace.size,horses:feature.rows.length,audit_items:audit.length,prior_rows:priorAudit.length,matched_priors:priorAudit.filter(p=>p.match_status==='MATCHED').length,conflicting_priors:priorAudit.filter(p=>p.match_status==='CONFLICT').length,missing_priors:priorAudit.filter(p=>p.match_status==='UNKNOWN').length,confirmed_flat_priors:priorAudit.filter(p=>p.flat).length,verified_relative3f:priorAudit.filter(p=>p.relative3f_verified).length,archive_newer_than_cutoff:priorAudit.filter(p=>p.baseline_race_date>'2026-09-13').length,strict_asof_attested:0,reconstruction_horses:feature.rows.length,current_history_after_reference_freeze:feature.rows.filter(r=>Date.parse(r.source_checked_at)>Date.parse(r.frozen_at)||Date.parse(r.history_updated_at)>Date.parse(r.frozen_at)).length,rival_followup_observations:[...facts.values()].reduce((n,f)=>n+f.rivals.length,0),coverage,decision_sha256:decisionHash,events,legacy_reference:old.report.legacy_reference,v3_metrics:{definitive_scored_horses:decisions.flatMap(d=>d.horses).filter(h=>h.interval.definitive_score!==null).length,partial_interval_horses:decisions.flatMap(d=>d.horses).filter(h=>h.interval.coverage_budget>0).length,definitive_ranked_horses:decisions.flatMap(d=>d.horses).filter(h=>h.rank!==null).length,score_changed_horses:null,rank_changed_horses:null,eye_changed_races:null,new_captures:null,lost_captures:null,reason:'No definitive independent rank / strict input / actual formal EYE review; no substituted baseline ranking.'},labels_separate:true,production_changed:false};
const all={decision,summary,audit,priorAudit};const bytes=Buffer.from(JSON.stringify(all));writeFileSync(dir+'/'+stem+'.audit.payload.json',JSON.stringify({format:'BAKEN_V3_AUDIT_GZIP_BASE64_V1',sha256:sha(bytes),data:gzipSync(bytes).toString('base64')})+'\n',{flag:'wx'});writeFileSync(dir+'/'+stem+'.summary.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({batch:n,races:summary.races,horses:summary.horses,matched:summary.matched_priors,flat:summary.confirmed_flat_priors,conflicts:summary.conflicting_priors,audit_items:audit.length,events}));
