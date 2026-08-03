# IrunaDB Static Database

Apps Scriptの「公開用DBをGitHubへ更新」を実行すると、このフォルダの `db.json` が自動更新されます。

アプリは `data/db.json` を最優先で読み込み、取得できない場合だけ従来のGAS APIへ切り替わります。
