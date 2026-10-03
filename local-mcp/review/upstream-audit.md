# 既存upstream READ ONLY監査

これは修正前コードの監査記録です。後続のローカル修正は[blocker修正レビュー](blocker-resolution.md)を参照してください。本番は未更新です。

取得対象: project `qjlvsndiqjfsfjinilig` / Edge Function `lab-claimed-context`。
取得時メタデータ: ACTIVE、version 1、verify_jwt=true。
sha256: `99885ad0c187897c2b99b25f39aa826a80e42335ffe2dde0ca0e9067230180d4`。
ソース取得のみ。本番関数のinvoke、DB書込み、claim変更、deployは行っていません。

## 確認済みの阻害要因

取得した`supabase/functions/lab-claimed-context/handler.mjs:61`:

```js
fresh.protocol.content !== state.protocol.content
```

同ファイル23行でcontentはobjectに限定されています。
2回のDBレスポンスを別々にJSON deserializeすると、同値でもobject参照が異なります。
このため同じprotocolと出馬表でも409 `CONTEXT_CHANGED`に到達することを、取得した未変更コードで再現しました。

ローカル再現: `/tmp/local-edge-audit/reproduce-protocol-comparison.mjs`。
取得した未変更コード: `/tmp/local-edge-contract/`（監査用一時コピー）。

```sh
node /tmp/local-edge-audit/reproduce-protocol-comparison.mjs
```

6 PASS / 0 SKIP / 0 FAIL:

- 同一object参照を再利用する対照群: 200。
- 別々にdeserializeした同一内容: 409 CONTEXT_CHANGED。
- non-LOCAL拒否。
- non-CLAIMED拒否。
- 期限切れ拒否。
- 認証失敗はDB読み取りより前に拒否。

この6件は本番ソースのローカル再現であり、本番E2E成功ではありません。
本番HTTPで同エラーが発生したと観測したわけでもありません。
bridgeはこのエラーをそのまま安全なcodeとして返し、成功に置換・迂回しません。
既存本体の変更は禁止のため未修正です。内容比較への修正と回帰検証には別途承認が必要です。

## 契約と未確認事項

- POSTはUUIDのrun_id/job_id/claim_tokenのみ。service-roleをBearerに設定。verify_jwtを弱めない。
- upstreamはRUNNING worker、CLAIMED job、worker/token一致、試行上限、lease有効、発走3分超前、PENDING/RETRY race、LOCAL一致を確認。
- upstream成功は`{ok:true,context}`。claim credentialはcontextから除外。
- bridgeの正常系テストはmock成功レスポンスを使い、upstreamが現在成功できるという証拠にはしない。
- ホスト上のTLS、OAuth、秘密管理、access log、ChatGPTクライアントとの互換性は未検証。
- 本番secretは未設定。本番の有効CLAIMED context取得は未実施。
