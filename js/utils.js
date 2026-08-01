"use strict";
window.IrunaUtils = (() => {
  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function normalizeSearchText(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, ""); }
  function isBlank(value) { return value === "" || value === null || value === undefined; }

  function formatFormulaText(value) {
    let text = String(value ?? "").trim();
    if (!text) return "";

    const jobNames = { Mage: "魔法職", Sniper: "スナイパー", Enchanter: "エンチャンター" };

    text = text
      .replace(/If \[([A-Za-z]+) > (\d+)\] then /gi, (_, key, num) => `${key}${num}超の場合、`)
      .replace(/If \[([A-Za-z]+) < (\d+)\] then /gi, (_, key, num) => `${key}${num}未満の場合、`)
      .replace(/If \[(Mage|Sniper|Enchanter)\] then /gi, (_, job) => `${jobNames[job] || job}の場合、`)
      .replace(/When equip \[([^\]]+)\] then /gi, (_, name) => `「${name}」装備時、`);

    const convertTokens = block => {
      const tokens = [...block.matchAll(/\[([^\]]+)\]/g)].map(match => match[1].trim());
      if (!tokens.length) return block;

      const variables = new Map();
      const outputs = [];

      const readableExpression = expression => String(expression)
        .replace(/\bLv\b/g, "Lv")
        .replace(/\s*[·*]\s*/g, "×")
        .replace(/\s*\/\s*/g, "÷")
        .replace(/\s*\+\s*/g, "＋")
        .replace(/\s*-\s*/g, "－");

      const resolve = expression => {
        let result = readableExpression(expression);
        for (const [name, stored] of variables.entries()) {
          result = result.replace(new RegExp(`\\b${name}\\b`, "g"), `（${stored}）`);
        }
        return result;
      };

      for (const token of tokens) {
        if (jobNames[token]) {
          outputs.push(`${jobNames[token]}の場合`);
          continue;
        }

        const assignment = token.match(/^([XY])\s*=\s*(.+)$/i);
        if (assignment) {
          variables.set(assignment[1], resolve(assignment[2]));
          continue;
        }

        const increase = token.match(/^(.*?)\s*up by\s*(.+)$/i);
        if (increase) {
          const target = increase[1].trim() || "能力";
          const amount = resolve(increase[2].trim());
          outputs.push(`${target}が${amount}分増加`);
          continue;
        }

        outputs.push(resolve(token));
      }

      return outputs.length ? outputs.join("、") : "";
    };

    text = text.replace(/(?:\[[^\]]+\]\s*)+/g, convertTokens);
    return text.replace(/\s+/g, " ").trim();
  }

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
  return { escapeHtml, normalizeSearchText, isBlank, formatFormulaText, createAbortSignal, encodeBuild, decodeBuild };
})();
