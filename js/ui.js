"use strict";

window.IrunaUi = (() => {
  const { escapeHtml, normalizeSearchText, isBlank } = window.IrunaUtils;

  const categories = [
    "すべて",
    "武器",
    "体",
    "追加",
    "特殊",
    "クリスタ",
    "アルクリスタ",
    "☆能力",
    "レリック"
  ];

  const elements = {
    itemGrid: document.getElementById("itemGrid"),
    categoryTabs: document.getElementById("categoryTabs"),
    searchInput: document.getElementById("searchInput"),
    resultCount: document.getElementById("resultCount"),
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText")
  };

  function setConnectionStatus(type, text) {
    elements.statusDot.classList.remove("is-online", "is-error");

    if (type === "online") {
      elements.statusDot.classList.add("is-online");
    }

    if (type === "error") {
      elements.statusDot.classList.add("is-error");
    }

    elements.statusText.textContent = text;
  }

  function renderTabs(activeCategory, onSelect) {
    elements.categoryTabs.innerHTML = categories
      .map(category => `
        <button
          type="button"
          class="category-tab ${category === activeCategory ? "is-active" : ""}"
          data-category="${escapeHtml(category)}"
        >
          ${escapeHtml(category)}
        </button>
      `)
      .join("");

    elements.categoryTabs
      .querySelectorAll(".category-tab")
      .forEach(button => {
        button.addEventListener("click", () => {
          onSelect(button.dataset.category);
        });
      });
  }

  function buildMeta(item) {
    const values = [
      item["武器種"],
      item["属性ID"],
      !isBlank(item["基礎ATK"]) ? `ATK ${item["基礎ATK"]}` : "",
      !isBlank(item["基礎DEF"]) ? `DEF ${item["基礎DEF"]}` : "",
      Number(item["スロット数"]) > 0 ? `Slot ${item["スロット数"]}` : ""
    ].filter(Boolean);

    return values
      .map(value => `<span>${escapeHtml(value)}</span>`)
      .join("");
  }

  function renderItems(items, onOpen) {
    elements.resultCount.textContent = `${items.length}件`;

    if (items.length === 0) {
      elements.itemGrid.innerHTML = `
        <div class="state-card">
          条件に一致するデータがありません。
        </div>
      `;
      return;
    }

    elements.itemGrid.innerHTML = items
      .map((item, index) => `
        <article class="item-card" data-item-index="${index}" tabindex="0">
          <div class="item-card-header">
            <div class="item-name">${escapeHtml(item["名前"] || "名称未設定")}</div>
            <span class="badge">${escapeHtml(item["分類"] || "未分類")}</span>
          </div>

          <div class="item-meta">${buildMeta(item)}</div>

          <div class="item-description">
            ${escapeHtml(
              item["説明文"] ||
              item["特殊性能"] ||
              item["タグ概要"] ||
              "説明はまだ登録されていません。"
            )}
          </div>
        </article>
      `)
      .join("");

    elements.itemGrid
      .querySelectorAll(".item-card")
      .forEach(card => {
        const open = () => {
          const item = items[Number(card.dataset.itemIndex)];
          onOpen(item);
        };

        card.addEventListener("click", open);
        card.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        });
      });
  }

  function renderLoading() {
    elements.resultCount.textContent = "読み込み中…";
    elements.itemGrid.innerHTML = `
      <div class="state-card">
        スプレッドシートからデータを取得しています…
      </div>
    `;
  }

  function renderError(message) {
    elements.resultCount.textContent = "取得失敗";
    elements.itemGrid.innerHTML = `
      <div class="state-card is-error">
        ${escapeHtml(message)}
      </div>
    `;
  }

  function filterItems(items, category, query) {
    const normalizedQuery = normalizeSearchText(query);

    return items.filter(item => {
      const categoryMatched =
        category === "すべて" ||
        item["分類"] === category;

      if (!categoryMatched) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableText = [
        item["名前"],
        item["分類"],
        item["サブ分類"],
        item["武器種"],
        item["タグ概要"],
        item["説明文"],
        item["特殊性能"],
        item["入手区分"],
        item["入手先"],
        item["マップ"]
      ]
        .map(normalizeSearchText)
        .join(" ");

      return searchableText.includes(normalizedQuery);
    });
  }

  return {
    elements,
    setConnectionStatus,
    renderTabs,
    renderItems,
    renderLoading,
    renderError,
    filterItems
  };
})();
