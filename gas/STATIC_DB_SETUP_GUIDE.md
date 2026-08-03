# IrunaDB 静的DB公開設定（v1.3.5）

## 1. Apps Scriptコードを入れ替える

`gas/Code_v1.3.5_static_db.gs` の内容を、スプレッドシートに紐づくApps Scriptへ貼り付けます。

## 2. GitHubトークンを作成

Fine-grained personal access tokenを作成し、対象リポジトリだけを選択します。Repository permissions の **Contents** を **Read and write** にします。

## 3. スクリプトプロパティを設定

Apps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」に追加します。

- `GITHUB_TOKEN`：作成したトークン
- `GITHUB_OWNER`：GitHubユーザー名
- `GITHUB_REPO`：IrunaDBのリポジトリ名
- `GITHUB_BRANCH`：通常は `main`
- `GITHUB_DB_PATH`：`data/db.json`

## 4. 初回公開

スプレッドシートを再読み込みし、メニューの

**IrunaDB → 公開用DBをGitHubへ更新**

を実行します。初回のみGoogle/GitHubへのアクセス許可が表示されます。

## 5. GitHub Pagesで確認

数十秒後に `data/db.json` がGitHub Pagesから配信されます。アプリは静的JSONを最優先で取得し、取得できない場合だけ従来GASへ自動フォールバックします。

## 注意

- GitHubトークンをHTML・JavaScript・GitHubリポジトリへ直接書かないでください。
- `db.json` は公開情報になります。非公開データは含めないでください。
- データ更新後は、毎回メニューから公開用DB更新を実行してください。
