"use strict";
(() => {
  const KEY = "irunadb.theme.v2";
  const root = document.documentElement;
  const button = document.getElementById("themeToggle");
  const label = document.getElementById("themeToggleLabel");

  function preferredTheme() {
    const saved = localStorage.getItem(KEY);
    return saved === "dark" ? "dark" : "light";
  }

  function apply(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = safeTheme;
    localStorage.setItem(KEY, safeTheme);
    const dark = safeTheme === "dark";
    button?.setAttribute("aria-pressed", String(dark));
    if (button) button.title = dark ? "ライトテーマへ切替" : "ダークテーマへ切替";
    if (label) label.textContent = dark ? "☀ ライト" : "☾ ダーク";
  }

  apply(preferredTheme());
  button?.addEventListener("click", () => apply(root.dataset.theme === "dark" ? "light" : "dark"));
})();
