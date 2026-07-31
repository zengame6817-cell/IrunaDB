"use strict";

window.IrunaApi = (() => {
  const { API_URL, API_TIMEOUT_MS } = window.IRUNA_CONFIG;
  const { createAbortSignal } = window.IrunaUtils;

  async function get(action) {
    const timeout = createAbortSignal(API_TIMEOUT_MS);
    const url = new URL(API_URL);
    url.searchParams.set("action", action);

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: timeout.signal
      });

      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }

      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error || "APIでエラーが発生しました");
      }

      return payload.data;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("API通信がタイムアウトしました");
      }

      throw error;
    } finally {
      timeout.clear();
    }
  }

  async function getInitialData() {
    const [
      items,
      effects,
      conditions,
      stats,
      attributes,
      jobs
    ] = await Promise.all([
      get("items"),
      get("effects"),
      get("conditions"),
      get("stats"),
      get("attributes"),
      get("jobs")
    ]);

    return {
      items,
      effects,
      conditions,
      stats,
      attributes,
      jobs
    };
  }

  return {
    get,
    getInitialData
  };
})();
