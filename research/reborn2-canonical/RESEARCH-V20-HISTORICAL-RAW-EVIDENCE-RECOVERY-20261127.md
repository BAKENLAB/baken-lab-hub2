# REBORN 2 V20 — 過去原本証拠の探索・復元

- 調査日: 2026-11-27 JST
- 基準: PR #92 acceptance commit `1568a09381601b87a235291e446dfc09ea654833`
- 対象: 東京12R（2026-11-23）、佐賀11R（2026-10-10）
- モード: READ ONLY / historical saved artifacts only
- 本番変更: 0

## 結論

| 対象 | 原本HTML復元 | 復元できた証拠 | 判定 |
|---|---:|---|---|
| 東京12R | 0/18 | 18件の取得レシート・保存ハッシュ整合・06:50:04 JSTの出走状態確認記録が上位受入資料で確認済み | `RAW_BODY_NOT_RECOVERED` |
| 佐賀11R 出馬表 | 0/1 | 描画DOMの取得時刻、URL、文字数、SHA-256、11頭の状態表 | `HASH_ONLY_BODY_NOT_SAVED` |
| 佐賀11R プロフィール | 0/11 | 11頭のNAR固有ID、プロフィールURL、派生55走 | `DERIVED_ONLY` |
| 佐賀11R 個別過去走 | 0/55 | 派生55走と再監査結果 | `DERIVED_ONLY` |
| 佐賀11R 天候・馬場 | 0/2 | 00:43:39 JST時点で両項目が未公表だった記録 | `NOT_PUBLISHED_AT_CAPTURE` |

原本バイト列がないため、東京12Rの既存18 SHA-256および佐賀11Rの描画DOM SHA-256を、現在保存されているHTMLへ再計算して一致確認することはできなかった。ハッシュ値だけを原本の代替とは扱わない。

## 探索範囲

### 調査できた範囲

1. 現在許可されたWork作業領域の全497ファイル。
2. 同領域の24アーカイブ。佐賀11R/23R関連は22ファイル、関連ZIP内15メンバーを個別確認。
3. ChatGPT Libraryの保存済み研究資料を、日付、レース名、取得時刻、既知SHA-256で横断検索。
4. PR #92の変更ファイルおよびV19受入資料。

### 調査できなかった範囲

- 過去Work実行環境の一時ファイルシステム（現在の実行環境から参照権限・接続手段なし）。
- 過去Cloud Browserのキャッシュ／ダウンロード領域（永続履歴を列挙する機能が現在の環境に露出していない）。
- 本番DBバックアップ、Supabase Storage、外部バックアップ（読み取り権限・既知の安全な参照経路なし）。
- 削除済みローカルファイルや未保存ブラウザDOM（保存先自体が確認できない）。

これらには侵入・復元操作を行っていない。現在の公式ページも再取得していない。

## 東京12R（2026-11-23）

### 確認できたこと

- V19受入資料は発走前HTML取得レシート18件を保持している。
- 06:50:04 JSTの出走状態確認記録があり、保存ハッシュと確認記録の整合は上位資料で確認済み。
- ただし、受入資料自身が `raw official bytes = 0` とし、保存行が後から更新可能な証明で、immutable native proofではないと分類している。
- 現在のWork領域では、`TOKYO12`、`東京12`、`2026-11-23`、`06:50:04`に該当するHTML/MHTML/HARを0件検出した。
- Libraryでも同一レース・時刻・既知説明に対応するHTML原本を検出しなかった。

### 復元判定

`RAW_BODY_NOT_RECOVERED`。原本が発見できていないため、文字コード、ハッシュ対象（wire bytes / decoded UTF-8 / rendered DOM）、既存SHA-256の再計算一致はいずれも未検証。

## 佐賀11R（2026-10-10）

### 復元できた派生証拠

