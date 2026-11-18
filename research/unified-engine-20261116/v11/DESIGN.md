# 正規ゲートを維持する読み取り専用sidecar案

設計のみ。以下のMCP/RPC/ACL/署名保管の変更は実装・適用していない。現在のcontextと保存処理はそのまま維持する。

## 最小の変更箇所

1. **正規MCPの既存contextハンドラに、既定OFFの研究証拠オプション**。既存OAuth/許可ユーザー認証を維持し、正規CLAIMのjob_idだけを受ける。任意レースや任意SQLによる証拠取得を許さない。既存text contextと`structuredContent.context`は変更せず、オプション時だけ兄弟要素`research_evidence`を返す。ツール増設・本番設定変更は今回しない。
2. **サービス専用の読み取りRPC＋内部証拠reader**。最初に既存CLAIM条件を再使用し、そのjobの既存contextの履歴だけを対象とする。元履歴を上書きせず、選択元と証拠の一意対応・原文・取得時計を別オブジェクトにする。現在の`jra_merged_flat_history_v2`の戻り型は依存関数があるため変更しない。
3. **Edgeで最終context文字列とsidecarを固定・署名**。全既存加工を完了したcontextを一度だけJSON文字列化し、そのバイト列と全ACTIVE馬ID集合をハッシュ化。sidecarをcontextの内部に埋めて自己参照ハッシュにしない。署名は登録済みの承認鍵と公開鍵レジストリで行う。既存APIキーやservice_role keyを署名鍵へ流用しない。実鍵の登録・設定は未実施。

既存予想へのFAIL-OPEN：オプション証拠の欠損・取得例外・検証失敗は、研究sidecarのUNAVAILABLE/nullだけにする。既存context、予想順位、保存payload、ジョブ状態には手を加えない。証拠がない履歴を研究採点へ進めるFAIL-OPENではない。

## 読み取り・認証・権限の条件

- 現行`jra_claimed_context`のCLAIMED、lease、RUNNING、JRA_QUEUE_RESCUE所有、JRA、未FROZEN、発走3分前、active protocol一意性の条件を再使用する。現行にある障害除外も維持する。研究側は対象レースの平地が明示確認できない場合も証拠を利用不可にするが、既存予想の条件は変更しない。
- READYの正確な判定経路は保存済み13関数の範囲では確定できない。上流CLAIM/readinessの現行実装を取得して同じ判定を再使用し、契約版を固定するまで適用不可。単にcontext取得成功からREADY=trueを作らない。
- 新しい公開RPCが必要ならSECURITY INVOKERを第一候補とする。`search_path=pg_catalog`固定、全テーブル/関数を完全修飾。PUBLIC/anon/authenticatedのEXECUTEを明示剥奪しservice_roleだけに許可。必要なSELECT権限が足りない場合は停止し、SECURITY DEFINERで解消しない。既存関数の権限・定義は変更しない。private schemaをData APIへ新規公開しない。
- 任意のhorse/raceパラメータで直接private関数を呼ぶ経路は作らない。新規CLAIM、lease延長、row/advisory lock、ジョブUPDATE、再登録、保存は行わない。
- 認証済みサーバーが入力と証拠を束ねる。クライアントの`verified=true`・任意body・任意context hashを信じて署名するサービスにはしない。

## 選択元を一意に証明できない場合

元の結合履歴はLIVE優先で`distinct on(prior_date)`され、同一日・同優先順位のtie-breakが明示されていない。一致しそうなarchiveを後から見付けても「当時選ばれた元レコード」とは断定しない。

内部readerは、同一の入力行・既存の優先規則で選択元を一意に特定でき、既存contextに出た各値と完全一致する場合だけ`EXACT_SELECTED_SOURCE`を出す。LIVEの場合は元の保存JSON行・公式参照と対応する原本の一致も必要。別archiveが値を裏付けるだけの`CORROBORATING_ARCHIVE_ONLY`、name-only、複数候補、ID/時計/原文欠落は採用不可。新しいtie-breakで既存の履歴選択を変えない。

