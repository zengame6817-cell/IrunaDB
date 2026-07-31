"use strict";

(() => {
  const state = {
    items: [],
    effects: [],
    conditions: [],
    stats: [],
    attributes: [],
    activeCategory: "すべて",
    searchQuery: ""
  };

  const context = {
    effectsByItem: new Map(),
    conditionMap: new Map(),
    statMap: new Map(),
    attributeMap: new Map(),
    searchIndex: new Map()
  };

  const ui = window.IrunaUi;
  const api = window.IrunaApi;
  const modal = window.IrunaModal;
  const { normalizeSearchText } = window.IrunaUtils;

  function buildIndexes() {
    context.effectsByItem.clear();
    context.conditionMap.clear();
    context.statMap.clear();
    context.attributeMap.clear();
    context.searchIndex.clear();

    state.effects.forEach(effect => {
      const itemId = effect["アイテムID"];
      if (!context.effectsByItem.has(itemId)) {
        context.effectsByItem.set(itemId, []);
      }
      context.effectsByItem.get(itemId).push(effect);
    });

    state.conditions.forEach(condition => {
      const groupId = condition["条件グループID"];
      if (!context.conditionMap.has(groupId)) {
        context.conditionMap.set(groupId, []);
      }
      context.conditionMap.get(groupId).push(condition);
    });

    state.stats.forEach(stat => {
      context.statMap.set(stat["能力ID"], stat);
    });

    state.attributes.forEach(attribute => {
      context.attributeMap.set(attribute["属性ID"], attribute);
    });

    state.items.forEach(item => {
      const effectTexts = (context.effectsByItem.get(item["アイテムID"]) || [])
        .map(effect => {
          const statName = context.statMap.get(effect["能力ID"])?.["表示名"] || "";
          const conditions = context.conditionMap.get(effect["条件グループID"]) || [];
          return [
            statName,
            effect["表示文"],
            ...conditions.map(condition => condition["表示文"])
          ].join(" ");
        })
        .join(" ");

      const attributeName =
        context.attributeMap.get(item["属性ID"])?.["属性名"] || "";

      const searchable = [
        item["名前"],
        item["分類"],
        item["サブ分類"],
        item["武器種"],
        attributeName,
        item["タグ概要"],
        item["説明文"],
        item["特殊性能"],
        item["入手区分"],
        item["入手先"],
        item["マップ"],
        effectTexts
      ]
        .map(normalizeSearchText)
        .join(" ");

      context.searchIndex.set(item["アイテムID"], searchable);
    });
  }

  function render() {
    ui.renderTabs(state.activeCategory, category => {
      state.activeCategory = category;
      render();
    });

    const filteredItems = ui.filterItems(
      state.items,
      state.activeCategory,
      state.searchQuery,
      context.searchIndex
    );

    ui.renderItems(filteredItems, context, item => {
      modal.open(item, context);
    });
  }

  async function loadData() {
    ui.renderLoading();
    ui.setConnectionStatus("loading", "接続中");

    try {
      const data = await api.getInitialData();

      for (const [key, value] of Object.entries(data)) {
        if (!Array.isArray(value)) {
          throw new Error(`${key}のデータ形式が正しくありません`);
        }
      }

      Object.assign(state, data);
      buildIndexes();

      ui.setConnectionStatus("online", "接続済み");
      render();
    } catch (error) {
      console.error(error);
      ui.setConnectionStatus("error", "接続エラー");
      ui.renderError(
        `${error.message}。GASのデプロイ最新版と公開設定を確認してください。`
      );
    }
  }

  ui.elements.searchInput.addEventListener("input", event => {
    state.searchQuery = event.target.value;
    render();
  });

  document.getElementById("clearButton").addEventListener("click", () => {
    state.searchQuery = "";
    ui.elements.searchInput.value = "";
    render();
    ui.elements.searchInput.focus();
  });

  document.getElementById("reloadButton").addEventListener("click", loadData);

  loadData();
})();
