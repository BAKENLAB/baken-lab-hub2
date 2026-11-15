import {EYE_FILL_VERSION} from '../../automation/jra-eye-fill-null.mjs';
import {reviewClaimContext} from '../../automation/jra-eye-additional-audit.mjs';
const now='2026-11-15T04:00:00Z';
export function fixture(){
 const runners=Array.from({length:8},(_,i)=>({horse_no:i+1,horse_name:'合成検証馬'+(i+1),rank:i+1,grade:'C',reason:'架空テスト専用の独立評価根拠です。'}));
 const history=runners.map((r,i)=>({...r,past_runs:['2026-10-01','2026-10-15'].map(d=>({race_date:d,track:'東京',surface:'芝',distance:1600,finish:2,field_size:16,early_pos:i<5?i+5:i===7?2:1,margin_to_winner:0.2}))}));
 const context={stage:'AWAITING_JRA_FULL_DEPTH_COMPARISON',protocol_version:'SYNTHETIC_TEST_ONLY',race:{race_date:'2026-11-15',track:'東京',race_no:8,post_time:'2026-11-15T06:00:00Z',field_payload:{race:{surface:'芝',distance:1600},runners:runners.map(r=>({...r,status:'ACTIVE'})),official_status_verification:{verified:true}}},runner_history:history};
 const payload={runners,top5:runners.slice(0,5),eye:null,bets:[],summary:'Synthetic fixture only',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{protocol_version:'SYNTHETIC_TEST_ONLY',all_runners_checked:true,outside_top5_reaudited:true,market_used_for_ranking:false,market_used_for_eye:false,target_result_used:false,rank6_auto_selected:false,eye_pool_checked:[6,7,8]}};
 const packet=reviewClaimContext(context,now,runners),outs=runners.slice(5);
 const review={version:EYE_FILL_VERSION,protocol_version:context.protocol_version,race:{...context.race,field_payload:undefined},evaluated_at:now,baseline_eye:null,
 all_runners:runners.map(r=>({...r,reason:'各馬を実際に独立確認した架空テスト根拠です。'})),
 outside_top5:outs.map(r=>({...r,positive_factors:[{kind:'RELATIVE_EARLY_POSITION',reason:'過去二走の序盤位置と今回全体との相対比較を確認。',independence_reason:'着順の良否ではなく序盤の位置確保の観察を独立評価。'},{kind:'NEAR_DISTANCE_PERFORMANCE',source_ref:packet.runners.find(x=>x.horse_no===r.horse_no).front_good_runs[0].source_ref,reason:'芝の近距離条件で勝ち馬との着差が小さい実績。',independence_reason:'序盤位置とは別に終点の着差と距離条件を確認した評価。'}],risks:['同型馬との競合や当日の再現性には不確実性が残る。'],missing:['未確認の不利やコース形態の効果は補完していない。'],decision_reason:'架空条件の長短を比較したテスト専用判断です。',concrete_upside_reason:'現条件で序盤位置と終点の競争力に別個の根拠がある。'})),
 comparisons:[{a:6,b:7,preferred_horse_no:null,reason:'同数の適合実績で位置平均も同じ。今回順位を補助比較する。'},{a:6,b:8,preferred_horse_no:6,reason:'適合実績数は同じだが序盤の相対位置を比較した。'},{a:7,b:8,preferred_horse_no:7,reason:'適合実績数は同じだが序盤の相対位置を比較した。'}],selected_horse_no:6,selection_reason:'実績数と位置平均を比較し、同値の馬とは既存順位で整理。'};
 payload.audit.eye_fill_review=review;return {context,payload,observedAt:now};
}