厳密な選択元を保持する仕組みが現在の資料だけで設計しきれない場合は、その行をUNAVAILABLEにする。原本参照が存在しなければ、SELECTで取得時刻や原文を新しく作った扱いにしない。

## スナップショットと再確認

同じSQL文内で前後に状態SELECTしても、同一MVCC snapshotなら並行状態変更を検出できる保証はない。この点を「二重チェックで競合解消済み」としない。

候補手順は、認証→guard before→一貫した読取snapshotでcontext元行と証拠を取得→別の新しい読取snapshotでguard after→最終contextを固定→署名。afterは元データ再生成ではなく、job/run/lease/READY/未FROZEN/締切/protocolの再確認とする。before/afterのjob・run・leaseが変われば研究証拠を無効にする。実SQLのsnapshot挙動・並行処理検証は未実施。

この証明は読取時点の状態に限定され、将来の保存許可ではない。直後に状態が変わる可能性は既存の正式保存RPCの最終ゲートで再判定する。研究側は保存RPCを呼ばない。receiptの許容経過時間60秒は研究契約の仮ガードで、既存CLAIM15分や保存期限を延長する設定ではない。事前登録で固定し、実運用前に検証が必要。

## 原文・時刻・IDの結び付け

- archiveのrun_id/race_id/horse_idとcurrent horse_id、公式原文中の馬ID/馬名/当時馬番、公式レース参照/日/場/R/距離/平地区分/着順/頭数を照合する。
- 原文は元バイト列で照合する。Shift_JISをUTF-8へ変えたHTMLで元のSHA-256一致としない。gzipの場合は展開後の元バイト列を照合する。
- body hash、非公開保管参照、URL、fetched_at/recorded_atを要求。archive.source_checked_atとbody.fetched_atの対応も要求する。異なる再取得回を曖昧に結合しない。
- 署名されたレコードIDはDB行との対応を証明者が保証する。HTMLそのものにDB UUIDがあると仮定しない。HTML抽出器は公式レースと馬の意味を検証し、body hashだけで内容を確認済みにしない。
- 全ACTIVE hashはcontextの集合への結び付け。現行状態の公式独立再確認を、それだけで証明したとは扱わない。必要な当日原文証跡も正規経路で取得する。
- 現在のHTML証拠テーブルには本文列がない。実保管参照、認可済み本文読取経路、実HTML抽出器・依存版、信頼できる発走前時計/署名者は未接続。

## V9/V10への接続方法

元contextは変更しない。将来の対比較では、context＋同じ検証済みsidecar原文/ハッシュを含めた**新しい共通入力bundle**を事前固定し、両方式へ同じものを渡す。統合版だけが追加証拠を読める比較にしない。これは過去FROZEN入力を完全復元した証明ではない。

V11は検証済み原子的fact候補を返す契約であり、`r/f.scoring_priors`、点数、順位、EYEを自動変更しない。正式なV5/V6への接続は別途、既存採用条件と源流の対応を検証する。独立2因子・共有原子予算・根拠root予算を変更しない。欠損はnull/未採用のまま。

## 実運用前の順序

1. 実READY経路、認証/ACL、選択元reader、本文保管参照を読み取り確認。
2. 元評価器/完全依存、公式HTML抽出器、署名者と時計を承認・固定。未回収のまま代用品で比較しない。
3. オフラインと隔離DBで認可・期限・MVCC・一意性・fail-openを検証。今回未実施。
4. 別途承認後にだけ正規MCPへopt-in導入し、正規CLAIMで前後gateと同一入力を実証。
5. 発走前原文とreceiptを固定し、V9の事前登録を確認。既知46R/623頭を対象外とし、未知の実レース1Rで両方式を検証。

本番適用可能：NO。今回の納品は設計・純粋検証器・架空入力試験まで。
