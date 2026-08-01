# GAS v1.3.0 更新手順

## まず確認

Webアプリだけ先にGitHubへ上書きしても動きます。旧GASの場合は自動的に7回の個別取得へ戻り、取得後のデータをブラウザへ保存します。

完全な「通信1回」にするには、既存GASへ `action=all` を追加します。

## 追加位置

既存の `doGet(e)` のaction分岐へ、次を追加します。

```javascript
if (action === "all") {
  return createJsonResponse_(getAllDataV13_());
}
```

次に `Code_v1.3.0_addition.gs` をGASプロジェクトへ追加します。

## 必須調整

同ファイル内の `getDataByAction_(action)` を、現在の個別actionで使用している取得処理へ接続します。

既存コードが次のような構造なら、

```javascript
if (action === "items") data = readSheet_("ITEMS");
```

次のようにします。

```javascript
function getDataByAction_(action) {
  const sheetMap = {
    items: "ITEMS",
    effects: "EFFECTS",
    conditions: "CONDITIONS",
    stats: "STATS",
    attributes: "ATTRIBUTES",
    jobs: "JOBS",
    relicPatterns: "RELIC_PATTERNS"
  };
  return readSheet_(sheetMap[action]);
}
```

シート名・関数名は現在のGASに合わせてください。

## デプロイ

1. GASを保存
2. 「デプロイ」→「デプロイを管理」
3. 編集から新しいバージョンを選択してデプロイ
4. URLが変わらなければGitHub側の設定変更は不要
5. `...?action=all` を開き、`success:true` と7種類の配列が返ることを確認
