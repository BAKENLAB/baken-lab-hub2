# TODAY未公開理由表示候補

本番hub2-api v32 list応答を確認。race_date/track/race_no/race_name/post_time/prediction_statusはあるが、job_status/last_error/履歴採用状態はない。今回のAPI追加・DB変更は0。

FROZENと予想本文があるレースは理由なし。新馬／障害／ジャンプをレース名で識別し、現在のJRA非対応を表示する。京都8Rは2026-10-12京都8R、PENDING/RETRYだけに、今回公式照合で確認したカドーダムールの出走歴0件を表示注記として固定する。これは最新ジョブ診断ではなく確認済み事実のUI注記であり、自動追従しない。翌日・他場・他R・FROZENには適用しない。

他の未公開レースは発走済みなら「予想なし（発走済み・正式予想未公開）」、それ以外は「予想未公開（理由確認中）」。PENDINGからQUEUED/実行中/失敗原因を推測しない。実ジョブに応じた動的な理由表示に必要な最小変更は、APIに読取専用のjob_statusと安全な理由コードを追加すること。今回は範囲外として未実装。

レースタイトル直下に11pxの折り返し可能な理由を追加。カード順、公開状態バッジ、ODDS、詳細を開く条件、予想本文は変更しない。実在するAPI行だけを描画。LOCALの処理・判定は変更せず、未公開理由の表示だけ追加。

テスト: node research/result-daily-summary/unpublished-reason.test.cjs
回帰: node research/result-daily-summary/tokyo-listing.test.cjs

スマホ320/375/390pxのCSSは静的確認のみ。実ブラウザのレイアウト・操作は未検証。Production反映、main、DB、Edge、Cron、ジョブ、FROZEN変更は未実施。

## Preview指摘への修正
メイクデビュー表記も新馬戦として識別し「過去走データがなく、現在の評価対象外」を表示。発走済みより先に非対応理由を判定。通常のJRA PENDINGかつ発走前は、70分より先なら「予想準備中（発走まで時間があります）」、70分以内なら「予想準備中（未公開）」。これは時刻・台帳状態の説明で、実行開始や公開時刻を保証しない。不明なRETRY等は理由確認中を維持。京都8Rの注記とFROZENは先行判定。
