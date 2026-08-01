"use strict";

window.IrunaModal = (() => {
  const modal = document.getElementById("detailModal");
  const title = document.getElementById("modalTitle");
  const category = document.getElementById("modalCategory");
  const details = document.getElementById("modalDetails");
  const closeButton = document.getElementById("modalCloseButton");
  const { escapeHtml, isBlank, formatFormulaText } = window.IrunaUtils;

  function buildBasicRows(item, attributeName) {
    const rows = [
      ["アイテムID", item["アイテムID"]],
      ["表示分類", item["表示分類"] || item["サブ分類"] || item["分類"]],
      ["武器種", item["武器種"]],
      ["属性", attributeName],
      ["基礎ATK", item["基礎ATK"]],
      ["基礎DEF", item["基礎DEF"]],
      ["スロット数", item["スロット数"]],
      ["装着可能箇所", item["装着可能箇所"]],
      ["説明", formatFormulaText(item["説明文"])],
      ["特殊性能", formatFormulaText(item["特殊性能"])],
      ["入手区分", item["入手区分"]],
      ["入手先", item["入手先"]],
      ["マップ", item["マップ"]],
      ["実装日", item["実装日"]]
    ].filter(([, value]) => !isBlank(value));

    return rows.map(([label, value]) => `
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    `).join("");
  }

  function buildEffectText(effect, statName) {
    const display = String(effect["表示文"] || "").trim();
    const value = effect["値"];
    const unit = effect["単位"] || "";
    const hasNumericDisplay = /[-+]?\d/.test(display);
    if (display && (hasNumericDisplay || isBlank(value))) return formatFormulaText(display);
    if (!isBlank(value)) {
      const prefix = Number(value) > 0 ? "+" : "";
      return `${statName}${prefix}${value}${unit}`;
    }
    if (effect["数式"]) return `${formatFormulaText(display || statName)}（${formatFormulaText(effect["数式"])}）`;
    return formatFormulaText(display || statName);
  }

  function buildEffectsSection(effects, statMap, conditionMap) {
    if (!effects.length) {
      return `
        <section class="effect-section">
          <h3>能力</h3>
          <p class="effect-empty">能力データはまだ登録されていません。</p>
        </section>
      `;
    }

    const alwaysEffects = effects.filter(effect => !effect["条件グループID"]);
    const conditionalEffects = effects.filter(effect => effect["条件グループID"]);

    const alwaysHtml = alwaysEffects.length
      ? alwaysEffects.map(effect => {
          const stat = statMap.get(effect["能力ID"]);
          const statName = stat?.["表示名"] || effect["能力ID"];
          return `
            <li class="effect-item">
              <span>${escapeHtml(buildEffectText(effect, statName))}</span>
            </li>
          `;
        }).join("")
      : `<li class="effect-item effect-muted">常時効果なし</li>`;

    const grouped = new Map();
    conditionalEffects.forEach(effect => {
      const groupId = effect["条件グループID"];
      if (!grouped.has(groupId)) {
        grouped.set(groupId, []);
      }
      grouped.get(groupId).push(effect);
    });

    const conditionHtml = grouped.size
      ? [...grouped.entries()].map(([groupId, groupEffects]) => {
          const conditions = conditionMap.get(groupId) || [];
          const conditionLabel = conditions
            .map(condition => condition["表示文"] || `${condition["条件項目"]}${condition["演算子"]}${condition["比較値"]}`)
            .filter(Boolean)
            .join(" ＆ ") || groupId;

          const effectItems = groupEffects.map(effect => {
            const stat = statMap.get(effect["能力ID"]);
            const statName = stat?.["表示名"] || effect["能力ID"];
            return `<li>${escapeHtml(buildEffectText(effect, statName))}</li>`;
          }).join("");

          return `
            <div class="condition-card">
              <div class="condition-label">${escapeHtml(conditionLabel)}</div>
              <ul>${effectItems}</ul>
            </div>
          `;
        }).join("")
      : `<p class="effect-empty">条件付き能力なし</p>`;

    return `
      <section class="effect-section">
        <h3>常時能力</h3>
        <ul class="effect-list">${alwaysHtml}</ul>
      </section>

      <section class="effect-section">
        <h3>条件付き能力</h3>
        <div class="condition-list">${conditionHtml}</div>
      </section>
    `;
  }

  function open(item, context) {
    title.textContent = item["名前"] || "名称未設定";
    category.textContent = item["分類"] || "未分類";

    const attributeName = context.attributeMap.get(item["属性ID"])?.["属性名"] || "";
    const itemEffects = context.effectsByItem.get(item["アイテムID"]) || [];

    details.innerHTML = buildBasicRows(item, attributeName);
    document.getElementById("modalEffectArea").innerHTML = buildEffectsSection(
      itemEffects,
      context.statMap,
      context.conditionMap
    );

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  closeButton.addEventListener("click", close);

  modal.querySelectorAll("[data-close-modal]").forEach(element => {
    element.addEventListener("click", close);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      close();
    }
  });

  return {
    open,
    close
  };
})();
