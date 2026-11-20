# V16 実使用入力capture / 公式証拠reader候補

研究専用。基準 aefcbd0bfcdd1876a371d0d58612354a0fcad50d、設計基準 V15/CAPTURE_DESIGN.md。
本番MCP・DB・main・FROZEN・Cron・デプロイは変更していない。新規CLAIM・予想保存・権限変更0。

## 現行ソース確認（実測）

Supabase MCPでjra-claimed-mcpとDB3関数の定義を読み取り再取得。MCPはv33、bundle `e229535dd96e82e2b81da0859bf3e9c8808ffbc79e641237d7e2e39cba9db0c8`。主要13ファイル、V15の3関数の定義hash/ACLは一致。source-recheck.json参照。private Eval原本とLOCAL helperの再公開なし。DB保存関数を実行していない。

## 実装済み（隔離候補）

- capture.mjs: 既定OFF。OFF時はproducer/clock/gate/sinkを呼ばず、入力の直列化・hash・通信・保存をしない。ONは通常処理の値をlazy producerからcopyし、内部JSONと明記してhash chain付き不変textを任意の認可済み非公開sinkへ渡す。ローカルhash/時刻は真正性証明とはしない。
- build-candidate.py / candidate-index.ts.txt / candidate.patch: v33 indexに20個の観測点を追加。初回raw/scoped/応答、実使用Eval snapshot/OWN戻り行、preview/saveのraw/scoped、bridge/EYE前後、提出/最終payload、通常shadow用再取得、通常receipt。既存RPC・query・変換・保存処理は残し、追加取得0。source hashと単一anchorが一致しなければ生成拒否。
- evidence-reader.mjs: 明示注入された既存認可済みreaderだけを呼ぶ。operationをEXACT_SELECTED_CLAIM_EVIDENCEへ固定し、jobとcontext hashを束ねる。SQL/URLを受け付けず、権限拒否時のfallback・再試行なし。defaultはDISCONNECTED。
- readerは既存V11検証器を再利用し、署名、READY/CLAIM/lease/締切、選択元の一意性、run/race/horse ID、body hash、source_ref、原文extractor、各時計を確認する。署名・本文を自作せず、欠けたものを採点根拠へ昇格しない。
- comparison-contract.mjs: 両armの観測入力順・hash・job/run/trace・ACTIVE集合を照合。欠落/不一致を区別し、一致してもMATCHED_OBSERVATIONS_ONLYに留める。formal_comparison_allowed=false、実比較0件を維持。正式な未来比較はV9の事前登録/独立固定とV11の真正性条件が別途必要。

FROZEN本文の新規保存APIはない。最終payloadは通常保存へ実際に渡す入力の観測であり、保存済みFROZENの重複archiveとは区別する。FROZENは既存の認可済みSELECT経路とV13記録手順で照合する。旧版判断記録は可視の根拠/監査であり、架空の評価器や非公開思考の取得を要求しない。

## 未接続

candidate-indexは**DEFAULT OFF固定の研究text**で、実MCPへ登録/実行していない。ON用の正規gate/trace供給と非公開sinkは未接続。初回contextと別リクエストのsaveを同じtraceへ結ぶ、信頼できるadapterも未接続。

readerの正規本番transport、実発走前のauthority/時刻証拠、正規履歴のexact selected sourceと公式本文reader、実JRA HTML extractorは未接続。現在の権限/経路で存在が確認できていないものを追加取得しない。synthetic-fixture.mjsは既存V11の架空JSON fixtureを再利用しただけで、JRA HTMLや実本番署名ではない。実データ採用0件。

## fail-openと上限

候補既定値: sink待機を全event累計150ms以内、1event 1MiB、累計8MiB、32events、copy走査は20ms/100,000nodes/深さ40の協調的上限。例外・hash/JSON不成立・秘密key/代表的token・期限切れ・容量超過はcaptureだけINCOMPLETE。後続captureの再試行と通常保存の再実行は行わない。

150msは非同期待機予算で、同期JSON/hash/任意getter等をOSレベルでpreemptするhard timeoutではない。getterは拒否し、試験時の任意clock/sinkは通常処理に影響しない信頼できる実装が必要。AbortSignalを無視するsinkの遅延書込みは強制停止できない。非公開sinkにはabort遵守・event_idによる重複拒否・期限確認・改変検知を要求するが、その実環境検証は未実施。OFF時の分岐追加によるCPUコストをゼロとは主張しない。

秘密key、ネスト、JSON応答内のescaped key、Bearer/JWT等を拒否し、エラーに原文を出さない。任意文字列に紛れた全秘密の自動検出保証ではなく、承認済み材料だけを接続する必要がある。私有Eval材料を記録するなら非公開保管の権利/保持期間を先に確認し、Gitには記録しない。

## 検証

validation-summary.jsonと各log。新規capture/接続候補19 PASS、reader9 PASS = **28 PASS / 0 FAIL**。既存V9 24、V10 19、V11 21、V13 9、V14 5 = **78 PASS / 0 FAIL**。V12整合性6 PASS。V15 manifest20ファイル一致、V9〜V15既存229ファイルの前後hash変化0。

観測点を除去すると元v33 indexへbyte単位で復元すること、RPC/from呼出し数不変、OFF無影響、入力改変拒否、hash鎖、不一致、秘密情報、sink失敗/timeout、期限切れ、二重receipt防止、1回保存の模擬継続を検証。readerの実接続、実Edge/Deno実行、本番権限、実公式HTML/署名、実保存/HUB表示のE2Eは**未検証**。模擬保存成功を本番成功と扱わない。

実行: `node research/unified-engine-20261116/v16/capture.test.mjs` と `node research/unified-engine-20261116/v16/evidence-reader.test.mjs`。本番設定・鍵は不要。

## 本番適用可否: NO

必要な承認・差分・rollbackはAPPROVAL_REQUIRED.md。研究候補を作成したことと、未知実レースで公平な正式比較が可能なことは別。実比較0件。46R/623頭は既知開発集合のまま。
