# GⅠ INTELLIGENCE｜HUB既存100点評価への安全な引き継ぎ（2026-11-19）

## 現在の本番経路と変更範囲
- 本番 Supabase: `qjlvsndiqjfsfjinilig`。
- JRA正規MCP Edge Function: `jra-claimed-mcp` **v33 / ACTIVE**。
- 正規 `jra_claimed_context` の読み取り専用応答に `g1_intelligence` を付与。
- 正規 `jra_evidence_rank_preview` の読み取り専用応答に `g1_intelligence` と `g1_scoring_trace` を付与。
- 既存100点採点・Evalペース補正 `jra-verified-evidence-rank-bridge.mjs`、EYE判定、`jra_save_claimed_prediction`、正規RPC・FROZEN・Cron等は変更していない。
- 新しいGⅠ数値加点は **0点**。過去のGⅠ手動後日研究点を混ぜない。根拠の再評価はHUBの承認済み採点方法に委ねる。

## 「なぜこの順位？」と証拠の連動
1. `g1_intelligence`：発走前のJRA公式歴走、ペース・比較データの保有状況を全頭で検査。出遅れ、進路不利、調教・馬具・陣営コメントは参照情報がなければ `NOT_VERIFIED` 相当として追加確認の対象。発走後・未登録・対象外は監査を止める。
2. `g1_scoring_trace`：従来のJRA0.4ドラフトと既存Eval公式実走補正プレビューを馬ごとに照合し、`score_before`、`score_after`、`applied_delta`、`verified_run_refs` を固定。証拠なしの数値補正・重複参照・未来日付・全頭不一致・TOP5不一致は `BLOCKED` と診断。
3. 既存補正の `already_scored_verified_run_refs` を別に提示し、**過去走を新発見扱いして二重加点しない**。
4. 外部コメント・馬具変更などの独立根拠を取得した際は、出典・公表時刻・今回条件との関連性を確認し、HUBの既存100点基準で人手評価したうえで別バージョンを比較。監査だけでは新しい点数は自動発生しない。
5. 既存TOP5を維持できるかはシャドー検証で判定。単にGⅠ成績で加点する新ルールは採用しない。

## 既存の発走前FROZENを再検査した結果
対象：2026/11/14〜15のJRA `official_predictions`、`FROZEN`、読み取り専用SQL。

| 指標 | 記録 |
|---|---:|
| レース | 57 |
| 保存済み監査の延べ全頭 | 821 |
| Eval・公式過去走由来のスコア補正あり | 67頭 |
| 1頭あたり最大補正 | 1点 |
| TOP5構成馬入れ替わり | 0レース |
| 算術不一致 | 0 |
| 補正の公式run参照欠落 | 0 |
| 2点上限超過 | 0 |

**制限**：これは保存済み補正ledgerの整合性監査であり、GⅠ専用強化による的中率向上の検証ではない。今後の独立レース結果との比較で判定する。

## 安全テスト
- `research/g1-intelligence/g1-intelligence-audit.test.mjs`：GⅠ対象判定、発走前時刻、全頭一致、未来走排除等。
- `research/g1-intelligence/g1-scoring-trace.test.mjs`：元点数と補正点数の照合、証拠不在の加点拒否、同一参照重複、未来履歴、対象馬数、TOP5不一致、非GⅠスキップ等。
- GitHub workflow: `node --test research/g1-intelligence/*.test.mjs`。
- CI確認：GitHub Actions run `44373640038` **22 PASS / 0 FAIL**（両テストファイルを対象）。
- 2026-11-19本番 v33 を再取得：ACTIVE・15ソースファイル・監査付与位置あり・既存保存関数保持。

## マイルCS直前の残作業
- 2026/11/22 JRA公式出馬表、READY、未保存、有効CLAIMを確認する。
- 現時点の `jra_queue_status({race_date:"2026-11-22"})` は jobs=0, claimed=0, ready_to_claim_now=0。
- 有効な公式CLAIMが現れて初めて、実際のマイルCS全頭で `jra_claimed_context` → 元のHUB採点 → `jra_evidence_rank_preview`（GⅠ監査＋スコア追跡）→ 必要ならEYE再監査 → 正規保存 の実行確認ができる。
- **本番保存は正規CLAIMと発走前条件が満たされた場合だけ。** FROZENを直接書き換えない。
- 次段階で、監査の新しい根拠がHUBの採点に反映され得るか、元から評価されていた材料と独立に、未来レースで比較する。まだ「GⅠ採点強化で順位改善」を主張しない。


### 2026-11-19の追加hardening
- v32 → v33: `g1_scoring_trace` で独立の `observedAt < post_time` 検査を必須化。実際の当該レースが発走済みでなく、検査時刻が未指定でも機能を拒否。
- 既存の `jra_save_claimed_prediction` ハンドラーは v31 → v32 → v33 更新のいずれもバイト同一。
- GⅠ監査+スコア整合性ユニットテスト合計 **22 PASS / 0 FAIL**（CI 44373640038）。
- **実マイルCS全頭データのCLAIM実行テストは未完了**。2026/11/22のREADY待ち。
