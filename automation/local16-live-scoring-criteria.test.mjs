import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLocal16LiveScoringCriteria as build} from './local16-live-scoring-criteria.mjs';
const names=["近5走を基本とした着順・着差","通過順・位置取り・上がり・不利","クラス実績と昇級/降級/クラス戻り","距離実績・距離延長短縮・距離戻り","競馬場実績・同条件実績","馬場適性","枠順・1角までの距離・脚質・同型馬","斤量・減量騎手","騎手/騎手替わり","休み明け・叩き何走目","馬体重・馬具（取得できる場合）","当日馬場傾向（取得できる場合）","今回条件で実際に走れる具体的な勝ち筋/好走筋"];
const tr=["転入前の最高到達クラス","着順だけでなく着差・位置取り・走破内容","今回の地方クラスとの能力差","距離変更","小回り・先行力への適応可能性","斤量変化","初戦ゆえの不確実性"];
const protocolContent={runner_review:{required_checks:names},transfer_audit:{checks:tr}};
const context={context_format:"COMPACT_V1",field_integrity_checked:true,protocol_version:"CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013",race:{race_date:"2026-11-17",track:"大井",circuit:"LOCAL",conditions:{distance:1600,surface:"ダート",going:"不良",class_name:"C3"}},runners:[
{horse_no:1,horse_name:"SYNTHETIC_A",jockey:"K1",weight_carried:55,draw:1,recent_runs:[{race_date:"2026-11-01",track:"大井",race_no:3,finish:4,margin:"0.5",distance:1600,surface:"ダート",going:"不良",final3f:39.2,early_pos:3,final_turn_pos:3,race_name:"C3",jockey:"K2"}]},
{horse_no:2,horse_name:"SYNTHETIC_B",recent_runs:[{race_date:"2026-11-01",track:"大井",race_no:3,finish:2,margin:"0.2",distance:1600,surface:"ダート",race_name:"C3"}]},
{horse_no:3,horse_name:"SYNTHETIC_C",recent_runs:[]}
]};
const run=(h,i)=>({race_date:h.race_date,track:h.track,race_no:h.race_no,finish:h.finish,raw_margin:h.margin,distance:h.distance,going:h.going,surface:h.surface,race_name:h.race_name,early_pos:h.early_pos??null,final_turn_pos:h.final_turn_pos??null,final3f_seconds:h.final3f??null,evidence_ref:'COMPACT_V1.runners[horse_no='+i+'].recent_runs[0]'});
const facts={status:'VERIFIED_WHOLE_FIELD_FACTS',market_used:false,target_result_used:false,head_to_head:[{horse_nos:[1,2],refs:['COMPACT_V1.runners[horse_no=1].recent_runs[0]','COMPACT_V1.runners[horse_no=2].recent_runs[0]']}],per_runner:context.runners.map(h=>({horse_no:h.horse_no,horse_name:h.horse_name,runs:h.recent_runs.map((x,i)=>run(x,h.horse_no,i))}))};
const review={status:'READY_FOR_LOCAL_1_6_FULL_FIELD_REVIEW',score_or_rank_override:false,per_runner_coverage:context.runners.map(h=>({horse_no:h.horse_no,horse_name:h.horse_name}))};
const valid=()=>({context:structuredClone(context),protocolContent:structuredClone(protocolContent),facts:structuredClone(facts),review:structuredClone(review)});
test('official 13+7 criteria and full runners remain unscored, zero automatic rank effect',()=>{const a=build(valid());assert.equal(a.status,'READY_FOR_INDEPENDENT_100_POINT_SCORING');assert.equal(a.rows.length,3);assert.equal(a.rows[0].criteria.length,13);assert.equal(a.rows[1].transfer_review.length,7);assert.equal(a.score_effect,0);assert.equal(a.score_computed,false);assert.equal(a.rank_effect,false);assert.equal(a.rows[0].direct_opponent_pairs,1)});
test('missing history is not falsely marked available',()=>{const a=build(valid());assert.equal(a.rows[2].criteria[0].data_state,'MISSING_INPUT');assert.equal(a.rows[1].criteria[1].data_state,'MISSING_INPUT');assert.equal(a.rows[2].criteria[11].data_state,'MISSING_INPUT')});
test('original criterion order cannot drift without failing closed',()=>{const a=valid();a.protocolContent.runner_review.required_checks.reverse();assert.equal(build(a).status,'NOT_READY');assert.match(build(a).reason,/PROTOCOL/)});
test('transfer criterion order cannot drift without failing closed',()=>{const a=valid();a.protocolContent.transfer_audit.checks.reverse();assert.equal(build(a).status,'NOT_READY')});
test('no target day or post-start history',()=>{const a=valid();a.context.runners[0].recent_runs[0].race_date=a.context.race.race_date;a.facts.per_runner[0].runs[0].race_date=a.context.race.race_date;assert.equal(build(a).status,'NOT_READY')});
test('reject cross-horse history references',()=>{const a=valid();a.facts.per_runner[0].runs[0].evidence_ref='COMPACT_V1.runners[horse_no=2].recent_runs[0]';assert.equal(build(a).status,'NOT_READY')});
test('decline if whole field facts were not verified',()=>{const a=valid();a.facts.status='UNAVAILABLE';assert.equal(build(a).status,'NOT_READY')});
test('no official receipt marked as full race laps or opponent future strength',()=>{const a=build(valid());assert.equal(a.rows[0].full_laps,'NOT_VERIFIED');assert.equal(a.rows[0].opponent_followup,'NOT_VERIFIED');assert.equal(a.score_computed,false)});
