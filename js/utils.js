"use strict";
window.IrunaUtils = (() => {
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function normalizeSearchText(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, ""); }
  function isBlank(value) { return value === "" || value === null || value === undefined; }
  function createAbortSignal(timeoutMs) {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(timerId) };
  }
  function encodeBuild(build) {
    const json = JSON.stringify(build);
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  }
  function decodeBuild(value) {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  return { escapeHtml, normalizeSearchText, isBlank, createAbortSignal, encodeBuild, decodeBuild };
})();
