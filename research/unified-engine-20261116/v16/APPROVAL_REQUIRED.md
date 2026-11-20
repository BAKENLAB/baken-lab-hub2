# 適用前の差分・影響・rollback（今回適用しない）

差分はcandidate.patch。既存MCP v33 indexへの20観測点とcapture module追加だけ。通常処理の再取得・再評価・保存の回数/順序、DB保存関数、保存7項目、既存ガードを変えない。OFF固定の候補をONへ接続する変更は今回実施していない。

次の承認前に必要な作業:
1. 正規の認証済みrequest/sessionからjob/run/attempt/traceとgateを供給し、初回/preview/saveを同一traceに束ねる設計・テスト。request bodyの自己申告を真正性証拠にしない。
2. 認可済み非公開sink、利用権、容量/時間/保持期間/削除/アクセス制御を決定し、abort・重複・期限を実環境で検証。追加費用や外部サービスの無断作成は禁止。
3. 既存正規readerがexact-selected-sourceと原HTMLを返せるか確認。存在しなければ最小の読み取り専用変更と権限差分を別途提示し承認を得る。現行ゲートを迂回するadmin SELECTを代替にしない。
4. Deno/Edge隔離実行で、OFF時レスポンス完全一致、実負荷、sink失敗時の通常保存継続を検証。今回のNode/模擬試験だけでdeployしない。
5. V9事前登録、発走前の信頼時刻、旧版判断とFROZEN照合、旧版結果非開示の統合版独立固定を接続してから未知1R比較。

本番適用には別途明示承認が必要。影響範囲はMCP観測処理と認可済み研究出力だけに限定。DB schema/ACL追加が必要なら別変更として確認する。

rollback: captureをOFFに戻し、観測module/import/20呼出しを除去して基準v33 hashへ戻す。MCP deploy自体は別途承認が必要。FROZEN、job、protocol、保存RPCを更新/削除/再実行しない。captureの記録失敗が既存保存を再試行する理由にはならない。
