// Independent arithmetic/order audit; compares FROZEN only after DB decisions exist.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const cohortMode=process.argv[2]==='cohorts',prefix=cohortMode?'cohorts-':'';
const root='research/jra-scoring-integrity-20261121/final-connection/batches/';
const files=fs.readdirSync(root).filter(f=>/^input-\d+\.json$/.test(f)).sort(),weights={recent_score:.30,exact_score:.17,distance_score:.12,track_score:.08,going_score:.07,transition_score:.12,jockey_score:.07};
const digest=b=>createHash('sha256').update(b).digest('hex');const summary={scope:cohortMode?'LEGACY_DB_DATE_FILTERED_COHORT_RECONSTRUCTION':'LEGACY_PARTIAL_STATISTICS_POSTHOC_RECONSTRUCTION',official_input_verified:false,official_engine_identified:false,future_race_comparisons:0,production_allowed:false,races:0,runners:0,score_changes:0,rank_changes:0,top5_changed_races:0,batches:[]};
for(const file of files){
 const n=file.match(/\d+/)[0],inputBytes=fs.readFileSync(root+file),input=JSON.parse(inputBytes);
 const cohortPacket=JSON.parse(fs.readFileSync(root+'cohorts-'+n+'.json'));
 const outputBytes=fs.readFileSync('/tmp/jra-replay-output-'+prefix+n+'.json');assert.equal(outputBytes.toString(),fs.readFileSync('/tmp/jra-replay-output-'+prefix+n+'-repeat.json','utf8'),'repeat output drift');
 const output=JSON.parse(outputBytes);assert.equal(output.length,input.rows.length);
 const keys=new Set();for(const r of output){
  const key=r.live_runner_id;assert(!keys.has(key));keys.add(key);
  assert(input.rows.some(x=>x.live_runner_id===key&&x.horse_no===r.horse_no));
  let num=0,den=0;for(const [k,w] of Object.entries(weights))if(r[k]!==null){assert(Number.isFinite(r[k]));num+=r[k]*w;den+=w;}
  if(!den)assert.equal(r.legacy_score,null);else {const value=Math.max(0,Math.min(100,num/den));assert(Math.abs(r.score-value)<1e-7,'component sum');assert(Math.abs(r.legacy_score-value)<=.0050001,'SQL 2-place rounding');}
  for(const [kind,column,shrink] of [['transition','transition_score',20],['jockey','jockey_score',30]]){
   const c=cohortMode?cohortPacket[kind].find(x=>x.live_runner_id===r.live_runner_id):null;
   if(!c)assert.equal(r[column],null,'unconnected cohort not imputed');
   else {const expected=Math.max(0,Math.min(100,50+(Math.max(15,Math.min(90,25+110*c.top3s/c.n+30*c.wins/c.n))-50)*c.n/(c.n+shrink)));assert(Math.abs(r[column]-expected)<1e-7,'cohort formula independent recomputation');}
  }
 }
 // Only now read saved-score comparator; never supplies features or coefficients.
 const comparator=JSON.parse(fs.readFileSync(root+'comparator-'+n+'.json')).rows;
 assert.equal(comparator.length,output.length);const grouped=new Map();for(const r of output)grouped.set(r.live_race_id,[...(grouped.get(r.live_race_id)||[]),r]);
 const batch={batch:Number(n),input_sha256:digest(inputBytes),decision_sha256:digest(outputBytes),races:grouped.size,runners:output.length,repeat_byte_identical:true,rows:[]};
 const priority={RANKED:0,REFERENCE:1,DATA_INSUFFICIENT:2};
 for(const [id,rs] of grouped){
  const sorted=rs.slice().sort((a,b)=>priority[a.data_status]-priority[b.data_status]||(b.legacy_score??-Infinity)-(a.legacy_score??-Infinity)||a.horse_no-b.horse_no);
  const old=comparator.filter(x=>input.rows.some(y=>y.live_race_id===id&&y.track===x.track&&y.race_no===x.race_no&&y.horse_no===x.horse_no));
  assert.equal(old.length,rs.length);const old5=old.filter(x=>x.runner.rank<=5).map(x=>x.horse_no).sort((a,b)=>a-b),new5=sorted.filter(x=>x.legacy_score!==null).slice(0,5).map(x=>x.horse_no).sort((a,b)=>a-b);
  if(JSON.stringify(old5)!==JSON.stringify(new5))summary.top5_changed_races++;
  for(let i=0;i<sorted.length;i++){
   const r=sorted[i],c=old.find(x=>x.horse_no===r.horse_no);assert(c?.runner);assert.equal(c.runner.horse_name,r.horse_name);
   const researchRank=r.legacy_score===null?null:i+1;if(c.runner.score!==r.legacy_score)summary.score_changes++;if(c.runner.rank!==researchRank)summary.rank_changes++;
   batch.rows.push({race_date:r.race_date,track:r.track,race_no:r.race_no,horse_no:r.horse_no,horse_name:r.horse_name,reconstruction_score:r.legacy_score,research_rank:researchRank,frozen_score:c.runner.score,frozen_rank:c.runner.rank,data_status:r.data_status,components:Object.fromEntries(Object.keys(weights).map(k=>[k,r[k]])),missing_components:Object.keys(weights).filter(k=>r[k]===null),official_rank:null});
  }
 }
 for(const row of batch.rows)console.log('REPLAY_DECISION_ROW '+JSON.stringify({mode:cohortMode?'cohorts':'history_only',batch:Number(n),...row}));
 summary.races+=grouped.size;summary.runners+=output.length;summary.batches.push(batch);
}
assert.equal(summary.races,13);assert.equal(summary.runners,194);
fs.writeFileSync('/tmp/jra-legacy-replay-'+(cohortMode?'cohorts-':'')+'comparison.json',JSON.stringify(summary,null,2)+'\n');
console.log('PASS legacy replay '+(cohortMode?'cohorts':'history_only'),summary.races,'races',summary.runners,'runners; two executions identical; independent arithmetic; no formal predictions');
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary).filter(([k])=>k!=='batches')),null,2));
