# JRA・LOCAL各1競走の最小実証計画

状態: PREDECLARED / NOT EXECUTED / FORMAL 0

## 共通停止条件

権利台帳に ACQUIRE と TEMPORARY_RETAIN の信頼済み決定がない限り取得しない。外部AIへ原本を送る場合は EXTERNAL_AI_PROCESS、ハッシュをTSA/OTSへ送る場合は DISCLOSE_DIGEST が別途必要。人気、オッズ、対象競走結果、発走後情報は拒否する。

## JRA 1競走

1. ユーザー承認後、対象日・場・Rを事前登録する。
2. JRA公式出馬表、各馬公式プロフィール/過去成績、競走条件、規程、コース資料だけを許可された方法で取得する。
3. 原本バイトを変更せずローカル保管し、取得開始/終了時刻、URL、HTTP情報、SHA-256をmanifestへ記録する。
4. JRA表示キー、競走ID、馬番、馬名、生年月日・血統等の公式結合材料を保存する。名前だけの結合は拒否する。
5. 発走前cutoff以前に公表された版だけを選択し、訂正版は別原本として保存する。
6. Work30のbyte custodyを再利用し、強化verifier、native parser、typed observationへ渡す。
7. 115項目は直接観測・導出・欠損を分離。SABC/EYEは実行しない。

## LOCAL 1競走

同じ手順に加え、NAR公式出馬表・プロフィール・日次/月次CSV（権利確認済みの場合のみ）を用い、NAR馬IDと競走IDを固定する。主催者固有の裁決・コース資料はNARの権利と一括扱いせず、主催者別に判断する。通過順は原本の集団表現と馬別変換を分離し、レースラップを個馬ラップにしない。

## 成功条件

- 全頭の現在ACTIVE集合と本人馬IDが一致
- 必須原本のhash、版、取得時刻、発表時点、権利決定が検証可能
- target cutoff後の情報0、人気/オッズ0、名前だけの結合0
- 取得不能項目はMISSING
- 出力は研究用typed observationsのみ、formal=false

現時点では権利決定が未了のため、両競走とも BLOCKED_BEFORE_SELECTION。
