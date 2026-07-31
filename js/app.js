"use strict";

(() => {
  const state = {
    items: [],
    activeCategory: "すべて",
    searchQuery: ""
  };

  const ui = window.IrunaUi;
  const api = window.IrunaApi;
  const modal = window.IrunaModal;

  function render() {
    ui.renderTabs(state.activeCategory, category => {
      state.activeCategory = category;
      render();
    });

    const filteredItems = ui.filterItems(
      state.items,
      state.activeCategory,
      state.searchQuery
    );

    ui.renderItems(filteredItems, modal.open);
  }

  async function loadItems() {
    ui.renderLoading();
    ui.setConnectionStatus("loading", "接続中");

    try {
      const items = await api.getItems();

      if (!Array.isArray(items)) {
        throw new Error("APIのデータ形式が正しくありません");
      }

      state.items = items;
      ui.setConnectionStatus("online", "接続済み");
      render();
    } catch (error) {
      console.error(error);
      ui.setConnectionStatus("error", "接続エラー");
      ui.renderError(
        `${error.message}。GASの公開設定とAPI URLを確認してください。`
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

  document.getElementById("reloadButton").addEventListener("click", loadItems);

  loadItems();
})();
