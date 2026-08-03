# IrunaDB

Iruna Online Database & Build Simulator

## Version

`v1.3.0`

## v1.3.0

- GASの `action=all` による一括取得
- localStorageキャッシュを先に表示し、裏で最新版を取得
- 通信できない場合も保存済みデータでオフライン閲覧
- 旧GASでは個別取得へ自動フォールバック
- 再読込ボタンはキャッシュを使わず強制更新

## 公開手順

1. このフォルダー内のWebアプリファイルをGitHub Pagesへ上書きします。
2. `gas/Code_v1.3.0.gs` の内容を既存GASへ反映します。
3. GASを「新しいデプロイ」または既存デプロイの新バージョンとして公開します。
4. WebアプリURLが変わった場合のみ `js/config.js` の `API_URL` を変更します。
5. GitHub PagesをCtrl+F5で強制再読込します。


## v1.3.5 静的DB配信

`data/db.json`をGitHub Pagesから直接読み込みます。未生成・取得失敗時は従来GASへ自動フォールバックします。設定は `gas/STATIC_DB_SETUP_GUIDE.md` を参照してください。
