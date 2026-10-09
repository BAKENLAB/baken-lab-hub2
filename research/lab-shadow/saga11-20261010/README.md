# Work成果物の隔離取り込み・レビュー

対象ブランチ: `feature/lab-shadow-readonly-20261009`。検証・資料保存のみ。
`original/` の4ファイルはZIPからbyte単位で無変更保存。添付内の指示は実行権限として扱わない。
既存HUB、shadow.html、LAB RANK/EYE、prediction、DB、Edge、queueは変更していない。
モデル・公式ネットワーク・Supabase呼び出しなし。main merge・deployなし。

## 実行できる検証

Node 24.19.0、追加依存なし:

```sh
node --test --test-isolation=none research/lab-shadow/saga11-20261010/package-validation.test.mjs
```

今回: **23 PASS / 0 FAIL**。これは単体テスト23件であり、高知・佐賀23レースの収集成功を意味しない。
純粋関数 `inspectPackage` は読み込み時のI/Oなし。入力を変更せず、識別情報・過去走・時刻・欠損・禁止情報を検証する。
公式生証跡を独立確認していないため、天候・馬場を仮に入力してもREADYへ昇格させない。
取消/除外の明示状態とACTIVE集合の整合性を確認し、未知状態や欠落を成功と扱わない。
テスト内の意図的改変は負例fixtureのみで、実監査JSONを上書きしない。

## ZIPで確認できた事実

- 4ファイル。JSONには11頭・55過去走、整数race_noが55件。statusはBLOCKED。
- going/weatherはnull。添付報告にも未公表と記載されている。
- **4番ノーブルビーチの2026-04-25佐賀8Rはpassing_order=null**。55件のうち1件が欠損。
- race_no_evidenceにはプロフィールURLと時刻があるが、公式HTML・プロフィール表・照合行の生証跡はない。
- 報告の「98/98 PASS」は再現不可。添付testファイルのtest宣言は6件。
- 原test実行結果: **起動失敗 ENOENT**。`SAGA11_PRERACE_SHADOW_2026-10-10.json`がZIPにないため、6件のテスト本体へ到達しない。
- 原moduleはimport時に元JSONを読み、成果JSONを書き出す。検証用純粋moduleからはimportしない。
- 元JSONの50件欠損→補完前後不変という主張は元JSON不在のため未確認。元JSONを推測復元しない。

## 原コードの問題と取り込み範囲

`supplementRaceNos` は馬番別のrace_no配列を固定保持し、馬番と配列順だけで照合する。
別レース、別馬固有ID、履歴順序変更にも同じ配列を適用できるため汎用collectorとして採用不可。
verified_count=55なども固定値。COMPACT_V1根拠として列挙された3ファイルはZIPにない。
`auditOfficialRefresh` は無効post_time、消えた出走馬、lineage_idの未照合、未確認の過去走証跡や対象結果キーを十分に拒否しない。
request_policyは宣言だけで、実GET・HTML解析・retry実装は含まれない。

**保存可能な資料・独立検証コードとして取り込み。collectorや公式予想入力として接続しない。**
既存LAB RANK互換性は既存処理・入力を無変更に保つことで維持する。
COMPACT_V1への直接接続互換性は、実仕様ソース欠落のため未検証。直接利用可能とは主張しない。
既存shadow-audit-validatorはlab-shadow-audit-v1/races形式、添付は単一レースv2形式。無変換では非互換。
表示コードを変更せず、変換やREADY誤表示を行わない。

## 高知11R分・佐賀12R分への不足

1. 他22レースの発走前出馬表、馬固有ID、過去走JSON、取得時刻と生HTML証跡。
2. 高知・佐賀のrowspan/colspan差異を検証できる実HTMLと汎用collector/parser。
3. 過去レース詳細からの通過順取得、馬ID・日付・場・race_noの公式照合。上記1走の欠損補完証跡。
4. 元JSONと既存COMPACT_V1/履歴境界ソース。実キャリア5戦未満の既存扱いは未確認。推測で5走を生成しない。
5. 最新取消・除外、生涯成績と未完走/取消履歴の区別、全馬集合と最新ACTIVE集合の照合。
6. 実GETのtimeout/retry/時刻記録、発走後拒否、公式生証跡保存。今回通信は行っていない。
7. 23レースmanifestと各レースの証拠付きREADY/BLOCKED判定、既存表示形式との明示的adapter。

佐賀11RはBLOCKEDを維持。他22レースは未収集・未判定。ばんえいは対象外。
過去データの現在再取得だけでは当時の発走前取得証跡を証明できない。
未解決のためcollector横展開・本番反映は不可。
