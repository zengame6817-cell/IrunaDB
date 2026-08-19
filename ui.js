"use strict";
window.IrunaUi = (() => {
  const { escapeHtml, normalizeSearchText, isBlank, formatFormulaText } = window.IrunaUtils;
  const categories = ["すべて", "武器", "体", "追加", "特殊", "クリスタ", "アルクリスタ", "☆能力", "レリック"];
  const elements = {
    itemGrid: document.getElementById("itemGrid"), categoryTabs: document.getElementById("categoryTabs"),
    searchInput: document.getElementById("searchInput"), resultCount: document.getElementById("resultCount"),
    statusDot: document.getElementById("statusDot"), statusText: document.getElementById("statusText")
  };
  function setConnectionStatus(type, text) {
    elements.statusDot.classList.remove("is-online", "is-error");
    if (type === "online") elements.statusDot.classList.add("is-online");
    if (type === "error") elements.statusDot.classList.add("is-error");
    elements.statusText.textContent = text;
  }
  function renderTabs(activeCategory, onSelect) {
    elements.categoryTabs.innerHTML = categories.map(category => `<button type="button" class="category-tab ${category === activeCategory ? "is-active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("");
    elements.categoryTabs.querySelectorAll(".category-tab").forEach(button => button.addEventListener("click", () => onSelect(button.dataset.category)));
  }
  function buildMeta(item, attributeMap) {
    const attributeName = attributeMap.get(String(item["属性ID"] || ""))?.["属性名"] || "";
    return [item["武器種"], attributeName ? `${attributeName}属性` : "", !isBlank(item["基礎ATK"]) ? `ATK ${item["基礎ATK"]}` : "", !isBlank(item["基礎DEF"]) ? `DEF ${item["基礎DEF"]}` : "", Number(item["スロット数"]) > 0 ? `Slot ${item["スロット数"]}` : ""].filter(Boolean).map(value => `<span>${escapeHtml(value)}</span>`).join("");
  }
  function renderItems(items, context, onOpen, favorites = new Set(), onFavorite = () => {}) {
    const PAGE_SIZE = 120;
    elements.resultCount.textContent = `検索結果 ${items.length}件`;
    if (!items.length) {
      elements.itemGrid.innerHTML = `<div class="state-card">条件に一致するデータがありません。</div>`;
      elements.itemGrid.onclick = null;
      elements.itemGrid.onkeydown = null;
      return;
    }

    let visibleCount = Math.min(PAGE_SIZE, items.length);
    const paint = () => {
      const visibleItems = items.slice(0, visibleCount);
      elements.itemGrid.innerHTML = visibleItems.map((item, index) => {
        const id = String(item["アイテムID"] || "");
        const favorite = favorites.has(id);
        return `<article class="item-card" data-item-index="${index}" tabindex="0"><div class="item-card-header"><div class="item-card-title-area"><button class="favorite-button" type="button" data-favorite-id="${escapeHtml(id)}" aria-label="お気に入り${favorite ? "解除" : "登録"}" title="お気に入り${favorite ? "解除" : "登録"}">${favorite ? "★" : "☆"}</button><div class="item-name">${escapeHtml(item["名前"] || "名称未設定")}</div></div><span class="badge">${escapeHtml(item["表示分類"] || item["サブ分類"] || item["分類"] || "未分類")}</span></div><div class="item-meta">${buildMeta(item, context.attributeMap)}</div><div class="item-description">${escapeHtml(formatFormulaText(item["説明文"] || item["特殊性能"] || "説明はまだ登録されていません。"))}</div></article>`;
      }).join("") + (visibleCount < items.length
        ? `<button class="button button-secondary iruna-load-more" type="button" data-load-more-items>さらに表示（残り ${items.length - visibleCount}件）</button>`
        : "");
    };

    paint();

    // v2.9.19: 各カードへ個別イベントを大量登録せず、一覧コンテナ1個で処理する。
    elements.itemGrid.onclick = event => {
      const favoriteButton = event.target.closest("[data-favorite-id]");
      if (favoriteButton) {
        event.stopPropagation();
        onFavorite(favoriteButton.dataset.favoriteId);
        return;
      }
      const loadMore = event.target.closest("[data-load-more-items]");
      if (loadMore) {
        visibleCount = Math.min(items.length, visibleCount + PAGE_SIZE);
        paint();
        return;
      }
      const card = event.target.closest(".item-card");
      if (card) onOpen(items[Number(card.dataset.itemIndex)]);
    };
    elements.itemGrid.onkeydown = event => {
      if ((event.key !== "Enter" && event.key !== " ") || event.target.closest("button")) return;
      const card = event.target.closest(".item-card");
      if (!card) return;
      event.preventDefault();
      onOpen(items[Number(card.dataset.itemIndex)]);
    };
  }
  function renderLoading() { elements.resultCount.textContent = "読み込み中…"; elements.itemGrid.innerHTML = `<div class="state-card">アイテム・能力・条件データを取得しています…</div>`; }
  function renderError(message) { elements.resultCount.textContent = "取得失敗"; elements.itemGrid.innerHTML = `<div class="state-card is-error">${escapeHtml(message)}</div>`; }
  function filterItems(items, category, query, searchIndex) {
    const normalizedQuery = normalizeSearchText(query);
    return items.filter(item => (category === "すべて" || item["分類"] === category) && (!normalizedQuery || (searchIndex.get(String(item["アイテムID"])) || "").includes(normalizedQuery)));
  }
  return { elements, setConnectionStatus, renderTabs, renderItems, renderLoading, renderError, filterItems };
})();
