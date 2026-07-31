# IrunaDB

Iruna Online Database & Build Simulator

## Version

`v0.1.0`

## 実装済み

- Google Apps Script API接続
- `ITEM_MASTER`の取得
- アイテム一覧表示
- 分類タブ
- 名前・タグ・説明検索
- アイテム詳細モーダル
- スマートフォン対応
- API通信タイムアウト処理
- 再読込機能

## API

```text
https://script.google.com/macros/s/AKfycbzZ3XbV1kS3zm8KYx4Ou3CeUzbVrVVUnixewJ2ZqU5zdyzxDIAev5rPTCKBoje2YkiL3g/exec?action=items
```

API URLは次のファイルで管理しています。

```text
js/config.js
```

## GitHub Pages

GitHubのリポジトリで以下を設定します。

1. `Settings`
2. `Pages`
3. `Deploy from a branch`
4. Branchを`main`
5. Folderを`/ (root)`
6. `Save`

## ファイル構成

```text
IrunaDB/
├ index.html
├ css/
│  └ style.css
├ js/
│  ├ config.js
│  ├ utils.js
│  ├ api.js
│  ├ modal.js
│  ├ ui.js
│  └ app.js
├ docs/
│  ├ API.md
│  └ DEVELOPMENT.md
└ README.md
```

## 次の予定

- EFFECT_MASTER連携
- CONDITION_MASTER連携
- 属性名のID表示から名称表示への変更
- 能力検索
- シミュレーター画面
