# V11：証拠接続の設計・研究用検証器

基準：V10 `8faa3e02511f5dfb77f9ba82d6eb9e53943ca51b`、Draft PR #51。保存済みMCP v29/SQL13関数を監査した。今回、新たに本番ソースの再取得・本番DBアクセス・MCP実行は行っていないため、最新本番との差分再照合は適用前に必要。

## どこで履歴証拠が失われるか

|段階|保持/消失|
|---|---|
|DB実走元行|run/race/horse参照や取得時計がある。ただし元本文との対応は別確認|
|`jra_flat_past_runs`|元JSONをフィルター。後段ほどの列削減ではない|
|`jra_merged_flat_history_v2`|戻り列がscalar履歴だけ。run/race ID、horse_ref、source_ref、行時計を落とす。LIVE/DBを同日単位に統合し、同優先順位の一意な元行が出力から分からない|
|`jra_optional_content_evidence_v3`|COUNT/MAXでarchiveを集約。ID・行時計・原文参照を返さず、detail_available等だけでは復元不能|
|`jra_claimed_context`|履歴JSONの列を列挙し、source_refを削除方針として明記。現在馬のcard horse_refと各過去走の馬ID証明は別|
|BASE_CORE|現在のlive_runner_id/live_race_idと候補順位は返すが、過去走IDや元100点を返すわけではない|
|その他の相対/古い履歴/条件比較|既に削減された入力の集計・比較であり、原文の源流を復元しない。name-only reviewは明示的な採点禁止|

13関数それぞれの入力/出力シグネチャ、SHA、行番号、保持/消失の説明は **[lineage-map.json](lineage-map.json)**。class/segment/time変換等のscalar関数も、原文・時計の回復経路ではない。

## 設計済み

**[DESIGN.md](DESIGN.md)** に、既定OFFの読み取りsidecar、正規認証とCLAIMの再確認、READY契約の確認、権限、snapshot競合、原文保管、将来手順を整理した。

既存context/保存契約は変えず、任意レース直接取得を作らない。選択元が不明な行は採用せず、並行状態の変化は新しい読取snapshotで再確認する。READ ONLYでも常に競合が解決できるとは主張しない。証拠処理の失敗は研究側だけをUNAVAILABLEにし、既存予想処理を変更しない。

保存済みcontext関数自体にはREADYステータスの直接比較が見当たらない。上流CLAIM/readinessの正確な現行条件は未確認で、既存READY契約が確定するまで適用不可。

## 実装済み

- `contract.json`：必要な識別子・時計・文書・gateを記述した契約目録。JSON Schemaではなく、実検証は次のJSが規範。
- `evidence-contract.mjs`：署名/事前登録hash/context原文hash/全ACTIVE集合hash、job/run/READY/lease/発走3分前、前後gate、原文byte hash、公式参照、ID、時計、抽出値、元履歴選択の一意性を検査する純粋関数。
- 原文hashだけで内容を確認済みにしない。登録した抽出器の版を固定し、原文からの馬/レース/着順等とarchive・contextを照合する。
- 署名が正しくても、原文・時計・馬ID・exact source lineageが不足すれば採用しない。別archiveによる単なる裏付けは元選択履歴に昇格しない。
- 履歴ごとの欠損はその行だけ未採用。他の証明済み行は保持。全体のgate/hash/signature不正は研究sidecar全体を利用不可とする。
- スコア/順位/EYEは常にnull。本番payload、DB、MCPには書き込まない。V5入力への自動注入は未実装。

架空試験のstatusは`SYNTHETIC_*`、factは`verified=false`、実履歴検証数0。既存V5の`validateFact`にそのまま渡すと拒否される。実署名者・実抽出器が接続されたとは扱わない。根拠予算のテストだけは明示的な架空シミュレーションとして別にV5を呼んでいる。

## 元100点評価器の追加調査

GitHub保存の旧 `research/staged-jra-claimed-mcp-ability-v14.ts` を基準commitで追加確認した。blob/SHAと行根拠は `model-recovery.json`。旧入口も完成済みpayloadを呼出側から受け取り、保存RPCへ渡す。現行補正と合わせても、元入力から全頭100点を作る元独立評価器は**未回収**。全履歴を調べ尽くした不存在証明ではない。

## 検証済み

|検証|結果|
|---|---:|
|V11架空契約・改変/欠損拒否・fail-open・共有原子/順序不変|21 PASS / 0 FAIL|
|V9回帰|24 PASS / 0 FAIL|
|V10回帰・欠損null|19 PASS / 0 FAIL|
|V9整合性|6 PASS / 0 FAIL|
|V10納品整合性|5 PASS / 0 FAIL|

ログは各`*-results.txt`。V5の採点式・係数・配分方法・独立EYE条件は変更していない。共有根拠を2軸が要求しても二重計上しないこと、処理順を逆にしても配分が一致することを、新しい架空シミュレーションでも確認した。

`node research/unified-engine-20261116/v11/evidence-contract.test.mjs` で追加テストを実行できる。秘密値・実API呼び出しは不要。

## 未接続・実証状況

**未接続**：正規sidecar producer/RPC、実READY定義、exact lineage reader、本文の認可済み読取、実JRA HTML抽出器と完全依存、実署名者/時計、元独立100点評価器、V5採点への接続。

**実本番・実入力の実証済み件数：0件。** 実履歴の採用0件、新規実レース比較0件。署名テストは架空のみ。46R/623頭は開発集合のままで将来検証に含めない。原文保管/SQL/認可の実DB・並行テストも今回未実施。

将来は上記未接続を確認・検証した後、別途承認された正規CLAIMで一度取得し、同じcontext＋sidecarを共通入力として両方式へ渡す。V9の事前登録・入力固定・結果隔離を守り、保存許可は既存の正式ゲートだけで判断する。

本番反映可能：**NO**。今回の変更は研究領域への追加だけ。main、本番MCP/DB、FROZEN、Cron、デプロイは変更していない。
