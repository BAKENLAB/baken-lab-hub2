# PR83 保存復旧の状態

成果物の元manifest76件はhash不一致0。変更前の全体backupを /tmp/PR83_preserved_before_save.tar.gz に作成した。

GitHub読取りでPR83はDraft、fix/jra-scoring-integrity-gate-20261121、HEAD 605568efeeddbc9d1a21689e9891e65cc3d167dc。以前の要求から計算したtree2件はGETで404だったが、呼出しの取消・最終状態まで証明したものではない。Contents APIによるengine-lock.json新規作成と、未存在blobへの作成も応答待ちで中断。両書込みの実行結果は未確定。同一要求は再送しない。

GitHubアプリ設定は app_permission=Allow all actions。承認待ち設定が原因とは確認できない。ユーザーのrepo push権限と、実際のAPI呼出しの完了は別である。CLIはproxyconnect/socket operation not permittedでGitHub到達前に失敗。追加権限要求・プロキシ迂回・認証変更は行っていない。

recovery-validation/test-results.jsonはローカル再検証58 PASS/0 FAIL。GitHub反映後の検証ではない。元76成果物はそのまま、今回のlogは別ディレクトリに保存した。

verify-declared-replay.mjsは13R194頭で、保存済み基礎点・因子points・既存bridgeを固定入力として2回の独立整数検算と順位導出を行う。全13Rで最終スコア/順位一致、因子の処理順を逆にしても一致。tieは既存bridgeのscore降順→記録済みprebridge rank→馬番に限定し、新しい能力順位基準は作らない。

これは元の競走情報から根拠別pointsを生成する100点採点式の再現ではない。正式な配点生成器・発走前入力原文・原本ID/取得時計resolverが未接続で、ability_formula_reproduced=false、将来実レース検証0件。本番へ接続しない。

残る実装課題: 正式な根拠→points生成元と承認版の回収、正規原本resolver接続、固定engine hashと独立再計算の一致、本番と同じ隔離SQL/Edge検証、未知レースの発走前実証。これらが揃うまで既存FROZEN・CLAIM・MCP・DB・Cronを変更しない。

保存再開条件: 未確定書込みの完了/取消を確認し、MCP書込み呼出しで応答を得られる状態を復旧するか、許可済みCLI通信環境を用意する。HEAD/差分を再確認してから保存する。権限設定の緩和を自動で行わない。
