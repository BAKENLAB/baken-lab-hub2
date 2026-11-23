// Replays submitted arithmetic, never infers base/factor points from race facts.
import {readFileSync,writeFileSync} from 'node:fs';
import {collectDeclaredLedger,sha} from '../../../automation/jra-score-ledger/declared-ledger.mjs';
import {checkDeclaredLedger} from '../../../automation/jra-score-ledger/independent-check.mjs';
const dir=new URL('./',import.meta.url);
const races=[1,2].flatMap(i=>JSON.parse(readFileSync(new URL('morning-20261122-part-'+i+'.json',dir),'utf8')).rows);
const outputs=races.map(r=>{
 const ledger=collectDeclaredLedger({payload:r.payload,prediction_id:r.id,race:{race_date:r.race_date,track:r.track,race_no:r.race_no}});
 const check=checkDeclaredLedger({ledger,payload:r.payload});
 const outside=r.payload.runners.filter(h=>h.rank>5);
 const reviews=r.payload.audit.eye_review;
 const eyes=Array.isArray(reviews)?reviews:[];
 const kindTotals={};for(const h of ledger.runners)for(const c of h.components)kindTotals[c.kind]=(kindTotals[c.kind]??0)+c.points;
 const generated=check.per_runner.map(x=>({horse_no:x.horse_no,score:x.final_recomputed,before_rank:ledger.runners.find(h=>h.horse_no===x.horse_no).review_rank})).sort((a,b)=>b.score-a.score||a.before_rank-b.before_rank||a.horse_no-b.horse_no);
 const rankDifferences=generated.map((h,i)=>({horse_no:h.horse_no,computed_rank:i+1,saved_rank:ledger.runners.find(x=>x.horse_no===h.horse_no).rank})).filter(h=>h.computed_rank!==h.saved_rank);
 const out={prediction_id:r.id,track:r.track,race_no:r.race_no,payload_sha256:sha(r.payload),frozen_before_post:Date.parse(r.frozen_at)<Date.parse(r.post_time),runners:ledger.runners.length,arithmetic_ok:check.ok,errors:check.errors,declared_score_rank_replay_ok:rankDifferences.length===0,rank_differences:rankDifferences,
  score_rows:check.per_runner.map(x=>({...x,rank:ledger.runners.find(h=>h.horse_no===x.horse_no).rank,grade:ledger.runners.find(h=>h.horse_no===x.horse_no).grade})),
  declared_factor_totals:kindTotals,eye_selected:r.payload.eye!==null,outside_count:outside.length,
  outside_review_records:outside.filter(h=>eyes.some(e=>e.horse_no===h.horse_no)).length,
  explicit_17_item_reviews:outside.filter(h=>eyes.some(e=>e.horse_no===h.horse_no&&e.review_checks&&Object.keys(e.review_checks).length>=17)).length,
  eye_pairwise_records:Array.isArray(r.payload.audit.eye_pairwise_comparison)?r.payload.audit.eye_pairwise_comparison.length:0,
  full_raw_facts_score_reproduced:false,official_context_original_available:false};
 return out;
});
const result={schema:'MORNING_81_DECLARED_ARITHMETIC_REPLAY',races:outputs.length,runners:outputs.reduce((n,r)=>n+r.runners,0),arithmetic_pass_races:outputs.filter(r=>r.arithmetic_ok).length,arithmetic_pass_runners:outputs.reduce((n,r)=>n+(r.arithmetic_ok?r.runners:0),0),full_raw_facts_score_reproduced:0,formal_engine_recovered:false,production_allowed:false,rows:outputs};
writeFileSync(new URL('morning-replay-results.json',dir),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({races:result.races,runners:result.runners,pass_races:result.arithmetic_pass_races,pass_runners:result.arithmetic_pass_runners,errors:outputs.flatMap(r=>r.errors),raw_facts_reproduced:0}));
if(result.races!==6||result.runners!==81||outputs.some(r=>!r.arithmetic_ok||!r.declared_score_rank_replay_ok||!r.frozen_before_post))process.exitCode=1;
