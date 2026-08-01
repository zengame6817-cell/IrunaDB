"use strict";

window.IrunaApi = (() => {
  const { API_URL, API_TIMEOUT_MS } = window.IRUNA_CONFIG;
  const { createAbortSignal } = window.IrunaUtils;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function get(action, maxAttempts = 3) {
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
        return payload.data;
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

  async function getInitialData() {
    // GASへ同時に7本投げると、一時的な失敗やタイムアウトが起きやすいため順番に取得します。
    const items = await get("items");
    const effects = await get("effects");
    const conditions = await get("conditions");
    const stats = await get("stats");
    const attributes = await get("attributes");
    const jobs = await get("jobs");
    const relicPatterns = await get("relicPatterns");

    return {
      items,
      effects,
      conditions,
      stats,
      attributes,
      jobs,
      relicPatterns
    };
  }

  return {
    get,
    getInitialData
  };
})();
