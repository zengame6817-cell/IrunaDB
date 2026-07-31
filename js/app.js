"use strict";
(() => {
  const SLOT_DEFS = [
    { key: "weapon", label: "武器", category: "武器", icon: "⚔" },
    { key: "body", label: "体", category: "体", icon: "🛡" },
    { key: "additional", label: "追加", category: "追加", icon: "✦" },
    { key: "special", label: "特殊", category: "特殊", icon: "◆" },
    { key: "decoration", label: "装飾", category: "装飾", aliases: ["装飾", "装飾品"], icon: "◇" }
  ];
  const state = { items: [], effects: [], conditions: [], stats: [], attributes: [], activeCategory: "すべて", searchQuery: "", activeView: "build", build: { weapon: null, body: null, additional: null, special: null, decoration: null }, pickerSlot: null, pickerQuery: "" };
  const context = { itemsById: new Map(), effectsByItem: new Map(), conditionMap: new Map(), statMap: new Map(), attributeMap: new Map(), searchIndex: new Map() };
  const ui = window.IrunaUi, api = window.IrunaApi, modal = window.IrunaModal;
  const { normalizeSearchText, escapeHtml, encodeBuild, decodeBuild, isBlank } = window.IrunaUtils;

  const equipmentSlots = document.getElementById("equipmentSlots"), totalEffects = document.getElementById("totalEffects"), selectedCount = document.getElementById("selectedCount");
  const pickerModal = document.getElementById("pickerModal"), pickerTitle = document.getElementById("pickerTitle"), pickerList = document.getElementById("pickerList"), pickerSearchInput = document.getElementById("pickerSearchInput");

  function buildIndexes() {
    Object.values(context).forEach(value => value instanceof Map && value.clear());
    state.items.forEach(item => context.itemsById.set(String(item["アイテムID"]), item));
    state.effects.forEach(effect => { const id = String(effect["アイテムID"]); if (!context.effectsByItem.has(id)) context.effectsByItem.set(id, []); context.effectsByItem.get(id).push(effect); });
    state.conditions.forEach(condition => { const id = String(condition["条件グループID"]); if (!context.conditionMap.has(id)) context.conditionMap.set(id, []); context.conditionMap.get(id).push(condition); });
    state.stats.forEach(stat => context.statMap.set(String(stat["能力ID"]), stat));
    state.attributes.forEach(attribute => context.attributeMap.set(String(attribute["属性ID"]), attribute));
    state.items.forEach(item => {
      const effectTexts = (context.effectsByItem.get(String(item["アイテムID"])) || []).map(effect => [context.statMap.get(String(effect["能力ID"]))?.["表示名"], effect["表示文"]].join(" ")).join(" ");
      const attributeName = context.attributeMap.get(String(item["属性ID"]))?.["属性名"] || "";
      context.searchIndex.set(item["アイテムID"], [item["名前"], item["分類"], item["サブ分類"], item["武器種"], attributeName, item["タグ概要"], item["説明文"], item["特殊性能"], effectTexts].map(normalizeSearchText).join(" "));
    });
  }

  function setView(view) {
    state.activeView = view;
    document.querySelectorAll(".main-tab").forEach(tab => tab.classList.toggle("is-active", tab.dataset.view === view));
    document.querySelectorAll(".app-view").forEach(section => section.classList.toggle("is-active", section.id === `view-${view}`));
  }

  function itemMatchesSlot(item, slot) {
    const category = String(item["分類"] || "").trim();
    if (slot.aliases) return slot.aliases.includes(category);
    return category === slot.category;
  }

  function renderBuild() {
    equipmentSlots.innerHTML = SLOT_DEFS.map(slot => {
      const item = state.build[slot.key] ? context.itemsById.get(String(state.build[slot.key])) : null;
      return `<article class="equipment-slot ${item ? "is-selected" : ""}">
        <button class="slot-main" type="button" data-slot-pick="${slot.key}">
          <span class="slot-icon">${slot.icon}</span>
          <span class="slot-content"><span class="slot-label">${slot.label}</span><strong>${escapeHtml(item?.["名前"] || "未選択")}</strong><small>${item ? escapeHtml(item["武器種"] || item["サブ分類"] || "タップして変更") : "タップして選択"}</small></span>
          <span class="slot-arrow">›</span>
        </button>
        ${item ? `<button class="slot-remove" type="button" data-slot-remove="${slot.key}" aria-label="${slot.label}を解除">×</button>` : ""}
      </article>`;
    }).join("");
    equipmentSlots.querySelectorAll("[data-slot-pick]").forEach(button => button.addEventListener("click", () => openPicker(button.dataset.slotPick)));
    equipmentSlots.querySelectorAll("[data-slot-remove]").forEach(button => button.addEventListener("click", event => { event.stopPropagation(); state.build[button.dataset.slotRemove] = null; syncUrl(false); renderBuild(); }));
    renderTotals();
  }

  function effectLabel(effect) {
    if (effect["表示文"]) return String(effect["表示文"]);
    const stat = context.statMap.get(String(effect["能力ID"]));
    const name = stat?.["表示名"] || effect["能力ID"] || "能力";
    const value = Number(effect["値"] || 0), unit = effect["単位"] || "";
    return `${name} ${value > 0 ? "+" : ""}${value}${unit}`;
  }

  function renderTotals() {
    const selectedIds = Object.values(state.build).filter(Boolean).map(String);
    selectedCount.textContent = `${selectedIds.length} / ${SLOT_DEFS.length}`;
    const totals = new Map(), textOnly = [];
    selectedIds.forEach(id => (context.effectsByItem.get(id) || []).filter(effect => isBlank(effect["条件グループID"])).forEach(effect => {
      const statId = String(effect["能力ID"] || "");
      const numeric = Number(effect["値"]);
      if (statId && Number.isFinite(numeric) && !isBlank(effect["値"])) {
        const unit = String(effect["単位"] || ""); const key = `${statId}__${unit}`;
        const current = totals.get(key) || { statId, unit, value: 0 }; current.value += numeric; totals.set(key, current);
      } else if (effect["表示文"]) textOnly.push(String(effect["表示文"]));
    }));
    const rows = [...totals.values()].sort((a,b) => (context.statMap.get(a.statId)?.["表示順"] || 9999) - (context.statMap.get(b.statId)?.["表示順"] || 9999));
    if (!rows.length && !textOnly.length) { totalEffects.innerHTML = `<div class="empty-total">装備を選ぶと、ここに能力の合計が表示されます。</div>`; return; }
    totalEffects.innerHTML = rows.map(row => { const name = context.statMap.get(row.statId)?.["表示名"] || row.statId; return `<div class="total-row"><span>${escapeHtml(name)}</span><strong>${row.value > 0 ? "+" : ""}${escapeHtml(row.value)}${escapeHtml(row.unit)}</strong></div>`; }).join("") + textOnly.map(text => `<div class="total-row passive-row"><span>${escapeHtml(text)}</span><strong>適用</strong></div>`).join("");
  }

  function openPicker(slotKey) {
    state.pickerSlot = slotKey; state.pickerQuery = ""; pickerSearchInput.value = "";
    const slot = SLOT_DEFS.find(def => def.key === slotKey); pickerTitle.textContent = slot.label; renderPicker();
    pickerModal.classList.add("is-open"); pickerModal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; setTimeout(() => pickerSearchInput.focus(), 50);
  }
  function closePicker() { pickerModal.classList.remove("is-open"); pickerModal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
  function renderPicker() {
    const slot = SLOT_DEFS.find(def => def.key === state.pickerSlot); if (!slot) return;
    const query = normalizeSearchText(state.pickerQuery);
    const items = state.items.filter(item => itemMatchesSlot(item, slot) && (!query || normalizeSearchText(item["名前"]).includes(query)));
    pickerList.innerHTML = `<button class="picker-item is-none" type="button" data-picker-id=""><span><strong>未選択にする</strong><small>このスロットの装備を解除</small></span><b>×</b></button>` + items.map(item => `<button class="picker-item ${String(state.build[slot.key]) === String(item["アイテムID"]) ? "is-current" : ""}" type="button" data-picker-id="${escapeHtml(item["アイテムID"])}"><span><strong>${escapeHtml(item["名前"] || "名称未設定")}</strong><small>${escapeHtml([item["武器種"], item["サブ分類"], !isBlank(item["基礎ATK"]) ? `ATK ${item["基礎ATK"]}` : "", !isBlank(item["基礎DEF"]) ? `DEF ${item["基礎DEF"]}` : ""].filter(Boolean).join(" / ") || "詳細情報なし")}</small></span><b>›</b></button>`).join("");
    pickerList.querySelectorAll("[data-picker-id]").forEach(button => button.addEventListener("click", () => { state.build[slot.key] = button.dataset.pickerId || null; closePicker(); syncUrl(false); renderBuild(); }));
  }

  function compactBuild() { const payload = {}; SLOT_DEFS.forEach(slot => { if (state.build[slot.key]) payload[slot.key] = String(state.build[slot.key]); }); return payload; }
  function syncUrl(push) {
    const url = new URL(location.href); const build = compactBuild();
    if (Object.keys(build).length) url.searchParams.set("build", encodeBuild(build)); else url.searchParams.delete("build");
    history[push ? "pushState" : "replaceState"]({}, "", url);
  }
  function restoreBuildFromUrl() {
    const encoded = new URL(location.href).searchParams.get("build"); if (!encoded) return;
    try { const decoded = decodeBuild(encoded); SLOT_DEFS.forEach(slot => { const id = decoded?.[slot.key]; state.build[slot.key] = id && context.itemsById.has(String(id)) ? String(id) : null; }); document.getElementById("shareMessage").textContent = "共有URLの装備構成を読み込みました。"; }
    catch (error) { console.warn("共有URLの復元に失敗", error); document.getElementById("shareMessage").textContent = "共有URLの形式を読み込めませんでした。"; }
  }

  function renderDatabase() {
    ui.renderTabs(state.activeCategory, category => { state.activeCategory = category; renderDatabase(); });
    const filtered = ui.filterItems(state.items, state.activeCategory, state.searchQuery, context.searchIndex);
    ui.renderItems(filtered, context, item => modal.open(item, context));
  }

  async function loadData() {
    ui.renderLoading(); ui.setConnectionStatus("loading", "接続中");
    try {
      const data = await api.getInitialData();
      for (const [key, value] of Object.entries(data)) if (!Array.isArray(value)) throw new Error(`${key}のデータ形式が正しくありません`);
      Object.assign(state, data); buildIndexes(); restoreBuildFromUrl(); ui.setConnectionStatus("online", "接続済み"); renderDatabase(); renderBuild();
    } catch (error) { console.error(error); ui.setConnectionStatus("error", "接続エラー"); ui.renderError(`${error.message}。GASのデプロイ最新版と公開設定を確認してください。`); equipmentSlots.innerHTML = `<div class="state-card is-error">装備データを取得できませんでした。</div>`; }
  }

  document.querySelectorAll(".main-tab").forEach(tab => tab.addEventListener("click", () => setView(tab.dataset.view)));
  ui.elements.searchInput.addEventListener("input", event => { state.searchQuery = event.target.value; renderDatabase(); });
  document.getElementById("clearButton").addEventListener("click", () => { state.searchQuery = ""; ui.elements.searchInput.value = ""; renderDatabase(); ui.elements.searchInput.focus(); });
  document.getElementById("reloadButton").addEventListener("click", loadData);
  document.getElementById("resetBuildButton").addEventListener("click", () => { SLOT_DEFS.forEach(slot => state.build[slot.key] = null); syncUrl(false); renderBuild(); });
  document.getElementById("copyUrlButton").addEventListener("click", async () => { syncUrl(false); const message = document.getElementById("shareMessage"); try { await navigator.clipboard.writeText(location.href); message.textContent = "共有URLをコピーしました。"; } catch { window.prompt("このURLをコピーしてください", location.href); message.textContent = "共有URLを表示しました。"; } });
  document.getElementById("clearUrlButton").addEventListener("click", () => { const url = new URL(location.href); url.searchParams.delete("build"); history.replaceState({}, "", url); document.getElementById("shareMessage").textContent = "URLからビルド情報を削除しました。装備はそのままです。"; });
  pickerSearchInput.addEventListener("input", event => { state.pickerQuery = event.target.value; renderPicker(); });
  document.getElementById("pickerClearButton").addEventListener("click", () => { state.pickerQuery = ""; pickerSearchInput.value = ""; renderPicker(); pickerSearchInput.focus(); });
  document.getElementById("pickerCloseButton").addEventListener("click", closePicker);
  pickerModal.querySelectorAll("[data-close-picker]").forEach(element => element.addEventListener("click", closePicker));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && pickerModal.classList.contains("is-open")) closePicker(); });
  window.addEventListener("popstate", () => { SLOT_DEFS.forEach(slot => state.build[slot.key] = null); restoreBuildFromUrl(); renderBuild(); });
  loadData();
})();
