# 38監査項目と実際の数値利用

監査ラベル・対応する配点枠・採点函数が読む値は必ずしも同じではない。未実装/共有経路の理論の純効果は識別しない。元コードを変更した結果ではなく、固定V4の呼び出し箇所を調査した。

|項目|資料あり|該当判定|監査上の対応枠|実利用と制約|
|---|---|---|---|---|
|recent_form|577|464|comparable_form|近走15点は比較可能な最新1走の連続品質。監査の好走Booleanそのものではない。|
|same_class|577|0|class|クラス8点は経験クラスのordinal露出差。SAME_CLASS_CLOSEを直接採点していない。|
|near_distance|577|398|distance_stamina|近距離条件は近走の抽出等に利用。距離10点自体は同等以上距離の成績。|
|same_track|577|159|course_affinity|コース10点のうち自競馬場部分8点。全枠除去はEvalも消すので純効果ではない。|
|relative_early|70|18|early_reproduction|監査は全ACTIVE内dense_rank。採点8点は馬ごとの過去前半位置平均で、今回field dense_rankを数値利用していない。|
|front_hold|577|201|projected_pace|先行して好走というBooleanは数値式へ直接渡らず、ラップ条件下進出proxyとは同義でない。|
|long_turf|577|338|distance_stamina|距離10点の同等以上距離抽出と関連。近走/安定性と同じ着順atomは抑制される。|
|position_gain|577|349|sustained_effort|進出は持続proxyとEYEで共有するが、前半→最終と中間→最終では範囲が違う。|
|eval_course|185|0|course_affinity|コース10点内の2点component。単独除去で識別する。|
|incident|0|0|なし|公式不利原文未接続、数値利用なし。|
|rival_followup|482|0|rival_followup|直接相手の次走平均成績。対象馬が相手に先着したことや因果的強さを必須にしていない露出proxy。|
|race_pace|574|0|projected_pace|展開点ではfirst600/last600でscenario抽出。持続点ではラップの存在/形式チェックであり数値の良否を直接加点していない。|
|last3f|570|307|relative_last3f|数値点は確認走の相対上がり平均、EYEは今回同馬場±200mの上がり3位内。別経路。|
|stamina|0|0|sustained_effort|正式な持続力証拠なし。位置取りproxyの加点をスタミナ確認済みと呼ばない。|
|distance_change|195|0|distance_stamina|短縮/延長deltaは監査値。数値式は今回距離との比較で、delta自体の評価式ではない。|
|going_weather|562|0|going_weather|同じgoingの着順品質のみ。weatherの独立効果は使っていない。|
|carried_weight|623|0|weight_sex_age|過去好走時との斤量差3点に利用。|
|body_weight|621|0|body_equipment_rest|自馬体重平均との差と休養間隔の仮説2点。健康状態の確認ではない。|
|equipment|63|0|body_equipment_rest|馬具の数値効果は未使用。関連枠が加点されても馬具の寄与ではない。|
|sex_age|623|0|weight_sex_age|性齢の数値効果は未使用。関連枠の斤量差と混同しない。|
|jockey_trainer|623|0|jockey_trainer|情報はあるが数値式はnull。理論の有効性は未検証。|
|draw_geometry|0|0|draw_geometry|枠データはあるが形状効果の数値式はnull。理論の有効性は未検証。|
|training|0|0|なし|未接続、効果未検証。|
|bloodline|0|0|なし|未接続、効果未検証。|
|mineta_T01|194|63|early_reproduction|実際の固有依存はlatest min-corner→styles→frontShare→projected_pace。scoring_itemラベルのearly_reproductionは多走前半平均で同じ指標ではない。|
|mineta_T02|623|0|projected_pace|frontShareはprojected_paceだけでscenario選択に利用。|
|mineta_T03|114|1|draw_geometry|隣馬条件は監査のみ。枠点がnullなので数値効果なし。|
|mineta_T04|0|0|draw_geometry|コース形状不足、数値効果なし。|
|mineta_T05|0|0|なし|ROI資料不足、効果未検証。|
|mineta_T06|195|50|distance_stamina|短縮の監査値は保持。距離の共通信号と純効果を分けられない。|
|mineta_T07|195|56|distance_stamina|延長の監査値は保持。距離の共通信号と純効果を分けられない。|
|mineta_T08|0|0|なし|全キャリア不足、初馬場条件は効果未検証。|
|mineta_T09|464|0|weight_sex_age|斤量差と共有。みねた固有効果ではない。|
|mineta_T10|0|0|なし|市場使用禁止のため無効。|
|mineta_T11|0|0|なし|非公開AIなし。効果未検証。|
|mineta_T12|0|0|なし|非公開指標なし。効果未検証。|
|mineta_T13|0|0|なし|非公開指標なし。効果未検証。|
|mineta_T14|0|0|なし|統合工程。追加加点しない。|
