# LOCAL 1.7 — 正規MCPから実レースへ進むための安全な実行手順（研究専用）
2026-11-14 JST。**未配備・未採用**。この資料は保存や認証の代替ではない。

**PRの積み順:** #47（表示パーサーとCI修正）を先にレビューした後に、#46（LOCAL1.7全頭審査）を検証する。両方とも研究Draftで、mainへマージしない。


## 現在の証拠と未完了事項
- 正規 `BAKEN LOCAL MCP v9` の6ツール定義がChatGPT会話へ表示されるようになった。しかし、3つの新ツールの実レース認証・成功実行は別途未検証。
- 本番 `local-claimed-mcp v29` は6つのMCPメソッドを登録済み。正規OAuth、ユーザーID、READY、CLAIM、発走前、FROZEN保護を維持。
- 本番の既存 `private.lab_rank_shadow_preflight_v1` は33件（2026-11-10～13）。すべて従来の `ABILITY_RELATIVE` の `UNCHANGED` 記録。
- 本番 `private.lab_preclaim_evidence_snapshots_v1` は0件。独立LOCAL1.7専用 `private.lab_v17_independent_preflight_v1` は未作成。したがって**現時点で実レースの新モデル精度改善は証明できない**。
- `automation/local-v17-review-handoff.mjs` は正規 `COMPACT_V1` 形のclaimed contextと従来1.6の全頭順位ドラフトを入力に、独立100点評価と変更候補・証拠を**研究目的でのみ**返す。MCPへ組み込んだわけではない。認証やCLAIMの生存性を純関数内では検証しない。

## 次の正当な実レースで行う順番
1. ユーザーが具体的に指定した**当日JST、開催場、レース番号**を使用。発走時間・公式READY・新馬/障害対象外・過去走の出典確認と、既存FROZEN有無を確認する。
2. 発走前だけ、正規 `lab_preclaim_official_corners({race_date,track,race_no})` を手動実行（指定レース1回）。拒否・期限切れ・証拠なしはそのまま記録して停止。別レース、同一拒否入力、匿名アクセスに振り替えない。
3. 正規 `lab_queue_claim_next` が合法にCLAIMした**同じ対象レース**について `lab_claimed_context` を読み取る。run_id/job_id/発走前、有効リース、本人ID、全ACTIVE頭の整合性を確認。期限切れなら保存禁止。
4. **現行LOCAL1.6の全頭独立100点比較**を通常どおり実施し、正式なドラフトTOP5と17項目EYEを作る。人気・オッズ・当日結果で能力を評価しない。
5. CLAIM済みの正規 `COMPACT_V1` と全頭ドラフトを研究審査へ供給。正規MCPに研究APIがない間は、別研究コードを本番用採点APIだと偽らない。純関数 `buildLocalV17ReviewFromClaimedContext` は未配備であり、実戦でそのまま呼べると主張しない。
6. 1.7研究案は、**全頭本人照合が完了**、正式過去走の出典とas-of時刻が明確、5/6位のスコア同点なし、順位を変える具体的な正の証拠と弱点が説明できる場合だけ「審査可能」とする。証拠不足・未知条件は不明扱い。研究順位をFROZENに自動昇格させない。
7. 公式予想は引き続き現行LOCAL1.6で、正規MCPの守られた `lab_save_claimed_prediction` のみ。bets=[]。保存receiptと本番DONE/FROZEN、全ACTIVE、TOP5、EYEを読み戻して照合する。
8. 発走後に公式確定結果を読み、**実際に発走前に封印された**両順位案が存在するレースだけ比較する。発走後に1.7を再計算したものを「的中した新予想」と数えない。中止・失格・頭数不足・結果未確定・未封印は分母に勝手に含めない。

## 比較する指標と採用不可条件
- ◎1着率、◎3着内率、勝ち馬TOP5捕捉率、1～3着TOP5捕捉頭数、1～3着全頭捕捉率、EYE好走率、馬連・ワイド捕捉率を**現行1.6対研究案の同一レース集合**で表示。件数/欠測/棄権も併記。
- **取りこぼし**（元のTOP5にいた勝ち馬や3着内馬が消えた）と**新規捕捉**を同時に表示。平均100点より、実際の当たりを改善したかが重要。
- 馬番で5/6位の同点を解消しない。順位下げは単なる直近大敗・履歴欠損ではなく、比較可能条件での反証を要する。
- 同場同距離の過去大敗を勝手に「負けて強し」に換算しない。前半/後半ラップのハイ・スローも比較基準がない限り未検証。
- 公式出典のない馬、中央転入初戦、クラスや馬場違いを機械的な負の能力としない。
- EYEはTOP5決定後に別の全頭監査で現在性・独立カテゴリ2因子以上。順位6位の自動選択禁止。
- 十分な実レース先行固定比較と成功非破壊検証、明示承認が揃うまで**LOCAL1.7本番自動採用は不可**。

## 今回のGitHub検証範囲
- Draft PR #46: 全頭100点→順位審査、`COMPACT_V1` 純関数アダプター、12件の独立テスト成功。**本番未接続**。
- Draft PR #47: 表示テキストの「未勝利4着→1着」誤読、近況不安の誤分類を修正し、全体CIが成功。**HUBへ未配備**。
- 正規MCPのCLAIM/save/preclaim/preview/seal 呼出し、Edge配備、DB書込み、Cron再開、FROZEN修正は今回ゼロ。

次の実際の取得では、「公式通過順を取得できた馬が何頭か」「そのうち順位判断に使える証拠が何走か」「研究順位でTOP5を変えた理由」を必ず具体的に示す。

## 2026-11-14 早朝｜実DB＋公式日程で確認した取得ウィンドウ
- NAR公式 2026-11-14は高知11R、佐賀11R。佐賀1R 15:20、高知1R 15:35、高知11Rファイナル20:50（日本時間）。公式: https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceList?k_babaCode=32&k_raceDate=2026%2F11%2F14 および https://www.sagakeiba.net/raceinfo/start/ 。
- 11/14 05:38 JST の `public.official_races` LOCAL登録0・READY0。これは正常取得時間帯前。`local-data-refresh` 本番Edge v14 は **07:00～22:00 JST** にのみ通常登録（`force`なし）し、発走 **240分前から** 個別出走馬取得を試みる。
- 実DB 11/10～11/13 はほぼ全場07:00～07:10 JSTに登録（`created_at` 照合）、最初の出走馬確認は各開催の発走4時間程度前。したがって「早朝の0件＝登録故障」ではない。
- 佐賀1Rの通常詳細取得開始目安11:20、高知1R11:35、高知11R16:50。**目安でありREADY・CLAIM可能・その時刻の保存成功を保証しない**。
- `cron.job` をread-onlyで確認: local-data-refreshとlocal-prediction-enqueueはactive、旧local-ai worker群はinactive。**停止したworker群の再開は禁止**。Cronの`succeeded`はHTTP応答内容でのREADYを証明しない。
- `automation/local-v17-intake-window-advisory.mjs` はJST登録窓／詳細4h窓／フィールドREADYを分けて出す**純粋な研究用補助**。発走後・既存FROZENは不可、いずれもCLAIM・preclaim・saveを許可するものではない。
- `lab_preclaim_official_corners`は対象のレース日・場・レース番号を**ユーザーが正確に指定した場合に限り**正式な発走前ルートで実行。研究コードから代行・force実行・レース結果での再構成をしない。
