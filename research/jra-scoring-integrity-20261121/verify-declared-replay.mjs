// Offline determinism of recorded numeric decisions, NOT recovery of an ability formula.
import fs from 'node:fs';
import {collectDeclaredLedger,sha} from '../../automation/jra-score-ledger/declared-ledger.mjs';
import {checkDeclaredLedger} from '../../automation/jra-score-ledger/independent-check.mjs';
const root=new URL('.',import.meta.url);
const records=JSON.parse(fs.readFileSync(new URL('observations/nov21-afternoon-extract.json',root)));
const output=[];
for(const r of records){
 const input={payload:r.payload,prediction_id:r.id,race:{race_date:r.race_date,track:r.track,race_no:r.race_no,post_time:r.post_time,frozen_at:r.frozen_at}};
 const before=sha(input),a=collectDeclaredLedger(input),b=collectDeclaredLedger(input);
 // Integer accumulation must not depend on evidence processing order.
 for(const h of b.runners)h.components.reverse();
 const ca=checkDeclaredLedger({ledger:a,payload:r.payload}),cb=checkDeclaredLedger({ledger:b,payload:r.payload});
 if(!ca.ok||!cb.ok)throw Error('DECLARED_ARITHMETIC_INVALID:'+r.id);
 const rank=check=>check.per_runner.map(h=>({horse_no:h.horse_no,score:h.final_recomputed,previous_rank:a.runners.find(x=>x.horse_no===h.horse_no).review_rank})).sort((x,y)=>y.score-x.score||x.previous_rank-y.previous_rank||x.horse_no-y.horse_no).map((h,i)=>({horse_no:h.horse_no,score:h.score,rank:i+1}));
 if(!a.has_bridge||a.runners.some(h=>!Number.isInteger(h.review_rank)))throw Error('DEPLOYED_BRIDGE_TIE_INPUT_MISSING');
 const ra=rank(ca),rb=rank(cb),expected=r.payload.runners.slice().sort((x,y)=>x.rank-y.rank).map(h=>({horse_no:h.horse_no,score:h.score,rank:h.rank}));
 if(sha(ra)!==sha(rb)||sha(ra)!==sha(expected)||sha(input)!==before)throw Error('DECLARED_REPLAY_MISMATCH:'+r.id);
 output.push({prediction_id:r.id,race:[r.race_date,r.track,r.race_no],input_sha256:before,result_sha256:sha(ra),runner_count:ra.length,scores_match:true,ranks_match:true,component_order_invariant:true,tie_policy:'DEPLOYED_BRIDGE_SCORE_DESC_THEN_RECORDED_PREBRIDGE_RANK_THEN_HORSE_NO'});
}
const report={schema:'PR83_DECLARED_LEDGER_REPLAY_V1',scope:'HISTORICAL_RECORDED_NUMERIC_AUDIT_ONLY',races:output.length,runners:output.reduce((n,x)=>n+x.runner_count,0),replays_per_race:2,score_match_races:output.filter(x=>x.scores_match).length,rank_match_races:output.filter(x=>x.ranks_match).length,raw_pre_race_context_available:false,approved_factor_points_generator_available:false,full_ability_formula_reproduced:false,future_real_races_verified:0,production_allowed:false,unresolved:['PRE_RACE_ORIGINAL_INPUT','APPROVED_BASE_AND_FACTOR_POINTS_GENERATOR','TRUSTED_SOURCE_ID_BODY_AND_FETCH_CLOCK_RESOLVER'],per_race:output};
process.stdout.write(JSON.stringify(report,null,2)+'\n');
