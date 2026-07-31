"use strict";

window.IrunaUtils = (() => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeSearchText(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function isBlank(value) {
    return value === "" || value === null || value === undefined;
  }

  function createAbortSignal(timeoutMs) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    return {
      signal: controller.signal,
      clear: () => clearTimeout(timerId)
    };
  }

  return {
    escapeHtml,
    normalizeSearchText,
    isBlank,
    createAbortSignal
  };
})();
