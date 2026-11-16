# 統合研究 V4

V3の未知項目を偽の確定値で埋めず、既存材料を採点関数・研究上の比較順位・EYE再構成監査に接続する。
policy.jsonの配点/正規化式は未承認の研究仮説。既知46Rは開発集合であり独立holdoutではない。
新しい結果比較前にソースとpolicy hashをコミット固定する。過去に見た87/92という集計を知らなかったことにはしない。

38項目を15配点枠へ集約する。市場・非公開指標は対象外、T14は追加点なし。同じatomic factの加点を抑制し、同じ過去レースの関連観測は合計25点まで。欠損は未知区間、再配分なし。
支持された加点の下限値を研究用decision_scoreとし、その方針によるdecision_rank/TOP5を算出する。これは欠損込みの完全な能力順位ではなく、未知幅を必ず併記する。能力点/順位が確定不能ならnull。支持する成績が0件の馬は評価外のまま残す。

Evalは既存接続器同様、競馬場・芝ダート・距離で一意なcatalog項目を照合できる。複数コースは公式layoutが必要。一意catalog照合を公式DOMの形態確認とは呼ばない。取得日前には使わず、原本行単位一致未検証を保持。private pair表は再公開しない。

追加履歴は公式archiveの同一馬ID・同名・明示平地・対象前日付・発走前source時刻のみ。元snapshotを変更しない。最新不明の走歴を古い実績で置き換えて「最新脚質」とはしない。
厳密な発走前評価と再構成研究は別出力。研究時点で作るEYE監査は発走前の監査証拠ではなく、厳密asofゲートを通過した本番EYEとは扱わない。
本番・main・DB・FROZEN・Cron・デプロイは変更禁止。


## 現在の検証結果

実装/結果/未完成項目は [VALIDATION.md](VALIDATION.md)。最新出力は `validation/type-repaired/`、初回固定試験は `validation/current/` に保持。集計と全623頭・全捕捉変化は `analysis/final/`。
全100点能力採点や厳密発走前正式EYEが完成したとは扱わない。枠効果/騎手効果等は未採点。現状は未確定幅付き研究意思決定値、能力点はnullのまま。本番採用不可。


集計を再現する場合は上書きを避けて別の出力先を使用する。

```sh
node research/unified-engine-20261116/v4/analyze.mjs --output-dir /tmp/v4-fresh-analysis
node research/unified-engine-20261116/v4/package-analysis.mjs --analysis-dir /tmp/v4-fresh-analysis
```

capture-changes/blockersは圧縮payloadをGitに保存。SHA-256を検証してdecode(...).rowsで取り出す。未圧縮の同内容ファイルは集計CLIから別出力先へ生成できる。


採点の同一再実行には、同じ承認済みprivate Eval cacheが必要。cacheなし実行はEval未適用の別試験で、保存済み結果を再現したとは扱わない。保存済みlockからの再集計・全頭分析はprivate cacheなしで再現でき、別出力先の16ファイルSHA-256一致を確認した。
archiveのrun-level作成/更新時計もSELECTで確認し、すべて最初の対象発走より前だった（source-time-verification.json）。これは元immutable入力の存在証明ではない。
