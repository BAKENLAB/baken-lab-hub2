# Gemini独立7頭 v5検証 — 初回固定後の照合・改善
- Input a25150e60d63f2c8df9bf79f7c9d00ce62537a97 / blob 86a8ff7d40ab53bc6c5027e9907271b307d69cb0 / SHA256 c8b09b6877e5286aa86325e78111f8991ea2cb2908d0bcc26e0ebeadc23aa414.
- Baseline v5 65eb693, initial executable 33c08b4, CI45909917447 success, immutable initial result 4a8d874. Only input and acceptance were read before capture; expected document b378bd9 / blob d9cdeb3114ee16c4a4bc1f56fc77858ebafb86ea was fetched afterward. Shared repository is not strictly blinded. 
- The regular v5 entry returned TARGET_TIME. Separate partial fixture analysis reuses v5 catalog/dependency contract, does not authorize official data, does not execute all normal v5 analysis functions. 805 item checks, 560 partial computations, 403 output rows, 329 rows with research consumers. 245 checks without a safe partial calculation, 157 computed but no output. No race IDs, dates, headcounts, actual gates, official evidence or expected judgments invented.
## 初回結果との期待動作照合（ランク正解比較ではない）
| Horse | Initial observation and remaining defect | Post-freeze repair / unresolved |
|---|---|---|
| A | 1400良の勝利（87.8秒）、前走1600重6着と後退、距離/馬場変化を別扱い。相手固有IDなし。 | 勝利候補と別条件の到達・敗戦を独立保持。過去場/正式格付/相手水準未照合、S未決定。 |
| B | 3走すべて2/3着、差0.1–0.2秒。1400良2走は好走候補。勝ち筋の到達証拠なし。 | 稍重3着も別条件好走候補として明示。非勝利だけで能力劣勢にしない。新しい勝利経路証拠は依頼事項、創作なし。 |
| C | 不良C3勝利、良C2の7着。前走1.1/0.9の着差矛盾を保留。 | 他条件での勝利経路候補を別欄。馬場とクラスの交絡、間隔の効果、正式格付未知。 |
| D | 3走の最初の提供順位1、前走重2着・0.1秒差。Aも前走先行観測。競る/譲る仮説。 | 単騎/スロー説明を不利事象から分離。別条件2着を好走候補に残す。先行候補と逃げ候補を区別。実ラップ、ゲート、Gが未知。 |
| E | 1400良5着0.4差、7→6→4→4、詰まり記述、前走間隔矛盾保留。申告先行と直近位置の不整合候補。 | 3走前と前走の表記条件一致で時計-1.2秒、上がり-1.7秒、勝馬差-1.1秒、着順8→5。能力増加/不利解消を断定しない。詰まりは公式裁決なし。EYE現在性・市場前能力未決定。 |
| F | 不良勝利、良9着、前走8着。前走馬場の重/良矛盾を保留して馬場群へ入れない。 | 不良勝利を別条件の勝利候補に保持。馬場独立効果、現在の比較強度不明。C未決定。 |
| G | 詳細履歴なし、先行未知、7頭母数保持、出走表・転入設定のみ。初回EYEの共有文脈7項目は個馬の発掘と誤解の余地。 | 個馬履歴に紐付くEYE材料0、共有文脈を明記。未評価、隊列の未知を保持。取消対照で6頭母数。 |
## 全頭展開と相手比較
A/Dの提供通過点に3番手以内あり、B/C/E/Fの提供4点ではなし（完全な角順位確認なし）、G不明。記載点上の先行占有率2/7～3/7、正式先行率ではない。Dのみ最初の提供順位1を3走観測。枠は実ゲートではない。全21ペア公式直接比較0、間接比較0、後続成績は固有IDのない記述のみ。ペースの速さ、正確な隊列、距離損失、疲労は未知。
## 改修と対照
GF01–10: 全項目、矛盾、E同表記条件差、Dペースと不利の区別、G未知、G取消、E同一相対走重複拒否、A位置除去→D競合出力差、A/B/C/F到達経路、架空認証拒否。架空Bの勝利追加は実施せず追加原本待ち。初回GF02は試験がグループ配列を誤参照し失敗、a5bcf77でテストのみ修正し成功。実分析v5も f235d0c で取消母数、非数値着順ガード、EYE現行構成/相手後続時点文脈を拡張。V515/516で取消・現在構成の読取を検査。 
## 再実行
最新コード f235d0c728b23546d160e03cc8ac81b5e9cf5706, CI45910181000 job140216385676 success, 108既存 + 12追加 = 120 named research tests and inherited suites. Post-review same input hash; new outputs 399, research consumer rows 325, formal consumption zero. Lower output count is not lower ability: Dの誤分類に由来する項目除去など。全805行は別ディレクトリへ保存し初回を不変に維持。
## 残る課題
通常v5の公式 as-of 証拠での全頭実行はこの入力では不能。過去競走日/ID/頭数/場・コース版/正式格付・資格/個体ラップ/相手ID/裁決/実ゲート/当日傾向/本人馬照合・許諾を別版で取得。実データ能力・現在性・反証重大性・正式判断への消費は未証明。5観点の支持/反証は部分条件/歴史的記述の範囲。正式SABC・EYE、production、main、DB、FROZEN、MCP、Cron、deploy変更なし。
