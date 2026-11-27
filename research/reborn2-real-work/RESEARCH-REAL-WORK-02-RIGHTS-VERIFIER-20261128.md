# BAKEN LAB REBORN 2｜実競走接続障害の集中解消 第2回

2026-11-28 JST。専用ブランチのみ。本番・DB・MCP・FROZEN・Cron・PR #92/#94・問い合わせ・契約・有料API・実公式取得・正式採用は変更0。

## 固定原本

- Main40監査: 0abb609bd27cb212abfb1dece8a8525d2f6ff817
- Work30実装: 21306a42c93a62d4876777b88c56ad33e1cb4ee0
- Work30 Main40監査: d22bd9b62356b8297636c6658bb39bea02290e51
- canonical: 100 RANK + 15 EYE、118基準群、826保留条件

## 解消した障害

1. 25材料群を正式115項目へ展開する機械可読表を作成した。全行にJRA/LOCAL公式経路、形式、直接項目、公表時点、訂正方針、本人馬結合、権利5区分、取得不能時ルール、正規代替を保持する。
2. PUBLIC_VIEW と ACQUIRE / RETAIN / EXTERNAL_AI / DERIVED_PUBLICATION / COMMERCIAL を分離した。見られることを利用許諾としない。
3. 第1回契約を正式候補から隔離し、異常入力を拒否する薄い前段verifierを追加した。実供給はWork30 byte custodyを再利用し、その後段にnative parserとtyped observationを置く設計。
4. RFC3161のローカル自己署名試験TSAで、query、signed response、証明書鎖による検証を実行した。外部送信なし。
5. JRA/LOCAL各1競走の事前宣言手順と停止条件を固定した。権利決定前は競走選択もしない。

## 115項目供給表の読み方

direct sourceはcard/result/profile/incident/course/rules/rating/trainingの8系統。derived項目は公式測定値ではなく、依存するtyped observationがすべて発走前cutoff内の場合だけ計算可能。砂被り耐性、揉まれ耐性、瞬発力、勝ち筋等を公式測定値として捏造しない。個馬ラップの一般公式供給がない場合はMISSING。レースラップを個馬ラップへ転用しない。

## 許諾判断

JRA一般利用案内はサイト上の映像・画像・記事等の著作権を明示し、私的利用・引用を超える二次利用に事前許諾を求める。一般公開ページだけでは自動取得、長期原本保存、外部AI、派生公開、商用利用を包括的に確定できない。

NAR利用規約・FAQも無断転載・複製や商用利用を制限する。日次/月次CSVの正規ダウンロード経路があることと、外部AI・再配布・将来商用の許諾は別問題。

公式窓口候補を権利判断表へ記載し、JRA/NAR用の質問文案を作成した。送信はしていない。各主催者所有資料はNAR一括許諾と仮定しない。

### ユーザー選択肢

- A: ローカル限定1競走。取得・一時保存の許可が条件。
- B: A + ハッシュだけを独立時刻サービスへ送信。digest disclosureの承認が条件。
- C: 外部AI処理。第三者クラウド処理の明示許可が条件。
- D: 公開・商用。書面条件または正規データ契約が条件。

現時点の推奨はAの許諾確認から。C/Dへ先に進まない。

## 時刻証明

RFC3161ローカル試験はPASS。署名付きtokenは対象digestがtoken時刻以前に存在したことを検証できる。しかし、公式発行者、内容の真実性、サイト公表時刻、ブラウザ取得時刻は証明しない。ローカル自己署名証明書は独立第三者時刻ではないため研究インターフェース試験に限定する。

FreeTSAは外部RFC3161候補、OpenTimestampsは公開calendarへhash commitmentを送りBitcoinへanchorする候補。ただし採用していない。OTSの即時receiptは完成proofではなく、後でupgradeが必要。いずれも原本や権利を証明しない。外部送信はユーザー承認前に行わない。

## 実行

- node tests: 12/12 PASS
- 115 map: RANK 100 + EYE 15、一意115
- holds: 118 / 826 維持
- RFC3161 local signature verify: PASS
- official values: 0
- actual race captures/replays: 0
- formal admissions: 0
- prior405: 再実行せず別記録

異常入力の拒否: REAL scope、mode/cutoff欠落、自己申告policy/rights、hash改変、遅延取得、未知top/document field、target post不整合。

## 未解決

- JRA/NAR/主催者からの取得・保存・外部AI・公開・商用の具体的回答
- native HTML/PDF/CSV parserの公式原本による承認済み試験
- JRA公開表示キーの恒久的な馬固有ID契約
- NAR主催者別資料の権利者・訂正履歴
- 真に独立したTSA/OTS proof（外部送信未承認）
- JRA/LOCAL各1競走の実取得（権利判断前なので未選択）

## 統合勧告

第1回contractを正式回路へ採用しない。本成果のverifierも単独では正式回路ではない。Work30の原本byte custodyを基礎に、trusted rights decision、independent time receipt、native parser、field-level identity/version、typed observationを直列接続する。全ゲート成立後も formal=false の研究出力から開始する。
