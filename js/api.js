"use strict";

window.IrunaApi = (() => {
  const { API_URL, API_TIMEOUT_MS, STATIC_DB_URL, STATIC_DB_TIMEOUT_MS } = window.IRUNA_CONFIG;
  const { createAbortSignal } = window.IrunaUtils;
  const CACHE_KEY = "irunadb.data-cache.v2";
  const CACHE_META_KEY = "irunadb.data-cache-meta.v2";
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
      clearCache();
      return null;
    }
  }

  function writeCache(data, meta = {}) {
    if (!validateData(data)) throw new Error("キャッシュ対象のデータ形式が正しくありません");

    // v3.0.37: localStorage はユーザーのビルド/RG保存を最優先にする。
    // DBが大きい場合は無理に保存せず、毎回 static db.json を取得する。
    const serialized = JSON.stringify(data);
    const MAX_DB_CACHE_CHARS = 3000000;
    if (serialized.length > MAX_DB_CACHE_CHARS) {
      clearCache();
      console.info(`[IrunaDB] DBキャッシュをスキップしました (${serialized.length.toLocaleString()}文字)`);
      return false;
    }

    try {
      localStorage.setItem(CACHE_KEY, serialized);
      localStorage.setItem(CACHE_META_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        updatedAt: meta.updatedAt || meta.generatedAt || "",
        generatedAt: meta.generatedAt || meta.updatedAt || "",
        dataVersion: meta.dataVersion || meta.version || "",
        counts: meta.counts || {},
        source: meta.source || "cache",
        appVersion: window.IRUNA_CONFIG.APP_VERSION
      }));
      return true;
    } catch (error) {
      clearCache();
      if (error?.name === "QuotaExceededError") {
        console.info("[IrunaDB] localStorage容量保護のためDBキャッシュを保存しませんでした");
      } else {
        console.warn("データキャッシュを保存できませんでした", error);
      }
      return false;
    }
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_META_KEY);
    localStorage.removeItem("irunadb.data-cache.v1");
    localStorage.removeItem("irunadb.data-cache-meta.v1");
  }

  async function requestStaticDatabase() {
    const timeout = createAbortSignal(STATIC_DB_TIMEOUT_MS || API_TIMEOUT_MS);
    try {
      const url = new URL(STATIC_DB_URL, location.href);
      url.searchParams.set("_", Date.now());
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: timeout.signal
      });
      if (!response.ok) throw new Error(`静的DB HTTPエラー: ${response.status}`);
      const payload = await response.json();
      const data = payload?.data || payload;
      if (!validateData(data)) throw new Error("静的DBのデータ形式が正しくありません");
      return {
        data,
        meta: {
          source: "static",
          version: payload.version || "",
          dataVersion: payload.version || "",
          generatedAt: payload.generatedAt || payload.updatedAt || "",
          updatedAt: payload.generatedAt || payload.updatedAt || "",
          counts: payload.counts || {}
        }
      };
    } catch (error) {
      if (error.name === "AbortError") throw new Error("静的DBの取得がタイムアウトしました");
      throw error;
    } finally {
      timeout.clear();
    }
  }

  async function request(action, maxAttempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const timeout = createAbortSignal(API_TIMEOUT_MS);
      const url = new URL(API_URL);
      url.searchParams.set("action", action);
      url.searchParams.set("_", Date.now());
      try {
        const response = await fetch(url, { method: "GET", cache: "no-store", redirect: "follow", signal: timeout.signal });
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

  async function get(action, maxAttempts = 3) { return (await request(action, maxAttempts)).data; }

  async function getSequentialData() {
    const result = {};
    for (const key of REQUIRED_KEYS) result[key] = await get(key);
    return result;
  }

  async function getInitialData() {
    // v1.4: GitHub Pagesの静的JSONを最優先。失敗時だけGASへフォールバック。
    try {
      return await requestStaticDatabase();
    } catch (staticError) {
      console.warn("静的DBを利用できないためGASへ切り替えます", staticError);
    }

    try {
      const payload = await request("all", 2);
      if (!validateData(payload.data)) throw new Error("all APIのデータ形式が旧形式です");
      return {
        data: payload.data,
        meta: {
          updatedAt: payload.updatedAt || "",
          generatedAt: payload.updatedAt || "",
          dataVersion: payload.dataVersion || payload.version || "",
          version: payload.dataVersion || payload.version || "",
          counts: payload.counts || {},
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
