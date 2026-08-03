# IrunaDB v1.4.0

## 主な変更
- GitHub Pages上の `data/db.json` を最優先で取得
- 静的JSON失敗時のみGASへ自動フォールバック
- ライトテーマを標準化し、ダークテーマ切替を追加
- DB取得元・バージョン・更新日時を設定画面へ表示
- Service Workerは `db.json` を固定キャッシュしない構成

## 更新方法
1. ZIP内のファイルをGitHubリポジトリへ上書き
2. スプレッドシートの「IrunaDB → 公開用DBをGitHubへ更新」を実行
3. GitHub Pages反映後にサイトを再読み込み
