# Draft PR #51 V11更新

V10保存のMCP v29/SQL13関数について、入力・出力・源流の消失箇所を行付きで整理。結合履歴の戻り列、archive集約、context JSON列挙でID/参照/時計が失われる。

正規認証・CLAIM・READY・3分締切・leaseを維持する読み取りsidecar案を追加。READYの上流定義、MVCC競合、exact source lineage、実原文保管・抽出器の未接続を明記。

研究契約/純粋検証器/架空テストを実装。新規21PASS、V9回帰24PASS、V10回帰19PASS、整合性6+5+3検査PASS。架空factはverified=falseで実V5にそのまま入らない。V5根拠共有と順序不変の明示的な架空シミュレーションもPASS。

元独立100点評価器は未回収。追加確認した旧MCPも完成payloadを受け取る入口。実履歴採用0、実レース比較0。本番・main・DB・FROZEN・Cron・デプロイ変更なし。Draft維持。
