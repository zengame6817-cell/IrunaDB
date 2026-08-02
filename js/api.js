"use strict";

window.IrunaApi = (() => {
  const { API_URL, API_TIMEOUT_MS } = window.IRUNA_CONFIG;
  const { createAbortSignal } = window.IrunaUtils;
  const CACHE_KEY = "irunadb.data-cache.v1";
  const CACHE_META_KEY = "irunadb.data-cache-meta.v1";
  const REQUIRED_KEYS = ["items", "effects", "conditions", "stats", "attributes", "jobs", "relicPatterns"];

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function validateData(data) {
    return data && REQUIRED_KEYS.every(key => Array.isArray(data[key]));
  }

  function readCache() {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      const meta = JSON.parse(localStorage.getItem(CACHE_META_KEY) || "null");
      if (!validateData(data)) return null;
      return { data, meta: meta || {} };
    } catch (error) {
      console.warn("データキャッシュを破棄しました", error);
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_META_KEY);
      return null;
    }
  }

  function writeCache(data, meta = {}) {
    if (!validateData(data)) throw new Error("キャッシュ対象のデータ形式が正しくありません");
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_META_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        updatedAt: meta.updatedAt || "",
        dataVersion: meta.dataVersion || meta.version || "",
        appVersion: window.IRUNA_CONFIG.APP_VERSION
      }));
      return true;
    } catch (error) {
      // 容量超過時は古いキャッシュを消し、アプリ本体の動作は継続します。
      console.warn("データキャッシュを保存できませんでした", error);
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_META_KEY);
      return false;
    }
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_META_KEY);
  }

  async function request(action, maxAttempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const timeout = createAbortSignal(API_TIMEOUT_MS);
      const url = new URL(API_URL);
      url.searchParams.set("action", action);
      url.searchParams.set("_", Date.now());
      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          redirect: "follow",
          signal: timeout.signal
        });
        if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);
        const payload = await response.json();
        if (!payload.success) throw new Error(payload.error || "APIでエラーが発生しました");
        return payload;
      } catch (error) {
        lastError = error.name === "AbortError"
          ? new Error(`API通信がタイムアウトしました (${action})`)
          : new Error(`${error.message} (${action})`);
        if (attempt < maxAttempts) await sleep(500 * attempt);
      } finally {
        timeout.clear();
      }
    }
    throw lastError;
  }

  async function get(action, maxAttempts = 3) {
    return (await request(action, maxAttempts)).data;
  }

  async function getSequentialData() {
    const result = {};
    for (const key of REQUIRED_KEYS) result[key] = await get(key);
    return result;
  }

  async function getInitialData() {
    // v1.3 GASでは全データを1回で取得。未更新の旧GASなら個別取得へ自動フォールバックします。
    try {
      const payload = await request("all", 2);
      if (!validateData(payload.data)) throw new Error("all APIのデータ形式が旧形式です");
      return {
        data: payload.data,
        meta: {
          updatedAt: payload.updatedAt || "",
          dataVersion: payload.dataVersion || payload.version || "",
          source: "all"
        }
      };
    } catch (allError) {
      console.warn("一括APIを利用できないため個別取得へ切り替えます", allError);
      const data = await getSequentialData();
      return { data, meta: { source: "sequential" } };
    }
  }

  return { get, getInitialData, readCache, writeCache, clearCache, validateData };
})();
