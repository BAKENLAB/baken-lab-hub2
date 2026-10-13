-- Stage V1.6 inactive; activation is a separate deliberate step after deployed code verification.
WITH old AS (
 SELECT content FROM public.lab_prediction_protocols
 WHERE protocol_key='LOCAL_MAIN' AND is_active=true
   AND version='CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004'
)
INSERT INTO public.lab_prediction_protocols(protocol_key,version,is_active,content,notes)
SELECT 'LOCAL_MAIN','CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013',false,
 jsonb_set(
  jsonb_set(
   jsonb_set(content,'{lab_eye}',
    (content->'lab_eye')||jsonb_build_object(
     'definition','TOP5外全頭の独立したプラス材料を調べ、2個以上の候補のうち材料個数が最多の1頭をEYEにする。同数だけ根拠の強さ、現在性、不安材料で決着。人気オッズは使用しない。',
     'failure_guard','LOCAL_EYE_FACTOR_COUNT_V1: TOP5外全頭17項目監査は継続。肯定材料はcategory/reason/evidence_refs/current_relevanceを1件ずつ独立記録し、category重複や同じ事実の言い換えによる水増し禁止。2個以上＋現在性ある材料1個以上が資格条件。最多個数優先。同数のみ具体根拠付きtie_break。完全同等ならEYEなし。',
     'selection_pool','TOP5外全ACTIVE馬を全17項目で監査し、それぞれの肯定材料を独立計数。2個未満は選出禁止。十分な根拠がある馬がいなければeye=null。',
     'selection_method','まず全候補の17項目を照合し、肯定的で独立した事実だけpositive_factorsとして記録（category重複不可、出典と現在性必須）。2個以上かつ今回・近2走と繋がる根拠1つ以上の候補の中から個数最大を選ぶ。最多同数なら根拠強度、現在性、不安材料の順に比較理由を記録し選ぶ。完全同等ならeye=null。元順位・人気・オッズは選出理由に使わない。',
     'strength_guard',(content->'lab_eye'->'strength_guard')||jsonb_build_object(
       'minimum_case','独立した好走材料2個以上必須。同じカテゴリー・同じ根拠の言い換えは1個。現在条件または直近1～2走と繋がる材料を最低1個含む。',
       'pairwise','全候補一対比較による全勝必須条件を廃止。最多個数同数の候補に限り根拠の強さ→現在性→不安材料の順に比較し、決着した場合だけ証拠つきtie_breakを記録。'
     )
    )
   ,true),
   '{output,audit_required}',
   (content->'output'->'audit_required')||jsonb_build_object(
    'eye_selection_method','LOCAL_EYE_FACTOR_COUNT_V1',
    'eye_pairwise_comparison','V1.6は廃止、互換性のため空配列[]',
    'eye_positive_factor_audit','TOP5外全頭に正の根拠category/reason/evidence_refs/current_relevanceを独立記録、重複禁止、17項目CHECKEDと出典一致',
    'eye_tie_break','最多同数の決着時のみselected_horse_noと強さ/現在性/不安材料に関する理由・出典を記録。それ以外null。'
   ),true),
   '{workflow}',
   jsonb_build_array('取消と最新公式出走馬を確認','全ACTIVE馬の近走と今回条件を比較','人気・オッズ抜きでLAB RANK順位・S〜Fを確定','TOP5を固定','TOP5外全頭の17項目を同じ深さで確認','各候補の独立好走材料を根拠・現在性つきで数える','2個以上かつ現在性ある候補の最多個数をEYEに決定','最多同数なら強さ→現在性→不安材料の証拠で1頭選出、決着できなければEYEなし','LAB RANKは変更せず発走前FROZEN保存','保存後DBでFROZEN確認'),true),
 'Independent verified factor count; highest count first; only tied leaders compare strength/recency/risk. No historical FROZEN rewrite.'
FROM old
WHERE NOT EXISTS (SELECT 1 FROM public.lab_prediction_protocols WHERE protocol_key='LOCAL_MAIN' AND version='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013');
