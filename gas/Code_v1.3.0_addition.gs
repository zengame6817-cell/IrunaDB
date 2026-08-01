/**
 * IrunaDB v1.3.0 一括取得用追加コード
 *
 * 既存GASの doGet(e) 内で action === "all" の場合に
 * return createJsonResponse_(getAllDataV13_());
 * を呼び出してください。
 *
 * 下記 ACTION_HANDLERS の右側は、既存GASで各actionの配列を返している関数名へ変更します。
 * 例: items: getItems_  / effects: getEffects_
 */

const IRUNA_DATA_VERSION = "1.3.0";
const IRUNA_CACHE_SECONDS = 300;

function getAllDataV13_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = "irunadb-all-v13";
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // ここだけ既存GASの関数名に合わせてください。
  const ACTION_HANDLERS = {
    items: () => getDataByAction_("items"),
    effects: () => getDataByAction_("effects"),
    conditions: () => getDataByAction_("conditions"),
    stats: () => getDataByAction_("stats"),
    attributes: () => getDataByAction_("attributes"),
    jobs: () => getDataByAction_("jobs"),
    relicPatterns: () => getDataByAction_("relicPatterns")
  };

  const data = {};
  Object.keys(ACTION_HANDLERS).forEach(key => {
    const value = ACTION_HANDLERS[key]();
    if (!Array.isArray(value)) throw new Error(key + " が配列ではありません");
    data[key] = value;
  });

  const result = {
    success: true,
    action: "all",
    dataVersion: IRUNA_DATA_VERSION,
    updatedAt: new Date().toISOString(),
    data: data
  };

  const json = JSON.stringify(result);
  // CacheServiceは1件100KB制限があるため、超える場合はキャッシュせず返します。
  if (json.length < 95000) cache.put(cacheKey, json, IRUNA_CACHE_SECONDS);
  return result;
}

/** 既存のレスポンス生成関数がない場合に使用 */
function createJsonResponse_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 既存GASの個別action処理を関数化してここから呼び出してください。
 * このままでは意図的にエラーになります。既存コードに合わせて置換が必要です。
 */
function getDataByAction_(action) {
  throw new Error("getDataByAction_(\"" + action + "\") を既存GASの取得処理へ接続してください");
}
