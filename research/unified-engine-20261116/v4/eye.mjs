// Full reconstruction review, not a forged historical prepost review.
const n=x=>typeof x==='number'&&Number.isFinite(x);const good=h=>h.baseline.finish<=3||(n(h.baseline.margin_to_winner)&&h.baseline.margin_to_winner<=.6);
export function reviewHorse(r,f){const positives=[],risks=[],missing=[];
 for(const h of f.scoring_priors){const p=h.baseline,a=h.archive,relevance=p.surface===r.conditions.surface&&Math.abs(p.distance-r.conditions.distance)<=200;if(!relevance)continue;
  if(good(h))positives.push({mechanism:'distance_performance',root:a.race_id,atom:a.run_id+':finish',strength:(p.field_size-p.finish)/Math.max(1,p.field_size-1),reason:`${p.race_date} ${p.track}${a.race_no}R ${p.distance}m ${p.finish}着${n(p.margin_to_winner)?' 差'+p.margin_to_winner+'秒':''}; 今回${r.conditions.distance}mと同一馬場・差200m以内。`,current_relevance:'確認した距離帯・馬場での実走成績。クラス差/出走間隔は別リスク。'});
  if(h.relative3f_verified&&a.final3f_rank<=3)positives.push({mechanism:'relative_finishing_speed',root:a.race_id,atom:a.run_id+':final3f_rank',strength:1-(a.final3f_rank-1)/Math.max(1,a.field_size-1),reason:`${p.race_date} ${p.track}${a.race_no}R 全${a.field_size}頭上がり検証、${a.final3f_rank}位。今回と同一馬場・距離帯。`,current_relevance:'同距離帯での相対終い能力。展開が再現する保証はない。'});
  if(h.positions_verified&&p.corner_positions.length>=3&&p.early_pos-p.final_turn_pos>=2)positives.push({mechanism:'positional_progress',root:a.race_id,atom:a.run_id+':corner_progress',strength:(p.early_pos-p.final_turn_pos)/p.field_size,reason:`${p.race_date} ${p.track}${a.race_no}R 通過${p.corner_positions.join('-')}、前半から最終まで${p.early_pos-p.final_turn_pos}番手進出。`,current_relevance:'今回と近い距離の道中進出実績。長く脚を使った生理的能力までは断定しない。'});
 }
 // Maximal evidence choice across DIFFERENT priors and mechanisms. No rank gate.
 let chosen=[];for(const a of positives)for(const b of positives)if(a.mechanism!==b.mechanism&&a.root!==b.root&&a.atom!==b.atom&&a.strength+b.strength>chosen.reduce((s,x)=>s+x.strength,0))chosen=[a,b];
 if(f.scoring_priors.length<2)missing.push(`確認平地実走${f.scoring_priors.length}件。独立2因子の異なる実走証拠が不足。`);
 if(chosen.length<2)missing.push('今回に関連する異なるmechanism・異なる実走の肯定証拠2件が揃わない。');
 const latest=f.scoring_priors[0];if(latest)risks.push(`最新の確認実走${latest.baseline.race_date}からの日数${Math.round((Date.parse(r.race_date)-Date.parse(latest.baseline.race_date))/86400000)}。より新しい未検証履歴の有無は別記。`);
 const unresolved=f.priors.filter(p=>p.match_status!=='MATCHED'||!p.evaluation_eligible);if(unresolved.length)missing.push(`元履歴に未採用/未確認${unresolved.length}件。評価材料を網羅した保証はない。`);
 risks.push('当日変更状態の最新再照合は未実施。調教・不利・馬体の健康状態は推定しない。');
 return {horse_no:r.horse_no,horse_name:r.horse_name,positive_candidates:positives,independent_positives:chosen,eligible:chosen.length>=2,strength:chosen.reduce((s,x)=>s+x.strength,0),risks,missing,reason:chosen.length>=2?'今回条件と関連する異なる実走・異なる2mechanismを照合した。候補全組比較へ進む。':'独立した肯定証拠2件が不足し、選出対象にしない。',performed:true};
}
export function selectEye(rows,top5){const outside=rows.filter(h=>!top5.includes(h.horse_no)),comparisons=[];for(let i=0;i<outside.length;i++)for(let j=i+1;j<outside.length;j++){const a=outside[i],b=outside[j];comparisons.push({a:a.horse_no,b:b.horse_no,reason:`${a.horse_no}番は独立根拠${a.eye_review.independent_positives.length}件・比較値${a.eye_review.strength.toFixed(4)}・未確認${a.eye_review.missing.length}項目、${b.horse_no}番は独立根拠${b.eye_review.independent_positives.length}件・比較値${b.eye_review.strength.toFixed(4)}・未確認${b.eye_review.missing.length}項目。比較値は上振れ根拠の研究用優先順で、好走保証や絶対優位ではない。`});}
 const ok=outside.filter(h=>h.eye_review.eligible).sort((a,b)=>b.eye_review.strength-a.eye_review.strength),tie=ok.length>1&&Math.abs(ok[0].eye_review.strength-ok[1].eye_review.strength)<1e-12,selected=ok.length&&!tie?ok[0].horse_no:null;
 return {research_eye:selected,reconstruction_audit_complete:true,all_outside_checked:outside.map(h=>h.horse_no),comparisons,reason:selected?`${selected}番の異なる実走による独立肯定2因子を確認し、全${comparisons.length}組の比較後に研究用優先順で選出。`:tie?'独立因子はあるが比較が同点で選出を保留。':'TOP5外に独立肯定2因子を満たす候補なし。',strict_formal_eye:null,strict_status:'BLOCKED_NO_IMMUTABLE_INPUT_AND_NO_PREPOST_REVIEW',review_created_after_event:true,rank6_auto_selected:false,production_allowed:false};
}
