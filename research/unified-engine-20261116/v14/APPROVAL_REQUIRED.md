# 本番の追加対応が必要な場合の承認対象

**以下は設計案のみ。候補Edge/RPC/DBの変更実装は行っていない。** 現在の内部DB保存定義はSQL原文取得が中断され未確認なので、既存保存先が全くないとは断定しない。まず現行3関数定義と保存項目の確認が必要。

## A. 通常処理が実際に使った追加材料のcapture

変更候補：既存MCPのpreview/saveハンドラに既定OFFの研究captureオプション。新規CLAIMや別の再取得を記録用に行わず、**通常処理で既に得たローカル変数**を、その加工前後で記録する。

- 初回の最終API contextテキスト、元DB context、ACTIVE scope適用後contextを区別する。
- 通常のOWN target-course queryの戻り行、Eval派生入力、使用したprivate snapshotの版/hash/認可済み参照を区別する。私有コーパスをGitやログへ公開しない。hashだけで本文を取得できたとはしない。
- 提出payload、bridge前後、EYE前後、optional shadow用再取得、保存RPCに実際に渡す7項目を区別する。
- 全てjob/run/trace/context hashと時計を結ぶ。claim_token/API key/認証ヘッダーは記録しない。
- データ表現も区別する：HTTP元byte列、MCP text、内部JS objectのJSON直列化は同じものではない。内部object直列化を「元HTTP原文」と呼ばない。

現在の応答は要約/派生値が中心で、全材料の無加工出力を確認できない。実装前に、受信クライアントが原文を保管できるか、非公開保管先、データ権利、packet/token量、時間予算、失敗時の動作を決める必要がある。structuredContentへ大量データを加えるだけで、低負荷/低コストを保証しない。

## B. 保存後の実FROZENとの結び付け

既存readbackは内部でid/status/payloadを読むが、外向け応答はprediction_idと検証要約だけ。候補は既存の認可済みreadback結果をopt-inで受け取るか、承認済みの読み取り方法で実rowを取得すること。今回その取得は行っていない。

必要な追跡：元ツール呼出しのjob_id/protocol/提出payload hash、保存応答prediction_id、実rowのid/race/circuit/FROZEN/保存時計/実payload。receiptとrowのID一致だけでは、jobへの正しい紐付けと時刻/入力真正性の全てを証明しない。

全7項目やgrade/EYE/コメント/監査の完全一致と、現行readbackが検査する範囲は別。通常補正による提出payloadとの差は正常な可能性があるので、自動修正や再保存をしない。

## 権限・影響・不変条件

- 既存OAuth/許可ユーザー/正規CLAIM/READY/lease/発走締切/未FROZEN条件を維持する。現在のDB定義確認が未完了のため本番可否はNO。
- captureは通常の取得値を観測するだけ。新しいmodel呼出し、追加CLAIM、期限延長、再予想、正式予想の書換えはしない。
- 保存payloadに研究用項目を足さない。通常MCP応答の後方互換性と、既定OFF時の無影響を検証する。
- capture/非公開保管の失敗は研究側だけを未達にし、旧版の正常評価・保存を止めない。保存RPC成功後にcapture失敗しても保存を再試行しない。
- データの出力・保管は新たな本番処理になる。今回承認された研究領域だけでは適用できない。DB schema/ACL変更が必要になった場合は別差分として確認し、勝手にSECURITY DEFINERや権限を増やさない。
- 公式本文/時刻/履歴IDの正規証拠は別の未接続事項。captureを増やすだけで研究採点へ昇格しない。

## 適用前に必要なもの

1. SQL取得の接続問題を解消して既存3定義・保管項目を確認（今回は再試行しない）。既存管理者のDashboardで同じSELECTを参照する方法もあるが、こちらでは実行していない。
2. 上記A/Bの必要範囲・認可済み非公開出力先・既定OFF・時間/容量上限・互換性・rollbackを確定し、**本番候補実装の承認**を得る。
3. 隔離テスト後に本番差分を再提示し、別途deploy承認。通常経路へ未検証captureを入れない。

本作業ではA/Bの実装・deploy・設定変更・実レース操作を行っていない。