| 証拠 | 内容 |
|---|---|
| 発走前監査 | 2026-10-10 00:43:39 JST、発走20:10、1166分前 |
| 出馬表URL | NAR公式 `DebaTable`、佐賀・2026-10-10・11R |
| 出走馬 | 11頭、NAR固有ID 11/11、派生履歴55/55 |
| 再取得監査 | 2026-10-10 08:31:39 JST |
| DOM種別 | `RENDERED_DOM_OUTERHTML` |
| DOM文字数 | 241,344 chars |
| DOM SHA-256 | `78efdcf842f7c41df00ab9d2ba7239834ec4ea00751872f94a4a88a249350969` |
| ハッシュ範囲 | `FULL_RENDERED_DOM_OUTERHTML` |
| 原本保存 | raw response HTMLなし、rendered DOM HTMLなし |
| 出走状態 | 11 ACTIVE / 0 CANCELLED / 0 EXCLUDED / 0 UNKNOWN |
| 状態差分 | 4番ノーブルビーチは初期派生RAWでCANCELLEDだったが、08:31:39の公式表示監査ではACTIVE |
| 天候・馬場 | 00:43:39時点では両方null（未公表） |

### 原本不存在を示す保存メタデータ

`LAB_SHADOW_23R_CARD_EVIDENCE_2026-10-10.json` は明示的に次を記録する。

- `raw_response_html = NOT_AVAILABLE`
- `rendered_dom_html = NOT_SAVED_BROWSER_SECURITY_POLICY`
- `rendered_dom_html_saved = false`

関連ZIPにはJSON、Markdown、CSV、スクリプト、テストのみが入り、HTML/MHTML/HARは存在しない。したがってSHA-256は当時ブラウザ上で計算されたレシートであり、現在の保存原本へ再計算できる状態ではない。

### 復元判定

- 出馬表HTML: `HASH_ONLY_BODY_NOT_SAVED`
- 11プロフィール原本: `DERIVED_ONLY`
- 個別過去走公式原本55件: `DERIVED_ONLY`
- 発走前天候・馬場: `NOT_PUBLISHED_AT_CAPTURE`
- 最終出走確定の原本: `NOT_RECOVERED`（08:31:39時点の表示監査はあるが、締切後の確定原本ではない）

## 保存済み派生ファイルの完全性

| ファイル | SHA-256 |
|---|---|
| `validation/SAGA11_PRERACE_SHADOW_2026-10-10.json` | `60247a3423279141a2deb58db586394ba476d74a7c92d563b8ed139f4b52db2e` |
| `validation/SAGA11_PRERACE_REAUDIT_2026-10-10.json` | `b9a67c5f748613cc3b88566f051689f8337dc47a525d49aea93914520a953ef3` |
| `validation/SAGA11_PRERACE_REAUDIT_PACKAGE_2026-10-10.zip` | `bd88cb374acc4beed9d2ec1f238014d92181f1704ce24cbfd64685c4ee9e2c5d` |
| `validation/2026-10-10-23r/LAB_SHADOW_23R_RAW_2026-10-10.json` | `e679a0f05e5325feffd0266e783dd6be3775d03bd23a377c72854d47373c1ec7` |
| `validation/2026-10-10-23r/LAB_SHADOW_23R_CARD_EVIDENCE_2026-10-10.json` | `36fea7583f6b58633a815fd8706389990c9fe3adb614857a77b9802544a559f6` |
| `validation/2026-10-10-23r/LAB_SHADOW_23R_CARD_EVIDENCE_PACKAGE_2026-10-10.zip` | `2f03f2e8098b5cf89e0fe9d2e2dfe6345fcef4434f3c5cee162a8059b89dd447` |

## 採用可否

- 研究用派生データの所在確認: **可能**
- 原本HTMLの復元: **不可**
- 過去時点の公式原本証拠としての正式採用: **不可**
- 現在ページの再取得による代替: **実施せず／不可**
- 本番変更・正式採用: **0件**

## 次に必要なもの

次工程へ進めるのは、権限が明示された既存保管先の読み取り参照が提供された場合だけである。候補は、過去Work成果物のエクスポート、ブラウザ取得物の正式アーカイブ、または既存バックアップの読み取り専用マニフェスト。原本候補が見つかった場合は、(1) ファイルバイト列、(2) 取得時刻、(3) URL、(4) 文字コード、(5) hash scopeを固定し、既存SHA-256と再計算照合する。
