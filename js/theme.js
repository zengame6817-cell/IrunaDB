"use strict";
(() => {
  const KEY = "irunadb.theme.v1";
  const root = document.documentElement;
  const button = document.getElementById("themeToggle");
  const label = document.getElementById("themeToggleLabel");

  function preferredTheme() {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
    return "light";
  }

  function apply(theme) {
    root.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
    const dark = theme === "dark";
    if (button) {
      button.setAttribute("aria-pressed", String(dark));
      button.title = dark ? "ライトテーマへ切替" : "ダークテーマへ切替";
    }
    if (label) label.textContent = dark ? "☀ ライト" : "☾ ダーク";
  }

  apply(preferredTheme());
  button?.addEventListener("click", () => apply(root.dataset.theme === "dark" ? "light" : "dark"));
})();
