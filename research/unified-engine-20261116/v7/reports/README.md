# V7: 未接続6点の所在を確認、100点エンジン完成は未達

基準commit b3ef117。研究ブランチのみ。確認した16ファイルと623頭の入力から、観測データ/評価式/承認状態/数値接続を分けた。今回、新しい理論・係数・能力点は追加していない。

## 実装・検証・未実装

|区分|内容|
|---|---|
|実装済み|6点の未接続監査とnull維持ガード、優先8頭抽出、固定比較、将来研究用の事前登録・入力seal/CLI|
|検証済み|新規16単体＋14成果物＝30 PASS/0 FAIL。46R/623頭のV5/V6 hash・点数・選出を照合|
|未実装|枠4点/騎手調教師2点の承認済み数値式、8頭の原本確認・復帰、実MCP文脈adapter、信頼時刻receipt、実将来評価|
|未確認|外部ライブラリの承認資料、現在の本番MCP版/active protocol、inventoryにあるverified-drawモジュール実ソース|

## 6点はどこで止まっているか

|対象|入力として確認|研究コード|数値接続|
|---|---|---|---|
|枠/形状4点|枠番623、layout271。first-turn距離/start surfaceの接続済み証拠0|[コード](https://github.com/BAKENLAB/baken-lab-hub2/blob/b3ef1173537941881141b5085077d54ceb4342c2/research/unified-engine-20261116/v4/scoring.mjs#L16) はnull、[コード](https://github.com/BAKENLAB/baken-lab-hub2/blob/b3ef1173537941881141b5085077d54ceb4342c2/research/unified-engine-20261116/v3/routes.mjs#L37)|未実装|
|騎手/調教師2点|名前は双方623頭。JRA効果モデル・安定ID/推定規則の接続未確認|[コード](https://github.com/BAKENLAB/baken-lab-hub2/blob/b3ef1173537941881141b5085077d54ceb4342c2/research/unified-engine-20261116/v4/scoring.mjs#L32) はnull|未実装|

V3仕様は明示的な未承認配点案（[コード](https://github.com/BAKENLAB/baken-lab-hub2/blob/b3ef1173537941881141b5085077d54ceb4342c2/research/unified-engine-20261116/v3-data-rubric-spec.md#L12)）。4点/2点という予算の存在は計算式・承認の証拠ではない。V2もapproved=false。今回参照できた範囲では承認済みの6点式を確認できず、外部原本や現在の本番に存在しないと断定もしない。

LAB JOCKEYは[コード](https://github.com/BAKENLAB/baken-lab-hub2/blob/b3ef1173537941881141b5085077d54ceb4342c2/jockey.html#L40)、JRA版は開発中でLOCAL betaを流用しない。LAB COURSEも[コード](https://github.com/BAKENLAB/baken-lab-hub2/blob/b3ef1173537941881141b5085077d54ceb4342c2/course.html#L46)。既存の最大2点bridgeはEval/近走の別補正（[コード](https://github.com/BAKENLAB/baken-lab-hub2/blob/b3ef1173537941881141b5085077d54ceb4342c2/automation/jra-verified-evidence-rank-bridge.mjs#L57)）で、騎手調教師2点とは異なる。混同してつながない。

枠と騎手名の公式出馬表抽出コードはGitHubのJRA MCPに存在（[コード](https://github.com/BAKENLAB/baken-lab-hub2/blob/b3ef1173537941881141b5085077d54ceb4342c2/supabase/functions/jra-claimed-mcp/index.ts#L458)）。保存済み研究入力では、version一致したlive/card属性を読む経路もある。名前/枠番の取得と、当該条件の能力効果・数値式は別。幾何情報の追加資料を扱うsupplemental枠はあるが、数値評価は自動認定されない。

旧inventoryにはjra-verified-draw.mjsの名称/hashがある一方、このブランチに実ソースなし。最新の本番機能を推測しない。みねた原本PDF/Excelの外部ライブラリも未確認。詳細は[evidence/source-audit.json](../evidence/source-audit.json)。

## 優先8頭

[8頭・18候補の個票](priority-eight.md)。構造化記録のID・時刻・元参照は再照合したが、当時の公式原本/2025適用時期を確認できていない。新原本0、復帰0、評価外は46頭のまま。

既知の公式分類URLへの通常通信を1回試し、実行環境PermissionErrorでHTTP本文未取得。公式サーバーのHTTP403と断定しない。TLS無効化/別proxy/別Supabase経路/再試行なし。各馬の公式URLを個別に取得できたという意味でもない。保存されたtransport記述は試行時の設定意図であり、TLS接続成功の記録ではない。

## 継承比較

|比較元|捕捉|V7新規|V7消失|
|---|---|---|---|
|旧版|87|25|29|
|先行強化|92|21|30|
|V4|78|9|4|
|V5|83|0|0|
|V6|83|0|0|
|V7診断投影|83|—|—|

正式順位確定0R、条件付きTOP5確定0R、新しい前後関係証明0、既存の条件付き9組は維持。正式EYE0、診断候補32。83は研究上の下限表示順による投影で、正式予想の実績/新規独立採点ではない。[馬別変化](capture-changes.md)と[全623頭の入力/未接続監査](../analysis/all623-material-audit.csv)を参照。

加点と根拠消費は双方17,039,483,648 micro点。V5/V6計算コードはhashを固定して変更せず、保存済み623頭の同一点数・選出を照合した。旧テスト全体を再実行して件数を増やしていない。

## 将来検証の準備

[準備仕様](../FUTURE_VALIDATION.md)とholdout-registration.jsonを保存。開発46Rを除外し、登録前の観測/発走後入力/未来過去走/結果・人気・オッズ/重複file/改変を拒否する研究用sealとCLIを実装。synthetic入力で実CLIの1回保存・再保存拒否も検証。

ただし正規MCPの入力原文をこの研究スキーマへつなぐadapter、信頼できる不変保存時刻のreceipt、active protocol、将来の実結果照合は未接続。ローカルhash/時計だけで当時の存在や公式照合を証明しない。実将来レース0、activation_ready=false、最低件数/終了条件/採用基準は未設定。正式な将来検証が開始済みとは報告しない。

## 残る確認

[必要な公式資料・評価式](../REQUIRED_MATERIALS.md)。本番反映NO。PR51は研究差分のcommitで更新、Draft維持。既知の本文編集ツール停止を再試行せず、本文更新案を別ファイルに用意する。main/本番/DB/FROZEN/Cron/デプロイへの変更なし。有料APIなし。
