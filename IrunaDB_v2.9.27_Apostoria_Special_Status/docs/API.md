# IrunaDB API

## エンドポイント

Google Apps ScriptのWebアプリURLへ`action`を指定します。

```text
?action=items
?action=effects
?action=conditions
?action=stats
?action=attributes
?action=attributeEffects
?action=jobs
?action=tags
?action=itemTags
?action=relicPatterns
?action=all
```

## v0.1.0で使用するAPI

```text
?action=items
```

## 正常レスポンス例

```json
{
  "success": true,
  "action": "items",
  "updatedAt": "2026-07-31T00:00:00.000Z",
  "data": []
}
```

## 方針

- GASはスプレッドシートをJSON化する役割に限定する
- 計算・検索・条件判定はブラウザ側で行う
- 名前ではなくIDで関連付ける
