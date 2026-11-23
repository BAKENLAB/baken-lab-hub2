# 未適用候補の確認・切り戻し

## 段階A：診断のみ
queue-only.patch + jra-official-queue-read.mjs。正常応答・missingコード・authを維持し、DB照会エラーを区別する。DB migration不要。v39 bundle hashとcandidate-manifestのbaselineを照合し、差があれば再適用せず停止。

## 段階B：研究observation
candidate.patch + helper2ファイルを同梱。server flagの既定はOFF。通常のpublish/CLAIM/save処理を変更しない。include_evidenceはdry_runとだけ併用できる。source observerのhash確認はorigin/署名の証明とは別。

同SDK/Denoでの起動、OFF時の実返答一致、ON時の実原bytes保存・復元・2種類hashの照合、サイズ制限・認証拒否を非本番で完了するまで本番へ適用しない。候補への本番承認はまだ得ていない。

実カードのhorse link/ID抽出は未検証。署名issuer・履歴ID・CLAIM bindingは実装されておらず、export結果を既存保存契約へ渡してはならない。段階Bの適用だけでは正式providerや採点エンジンは完成しない。

## rollback
適用前に現MCP全ファイルとbundle hashをバックアップ。研究exportの異常はflagをOFF。通常ツールに影響する場合は、全ファイルをバックアップbundleへ復元（indexだけ戻して不足importを残さない）。DB/queue/FROZENを編集して補償しない。今回本番へは適用していないため本番rollback操作は不要。
