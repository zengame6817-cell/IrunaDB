"use strict";
(() => {
  const SLOT_DEFS = [
    { key: "weapon", label: "武器", category: "武器", icon: "⚔" },
    { key: "body", label: "体", category: "体", icon: "🛡" },
    { key: "additional", label: "追加", category: "追加", icon: "✦" },
    { key: "special", label: "特殊", category: "特殊", icon: "◆" },
    { key: "decoration", label: "装飾", category: "装飾", aliases: ["装飾", "装飾品"], icon: "◇" }
  ];
  const EQUIPMENT_KEYS = SLOT_DEFS.map(slot => slot.key);
  const createEmptyBuild = () => ({
    weapon: null,
    body: null,
    additional: null,
    special: null,
    decoration: null,
    crystals: Object.fromEntries(EQUIPMENT_KEYS.map(key => [key, [null, null]])),
    stars: Object.fromEntries(EQUIPMENT_KEYS.map(key => [key, null])),
    equipmentSettings: Object.fromEntries(EQUIPMENT_KEYS.map(key => [
      key, { refinement: 9, slots: 0 }
    ])),
    alCrystas: Array(5).fill(null),
    relicPlacements: []
  });
  const state = {
    items: [], effects: [], conditions: [], stats: [], attributes: [], jobs: [], relicPatterns: [],
    activeCategory: "すべて", searchQuery: "", activeView: "build",
    build: createEmptyBuild(),
    pickerSlot: null, pickerQuery: "", selectedRelicUid: null,
    status: { jobId: "", lv: 1, str: 0, int: 0, vit: 0, agi: 0, dex: 0, crt: 0 }
  };
  const context = {
    itemsById: new Map(), effectsByItem: new Map(), conditionMap: new Map(),
    statMap: new Map(), attributeMap: new Map(), jobMap: new Map(), searchIndex: new Map(),
    relicPatternByItemId: new Map(), relicPatternByName: new Map()
  };
  const ui = window.IrunaUi, api = window.IrunaApi, modal = window.IrunaModal;
  const { normalizeSearchText, escapeHtml, encodeBuild, decodeBuild, isBlank } = window.IrunaUtils;

  const equipmentSlots = document.getElementById("equipmentSlots");
  const equipmentOptions = document.getElementById("equipmentOptions");
  const alSlots = document.getElementById("alSlots");
  const relicPlacementList = document.getElementById("relicPlacementList");
  const relicMessage = document.getElementById("relicMessage");
  const addRelicButton = document.getElementById("addRelicButton");
  const rotateRelicButton = document.getElementById("rotateRelicButton");
  const removeRelicButton = document.getElementById("removeRelicButton");
  const alCount = document.getElementById("alCount");
  const relicCount = document.getElementById("relicCount");
  const totalEffects = document.getElementById("totalEffects");
  const selectedCount = document.getElementById("selectedCount");
  const pickerModal = document.getElementById("pickerModal"), pickerTitle = document.getElementById("pickerTitle"), pickerList = document.getElementById("pickerList"), pickerSearchInput = document.getElementById("pickerSearchInput");

  function buildIndexes() {
    Object.values(context).forEach(value => value instanceof Map && value.clear());
    state.items.forEach(item => context.itemsById.set(String(item["アイテムID"]), item));
    state.effects.forEach(effect => { const id = String(effect["アイテムID"]); if (!context.effectsByItem.has(id)) context.effectsByItem.set(id, []); context.effectsByItem.get(id).push(effect); });
    state.conditions.forEach(condition => { const id = String(condition["条件グループID"]); if (!context.conditionMap.has(id)) context.conditionMap.set(id, []); context.conditionMap.get(id).push(condition); });
    state.stats.forEach(stat => context.statMap.set(String(stat["能力ID"]), stat));
    state.attributes.forEach(attribute => context.attributeMap.set(String(attribute["属性ID"]), attribute));
    state.jobs.forEach(job => context.jobMap.set(String(job["職業ID"]), job));
    state.relicPatterns.forEach(row => {
      const itemId = String(row["アイテムID"] ?? row["レリックID"] ?? row["ID"] ?? "").trim();
      const name = String(row["名前"] ?? row["レリック名"] ?? "").trim();
      const pattern = parseRelicPattern(row);
      if (!pattern.length) return;
      if (itemId) context.relicPatternByItemId.set(itemId, pattern);
      if (name) context.relicPatternByName.set(normalizeSearchText(name), pattern);
    });
    state.items.forEach(item => {
      const effectTexts = (context.effectsByItem.get(String(item["アイテムID"])) || []).map(effect => [context.statMap.get(String(effect["能力ID"]))?.["表示名"], effect["表示文"]].join(" ")).join(" ");
      const attributeName = context.attributeMap.get(String(item["属性ID"]))?.["属性名"] || "";
      context.searchIndex.set(item["アイテムID"], [item["名前"], item["分類"], item["表示分類"], item["サブ分類"], item["武器種"], attributeName, item["タグ概要"], item["説明文"], item["特殊性能"], effectTexts].map(normalizeSearchText).join(" "));
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


  function getSlotDescriptor(token) {
    const equipment = SLOT_DEFS.find(slot => slot.key === token);
    if (equipment) {
      return {
        token,
        label: equipment.label,
        category: equipment.category,
        aliases: equipment.aliases,
        icon: equipment.icon,
        get: () => state.build[equipment.key],
        set: value => { state.build[equipment.key] = value; }
      };
    }

    let match = /^crystal_(.+)_(0|1)$/.exec(token);
    if (match) {
      const [, equipmentKey, indexText] = match;
      const equipmentDef = SLOT_DEFS.find(slot => slot.key === equipmentKey);
      const index = Number(indexText);
      return {
        token,
        label: `${equipmentDef?.label || equipmentKey}・クリスタ${index + 1}`,
        category: "クリスタ",
        icon: "◇",
        get: () => state.build.crystals[equipmentKey][index],
        set: value => { state.build.crystals[equipmentKey][index] = value; }
      };
    }

    match = /^star_(.+)$/.exec(token);
    if (match) {
      const equipmentKey = match[1];
      const equipmentDef = SLOT_DEFS.find(slot => slot.key === equipmentKey);
      return {
        token,
        label: `${equipmentDef?.label || equipmentKey}・☆能力`,
        category: "☆能力",
        icon: "☆",
        get: () => state.build.stars[equipmentKey],
        set: value => { state.build.stars[equipmentKey] = value; }
      };
    }

    match = /^al_(\d+)$/.exec(token);
    if (match) {
      const index = Number(match[1]);
      return {
        token,
        label: `アルクリスタ ${index + 1}`,
        category: "アルクリスタ",
        icon: "A",
        get: () => state.build.alCrystas[index],
        set: value => { state.build.alCrystas[index] = value; }
      };
    }

    if (token === "relic_new") {
      return {
        token,
        label: "レリックを追加",
        category: "レリック",
        icon: "R",
        get: () => null,
        set: value => { if (value) addRelicByItemId(value); }
      };
    }
    return null;
  }

  function allSelectedIds() {
    const ids = EQUIPMENT_KEYS.map(key => state.build[key]);
    EQUIPMENT_KEYS.forEach(key => {
      const slotCount = Number(state.build.equipmentSettings[key]?.slots || 0);
      ids.push(...state.build.crystals[key].slice(0, slotCount), state.build.stars[key]);
    });
    ids.push(...state.build.alCrystas, ...state.build.relicPlacements.map(entry => entry.itemId));
    return ids.filter(Boolean).map(String);
  }

  function renderMiniSlot(token, label, disabled = false) {
    const descriptor = getSlotDescriptor(token);
    const id = descriptor?.get();
    const item = id ? context.itemsById.get(String(id)) : null;
    return `<button class="mini-slot ${item ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}"
      type="button" data-slot-pick="${token}" ${disabled ? "disabled" : ""}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(disabled ? "スロットなし" : (item?.["名前"] || "未選択"))}</strong>
    </button>`;
  }

  function renderEquipmentOptions() {
    equipmentOptions.innerHTML = SLOT_DEFS.map(slot => {
      const setting = state.build.equipmentSettings[slot.key];
      const slotCount = Number(setting?.slots || 0);
      return `
        <section class="equipment-option-group">
          <h3>${escapeHtml(slot.label)}</h3>
          <div class="equipment-option-content">
            <div class="equipment-tuning-row equipment-tuning-row-slots-only">
              <label>
                <span>スロット</span>
                <select data-slot-count-key="${slot.key}">
                  ${[0, 1, 2].map(value =>
                    `<option value="${value}" ${slotCount === value ? "selected" : ""}>${value}</option>`
                  ).join("")}
                </select>
              </label>
              <span class="fixed-refinement-note">精錬 +9 固定</span>
            </div>
            <div class="equipment-option-slots">
              ${renderMiniSlot(`crystal_${slot.key}_0`, "クリスタ1", slotCount < 1)}
              ${renderMiniSlot(`crystal_${slot.key}_1`, "クリスタ2", slotCount < 2)}
              ${renderMiniSlot(`star_${slot.key}`, "☆能力")}
            </div>
          </div>
        </section>
      `;
    }).join("");

    alSlots.innerHTML = state.build.alCrystas
      .map((_, index) => renderMiniSlot(`al_${index}`, `${index + 1}`))
      .join("");

    alCount.textContent = `${state.build.alCrystas.filter(Boolean).length} / 5`;

    document.querySelectorAll("#equipmentOptions [data-slot-pick]:not(:disabled), #alSlots [data-slot-pick]")
      .forEach(button => button.addEventListener("click", () => openPicker(button.dataset.slotPick)));

    equipmentOptions.querySelectorAll("[data-slot-count-key]").forEach(select => {
      select.addEventListener("change", event => {
        const key = event.target.dataset.slotCountKey;
        const count = Number(event.target.value);
        state.build.equipmentSettings[key].slots = count;
        state.build.equipmentSettings[key].refinement = 9;
        for (let index = count; index < 2; index += 1) {
          state.build.crystals[key][index] = null;
        }
        syncUrl(false);
        renderBuild();
      });
    });

    renderRelicBoard();
  }



  function effectDisplayText(effect) {
    const stat = context.statMap.get(String(effect["能力ID"]));
    const statName = stat?.["表示名"] || effect["能力ID"] || "効果";
    const value = effect["値"];
    const unit = effect["単位"] || "";
    const display = String(effect["表示文"] || "").trim();
    const hasNumericDisplay = /[-+]?\d/.test(display);
    if (display && (hasNumericDisplay || isBlank(value))) return display;
    if (!isBlank(value)) {
      const number = Number(value);
      const prefix = Number.isFinite(number) && number > 0 ? "+" : "";
      return `${statName}${prefix}${value}${unit}`;
    }
    if (effect["数式"]) return `${display || statName}（${effect["数式"]}）`;
    return display || statName;
  }

  function conditionDisplayText(groupId) {
    if (isBlank(groupId)) return "";
    return (context.conditionMap.get(String(groupId)) || [])
      .map(condition => condition["表示文"] || `${condition["条件項目"]}${condition["演算子"]}${condition["比較値"]}`)
      .filter(Boolean).join(" ＆ ");
  }

  function fullEffectSummary(item, options = {}) {
    if (!item) return "";
    const { includeConditions = true, separator = " / " } = options;
    return (context.effectsByItem.get(String(item["アイテムID"])) || [])
      .map(effect => {
        const text = effectDisplayText(effect);
        const condition = includeConditions ? conditionDisplayText(effect["条件グループID"]) : "";
        return condition ? `${condition}：${text}` : text;
      })
      .filter(Boolean).join(separator);
  }

  const RELIC_BOARD_WIDTH = 5;
  const RELIC_BOARD_HEIGHT = 3;

  function parseRelicPattern(row) {
    const raw = row["配置"] ?? row["形状"] ?? row["座標"] ?? row["パターン"] ??
      row["cells"] ?? row["pattern"] ?? row["座標データ"] ?? "";
    if (Array.isArray(raw)) return normalizeRelicCells(raw);
    if (!String(raw).trim()) return [];
    try {
      return normalizeRelicCells(JSON.parse(String(raw)));
    } catch (_) {
      const matches = [...String(raw).matchAll(/(-?\d+)\s*,\s*(-?\d+)/g)];
      return normalizeRelicCells(matches.map(match => [Number(match[1]), Number(match[2])]));
    }
  }

  function normalizeRelicCells(cells) {
    const valid = (cells || [])
      .map(cell => Array.isArray(cell) ? [Number(cell[0]), Number(cell[1])] : [Number(cell.x), Number(cell.y)])
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (!valid.length) return [];
    const minX = Math.min(...valid.map(([x]) => x));
    const minY = Math.min(...valid.map(([, y]) => y));
    return valid.map(([x, y]) => [x - minX, y - minY]);
  }

  function relicPatternForItem(itemId) {
    const direct = context.relicPatternByItemId.get(String(itemId));
    if (direct) return direct;
    const item = context.itemsById.get(String(itemId));
    return context.relicPatternByName.get(normalizeSearchText(item?.["名前"] || "")) || [];
  }

  function rotateCells(cells, rotation) {
    let result = normalizeRelicCells(cells);
    const turns = ((Number(rotation) || 0) % 4 + 4) % 4;
    for (let i = 0; i < turns; i += 1) {
      result = normalizeRelicCells(result.map(([x, y]) => [-y, x]));
    }
    return result;
  }

  function absoluteRelicCells(placement, overrideRotation = placement.rotation) {
    return rotateCells(relicPatternForItem(placement.itemId), overrideRotation)
      .map(([x, y]) => [x + placement.x, y + placement.y]);
  }

  function canPlaceRelic(candidate, ignoreUid = null) {
    const cells = absoluteRelicCells(candidate);
    if (!cells.length) return false;
    if (cells.some(([x, y]) => x < 0 || x >= RELIC_BOARD_WIDTH || y < 0 || y >= RELIC_BOARD_HEIGHT)) {
      return false;
    }
    const occupied = new Set();
    state.build.relicPlacements.forEach(entry => {
      if (entry.uid === ignoreUid) return;
      absoluteRelicCells(entry).forEach(([x, y]) => occupied.add(`${x},${y}`));
    });
    return cells.every(([x, y]) => !occupied.has(`${x},${y}`));
  }

  function findRelicPosition(itemId) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      for (let y = 0; y < RELIC_BOARD_HEIGHT; y += 1) {
        for (let x = 0; x < RELIC_BOARD_WIDTH; x += 1) {
          const candidate = { itemId: String(itemId), x, y, rotation };
          if (canPlaceRelic(candidate)) return candidate;
        }
      }
    }
    return null;
  }

  function addRelicByItemId(itemId) {
    const pattern = relicPatternForItem(itemId);
    const item = context.itemsById.get(String(itemId));
    if (!pattern.length) {
      relicMessage.textContent = `${item?.["名前"] || "選択したレリック"}の形状データが見つかりません。`;
      return;
    }
    const position = findRelicPosition(itemId);
    if (!position) {
      relicMessage.textContent = "空いている場所へ配置できません。既存レリックを削除または回転してください。";
      return;
    }
    const placement = {
      uid: `r${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      ...position
    };
    state.build.relicPlacements.push(placement);
    state.selectedRelicUid = placement.uid;
    relicMessage.textContent = `${item?.["名前"] || "レリック"}を配置しました。`;
    syncUrl(false);
    renderBuild();
  }

  function rotateSelectedRelic() {
    const placement = state.build.relicPlacements.find(entry => entry.uid === state.selectedRelicUid);
    if (!placement) return;
    const nextRotation = (placement.rotation + 1) % 4;
    const candidate = { ...placement, rotation: nextRotation };
    if (!canPlaceRelic(candidate, placement.uid)) {
      relicMessage.textContent = "その位置では回転できません。盤面外または別のレリックと重なります。";
      return;
    }
    placement.rotation = nextRotation;
    relicMessage.textContent = "90°回転しました。反転は行いません。";
    syncUrl(false);
    renderBuild();
  }

  function removeSelectedRelic() {
    const index = state.build.relicPlacements.findIndex(entry => entry.uid === state.selectedRelicUid);
    if (index < 0) return;
    const [removed] = state.build.relicPlacements.splice(index, 1);
    const item = context.itemsById.get(String(removed.itemId));
    state.selectedRelicUid = null;
    relicMessage.textContent = `${item?.["名前"] || "レリック"}を削除しました。`;
    syncUrl(false);
    renderBuild();
  }

  function renderRelicBoard() {
    relicPlacementList.innerHTML = state.build.relicPlacements.length
      ? state.build.relicPlacements.map((placement, index) => {
          const item = context.itemsById.get(String(placement.itemId));
          const selected = placement.uid === state.selectedRelicUid;
          const effectSummary = fullEffectSummary(item, { includeConditions: true, separator: " / " });
          return `<article class="relic-row ${selected ? "is-selected" : ""}" data-placement-uid="${placement.uid}">
            <button class="relic-row-main" type="button" data-relic-select="${placement.uid}">
              <span class="relic-row-number">${index + 1}</span>
              <span class="relic-row-content">
                <strong>${escapeHtml(item?.["名前"] || "不明なレリック")}</strong>
                <small>${escapeHtml(effectSummary || item?.["説明文"] || "能力情報なし")}</small>
              </span>
              <span class="relic-row-rotation">${placement.rotation * 90}°</span>
            </button>
            <button class="relic-row-detail" type="button" data-relic-detail="${placement.uid}">詳細</button>
          </article>`;
        }).join("")
      : '<p class="empty-relic-list">まだレリックは追加されていません。</p>';

    relicPlacementList.querySelectorAll("[data-relic-select]").forEach(button => {
      button.addEventListener("click", () => {
        state.selectedRelicUid = button.dataset.relicSelect;
        renderRelicBoard();
      });
    });
    relicPlacementList.querySelectorAll("[data-relic-detail]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const placement = state.build.relicPlacements.find(entry => entry.uid === button.dataset.relicDetail);
        const item = placement ? context.itemsById.get(String(placement.itemId)) : null;
        if (item) modal.open(item, context);
      });
    });

    const occupied = state.build.relicPlacements.reduce((sum, placement) => sum + absoluteRelicCells(placement).length, 0);
    relicCount.textContent = `${state.build.relicPlacements.length}件 / ${occupied}マス`;
    const selectedExists = state.build.relicPlacements.some(entry => entry.uid === state.selectedRelicUid);
    rotateRelicButton.disabled = !selectedExists;
    removeRelicButton.disabled = !selectedExists;
  }

  function renderBuild() {
    equipmentSlots.innerHTML = SLOT_DEFS.map(slot => {
      const item = state.build[slot.key] ? context.itemsById.get(String(state.build[slot.key])) : null;
      const slotCount = Number(state.build.equipmentSettings[slot.key]?.slots || 0);
      return `<article class="equipment-slot ${item ? "is-selected" : ""}">
        <div class="slot-main">
          <span class="slot-content">
            <span class="slot-label">${slot.label}</span>
            ${item ? `<button class="slot-item-info slot-detail-button" type="button" data-slot-detail="${slot.key}">
              <strong>${escapeHtml(item["名前"] || "名称未設定")}</strong>
              <small>精錬+9・${slotCount}スロット　タップで詳細</small>
            </button>` : `<button class="slot-item-info slot-detail-button is-empty" type="button" data-slot-pick="${slot.key}">
              <strong>未選択</strong><small>タップして選択</small>
            </button>`}
          </span>
          <button class="slot-change" type="button" data-slot-pick="${slot.key}">${item ? "変更" : "選択"}</button>
        </div>
        ${item ? `<button class="slot-remove" type="button" data-slot-remove="${slot.key}" aria-label="${slot.label}を解除">×</button>` : ""}
      </article>`;
    }).join("");

    equipmentSlots.querySelectorAll("[data-slot-pick]").forEach(button =>
      button.addEventListener("click", () => openPicker(button.dataset.slotPick))
    );
    equipmentSlots.querySelectorAll("[data-slot-detail]").forEach(button => {
      button.addEventListener("click", () => {
        const itemId = state.build[button.dataset.slotDetail];
        const item = itemId ? context.itemsById.get(String(itemId)) : null;
        if (item) modal.open(item, context);
      });
    });
    equipmentSlots.querySelectorAll("[data-slot-remove]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      const descriptor = getSlotDescriptor(button.dataset.slotRemove);
      descriptor?.set(null);
      syncUrl(false);
      renderBuild();
    }));
    renderEquipmentOptions();
    renderTotals();
  }

  function normalizeOperator(value) {
    const op = String(value || "=").trim().toUpperCase();
    if (op === "＝" || op === "==") return "=";
    if (op === "≧") return ">=";
    if (op === "≦") return "<=";
    if (op === "≠" || op === "<>") return "!=";
    return op;
  }

  function selectedItems() {
    return allSelectedIds()
      .map(id => context.itemsById.get(String(id)))
      .filter(Boolean);
  }

  function conditionActualValue(condition) {
    const itemName = String(condition["条件項目"] || "").trim();
    const weapon = state.build.weapon
      ? context.itemsById.get(String(state.build.weapon))
      : null;
    const equipped = selectedItems();

    const key = itemName.toUpperCase();
    if (["LV", "LEVEL", "レベル"].includes(key)) return state.status.lv;
    if (["STR", "INT", "VIT", "AGI", "DEX", "CRT"].includes(key)) {
      return state.status[key.toLowerCase()];
    }

    if (["職業", "JOB"].includes(key)) {
      const job = context.jobMap.get(String(state.status.jobId));
      return {
        id: state.status.jobId,
        name: job?.["職業名"] || ""
      };
    }

    if (["武器種", "WEAPON_TYPE"].includes(key)) {
      return weapon?.["武器種"] || weapon?.["サブ分類"] || "";
    }

    if (["武器属性", "属性", "WEAPON_ATTRIBUTE"].includes(key)) {
      const attributeId = weapon?.["属性ID"] || "";
      return {
        id: attributeId,
        name: context.attributeMap.get(String(attributeId))?.["属性名"] || ""
      };
    }

    if (["装備部位", "分類", "EQUIP_SLOT"].includes(key)) {
      return equipped.map(item => item["分類"]).filter(Boolean);
    }

    if (["サブ分類", "装備種別"].includes(key)) {
      return equipped.map(item => item["サブ分類"]).filter(Boolean);
    }

    if (["表示分類"].includes(key)) {
      return equipped.map(item => item["表示分類"] || item["サブ分類"] || item["分類"]).filter(Boolean);
    }

    if (["装備アイテム", "アイテム", "ITEM"].includes(key)) {
      return equipped.map(item => ({
        id: String(item["アイテムID"] || ""),
        name: String(item["名前"] || "")
      }));
    }

    if (["精錬値", "REFINEMENT", "REFINE"].includes(key)) {
      return EQUIPMENT_KEYS.map(equipmentKey =>
        Number(state.build.equipmentSettings[equipmentKey]?.refinement || 0)
      );
    }

    const refinementMatch = /^(武器|体|追加|特殊|装飾)(精錬|精錬値)$/.exec(itemName);
    if (refinementMatch) {
      const slot = SLOT_DEFS.find(entry => entry.label === refinementMatch[1]);
      return Number(state.build.equipmentSettings[slot?.key]?.refinement || 0);
    }

    if (["スロット数", "SLOT_COUNT"].includes(key)) {
      return EQUIPMENT_KEYS.map(equipmentKey =>
        Number(state.build.equipmentSettings[equipmentKey]?.slots || 0)
      );
    }

    if (["ダブルスロット", "DOUBLE_SLOT"].includes(key)) {
      return EQUIPMENT_KEYS.some(equipmentKey =>
        Number(state.build.equipmentSettings[equipmentKey]?.slots || 0) >= 2
      ) ? 1 : 0;
    }

    const slotMatch = /^(武器|体|追加|特殊|装飾)(スロット|スロット数)$/.exec(itemName);
    if (slotMatch) {
      const slot = SLOT_DEFS.find(entry => entry.label === slotMatch[1]);
      return Number(state.build.equipmentSettings[slot?.key]?.slots || 0);
    }

    if (["アルクリスタ数"].includes(key)) return state.build.alCrystas.filter(Boolean).length;
    if (["レリック数"].includes(key)) return state.build.relicPlacements.length;

    return undefined;
  }

  function comparableValues(actual) {
    if (Array.isArray(actual)) return actual.flatMap(comparableValues);
    if (actual && typeof actual === "object") {
      return [actual.id, actual.name].filter(value => value !== undefined && value !== null && value !== "");
    }
    return [actual];
  }

  function compareSingle(actual, expected, operator) {
    const op = normalizeOperator(operator);
    const actualNumber = Number(actual);
    const expectedNumber = Number(expected);
    const numeric = actual !== "" && expected !== "" &&
      Number.isFinite(actualNumber) && Number.isFinite(expectedNumber);

    if (op === ">") return numeric && actualNumber > expectedNumber;
    if (op === ">=") return numeric && actualNumber >= expectedNumber;
    if (op === "<") return numeric && actualNumber < expectedNumber;
    if (op === "<=") return numeric && actualNumber <= expectedNumber;

    const left = String(actual ?? "").trim().toLowerCase();
    const right = String(expected ?? "").trim().toLowerCase();

    if (op === "!=") return left !== right;
    if (op === "CONTAINS" || op === "含む") return left.includes(right);
    return left === right;
  }

  function evaluateCondition(condition) {
    const actual = conditionActualValue(condition);
    if (actual === undefined) return false;

    const expectedCandidates = [
      condition["比較値ID"],
      condition["比較値"]
    ].filter(value => value !== undefined && value !== null && String(value).trim() !== "");

    const op = normalizeOperator(condition["演算子"]);
    const actualValues = comparableValues(actual);

    if (op === "IN") {
      const allowed = expectedCandidates
        .flatMap(value => String(value).split(","))
        .map(value => value.trim())
        .filter(Boolean);
      return actualValues.some(value => allowed.some(expected => compareSingle(value, expected, "=")));
    }

    if (op === "NOT IN") {
      const allowed = expectedCandidates
        .flatMap(value => String(value).split(","))
        .map(value => value.trim())
        .filter(Boolean);
      return actualValues.every(value => allowed.every(expected => !compareSingle(value, expected, "=")));
    }

    return actualValues.some(value =>
      expectedCandidates.some(expected => compareSingle(value, expected, op))
    );
  }

  function evaluateConditionGroup(groupId) {
    if (isBlank(groupId)) return true;
    const conditions = (context.conditionMap.get(String(groupId)) || [])
      .filter(condition => String(condition["有効"] ?? "TRUE").toUpperCase() !== "FALSE")
      .sort((a, b) => Number(a["条件順"] || 0) - Number(b["条件順"] || 0));

    if (!conditions.length) return false;

    let result = evaluateCondition(conditions[0]);
    for (let i = 1; i < conditions.length; i += 1) {
      const join = String(conditions[i - 1]["論理結合"] || "AND").trim().toUpperCase();
      const next = evaluateCondition(conditions[i]);
      result = join === "OR" ? result || next : result && next;
    }
    return result;
  }

  function renderStatus() {
    const jobSelect = document.getElementById("jobSelect");
    const sortedJobs = [...state.jobs].sort(
      (a, b) => Number(a["表示順"] || 9999) - Number(b["表示順"] || 9999)
    );

    jobSelect.innerHTML = `<option value="">未選択</option>` +
      sortedJobs.map(job => `<option value="${escapeHtml(job["職業ID"])}">${escapeHtml(job["職業名"])}</option>`).join("");
    jobSelect.value = state.status.jobId;

    document.querySelectorAll("[data-status-key]").forEach(input => {
      input.value = state.status[input.dataset.statusKey];
    });
  }

  function renderTotals() {
    const selectedIds = allSelectedIds();
    selectedCount.textContent = `${selectedIds.length}件`;
    const totals = new Map(), textOnly = [];
    const activeConditional = [];
    const inactiveConditional = [];
    selectedIds.forEach(id => (context.effectsByItem.get(id) || []).filter(effect => {
      const groupId = effect["条件グループID"];
      if (isBlank(groupId)) return true;
      const active = evaluateConditionGroup(groupId);
      (active ? activeConditional : inactiveConditional).push(effect);
      return active;
    }).forEach(effect => {
      const statId = String(effect["能力ID"] || "");
      const numeric = Number(effect["値"]);
      if (statId && Number.isFinite(numeric) && !isBlank(effect["値"])) {
        const unit = String(effect["単位"] || ""); const key = `${statId}__${unit}`;
        const current = totals.get(key) || { statId, unit, value: 0 }; current.value += numeric; totals.set(key, current);
      } else if (effect["表示文"]) textOnly.push(String(effect["表示文"]));
    }));
    const rows = [...totals.values()].sort((a,b) =>
      (context.statMap.get(a.statId)?.["表示順"] || 9999) -
      (context.statMap.get(b.statId)?.["表示順"] || 9999)
    );

    const totalsHtml =
      rows.map(row => {
        const name = context.statMap.get(row.statId)?.["表示名"] || row.statId;
        return `<div class="total-row">
          <span>${escapeHtml(name)}</span>
          <strong>${row.value > 0 ? "+" : ""}${escapeHtml(row.value)}${escapeHtml(row.unit)}</strong>
        </div>`;
      }).join("")
      +
      textOnly.map(text =>
        `<div class="total-row passive-row">
          <span>${escapeHtml(text)}</span>
          <strong>適用</strong>
        </div>`
      ).join("");

    const conditionLabel = effect => {
      const group = context.conditionMap.get(String(effect["条件グループID"])) || [];
      return group
        .map(condition => condition["表示文"])
        .filter(Boolean)
        .join(" ＆ ") || effect["条件グループID"];
    };

    const activeHtml = activeConditional.length
      ? `<div class="condition-summary">
          <h3>発動中の条件付き能力</h3>
          ${activeConditional.map(effect => `
            <div class="condition-result is-active">
              <span>${escapeHtml(conditionLabel(effect))}</span>
              <strong>${escapeHtml(effectDisplayText(effect))}</strong>
            </div>
          `).join("")}
        </div>`
      : "";

    const inactiveHtml = inactiveConditional.length
      ? `<div class="condition-summary">
          <h3>未発動の条件付き能力</h3>
          ${inactiveConditional.map(effect => `
            <div class="condition-result is-inactive">
              <span>${escapeHtml(conditionLabel(effect))}</span>
              <strong>${escapeHtml(effectDisplayText(effect))}</strong>
            </div>
          `).join("")}
        </div>`
      : "";

    if (
      !rows.length &&
      !textOnly.length &&
      !activeConditional.length &&
      !inactiveConditional.length
    ) {
      totalEffects.innerHTML =
        `<div class="empty-total">装備を選ぶと、ここに能力の合計が表示されます。</div>`;
      return;
    }

    totalEffects.innerHTML = totalsHtml + activeHtml + inactiveHtml;
  }
  function openPicker(slotToken) {
    state.pickerSlot = slotToken;
    state.pickerQuery = "";
    pickerSearchInput.value = "";
    const descriptor = getSlotDescriptor(slotToken);
    if (!descriptor) return;
    pickerTitle.textContent = descriptor.label;
    renderPicker();
    pickerModal.classList.add("is-open");
    pickerModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => pickerSearchInput.focus(), 50);
  }
  function closePicker() { pickerModal.classList.remove("is-open"); pickerModal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
  function renderPicker() {
    const descriptor = getSlotDescriptor(state.pickerSlot);
    if (!descriptor) return;
    const query = normalizeSearchText(state.pickerQuery);
    const items = state.items.filter(item => {
      const category = String(item["分類"] || "").trim();
      const categoryMatched = descriptor.aliases
        ? descriptor.aliases.includes(category)
        : category === descriptor.category;
      return categoryMatched &&
        (!query || (context.searchIndex.get(item["アイテムID"]) || "").includes(query));
    });

    const currentId = descriptor.get();
    pickerList.innerHTML =
      `<button class="picker-item is-none" type="button" data-picker-id="">
        <span><strong>未選択にする</strong><small>このスロットを解除</small></span><b>×</b>
      </button>` +
      items.map(item => {
        const itemId = String(item["アイテムID"]);
        const attributeId = String(item["属性ID"] || "");
        const attributeName = context.attributeMap.get(attributeId)?.["属性名"] || attributeId;
        const basic = [
          !isBlank(item["基礎ATK"]) ? `ATK ${item["基礎ATK"]}` : "",
          !isBlank(item["基礎DEF"]) ? `DEF ${item["基礎DEF"]}` : "",
          attributeName ? `${attributeName}属性` : "",
          Number(item["スロット数"]) > 0 ? `Slot ${item["スロット数"]}` : ""
        ].filter(Boolean).join(" / ");
        const effects = fullEffectSummary(item, { includeConditions: true, separator: " / " });
        const description = [item["説明文"], item["特殊性能"]].filter(Boolean).join(" / ");
        return `<article class="picker-card ${String(currentId) === itemId ? "is-current" : ""}">
          <button class="picker-card-select" type="button" data-picker-id="${escapeHtml(itemId)}">
            <span class="picker-card-head"><strong>${escapeHtml(item["名前"] || "名称未設定")}</strong><b>選択</b></span>
            ${basic ? `<span class="picker-card-basic">${escapeHtml(basic)}</span>` : ""}
            ${effects ? `<span class="picker-card-effects">${escapeHtml(effects)}</span>` : ""}
            ${description ? `<span class="picker-card-description">${escapeHtml(description)}</span>` : ""}
          </button>
          <button class="picker-card-detail" type="button" data-picker-detail="${escapeHtml(itemId)}">詳細を見る</button>
        </article>`;
      }).join("");

    pickerList.querySelectorAll("[data-picker-id]").forEach(button =>
      button.addEventListener("click", () => {
        const selectedId = button.dataset.pickerId || null;
        descriptor.set(selectedId);
        closePicker();
        syncUrl(false);
        renderBuild();
      })
    );
    pickerList.querySelectorAll("[data-picker-detail]").forEach(button =>
      button.addEventListener("click", () => {
        const item = context.itemsById.get(String(button.dataset.pickerDetail));
        if (item) modal.open(item, context);
      })
    );
  }

  function compactBuild() {
    const build = {};
    EQUIPMENT_KEYS.forEach(key => {
      if (state.build[key]) build[key] = String(state.build[key]);
    });
    build.crystals = Object.fromEntries(EQUIPMENT_KEYS.map(key => [
      key,
      state.build.crystals[key].map(value => value ? String(value) : null)
    ]));
    build.stars = Object.fromEntries(EQUIPMENT_KEYS.map(key => [
      key,
      state.build.stars[key] ? String(state.build.stars[key]) : null
    ]));
    build.equipmentSettings = Object.fromEntries(EQUIPMENT_KEYS.map(key => [
      key,
      {
        refinement: 9,
        slots: Number(state.build.equipmentSettings[key]?.slots || 0)
      }
    ]));
    build.alCrystas = state.build.alCrystas.map(value => value ? String(value) : null);
    build.relicPlacements = state.build.relicPlacements.map(entry => ({
      itemId: String(entry.itemId),
      x: Number(entry.x),
      y: Number(entry.y),
      rotation: Number(entry.rotation) || 0
    }));
    return { build, status: { ...state.status } };
  }
  function syncUrl(push) {
    const url = new URL(location.href); const payload = compactBuild();
    const hasBuild = allSelectedIds().length > 0 ||
      EQUIPMENT_KEYS.some(key => {
        const setting = state.build.equipmentSettings[key];
        return Number(setting?.slots || 0) !== 0;
      });
    const hasStatus = payload.status.jobId || payload.status.lv !== 1 ||
      ["str","int","vit","agi","dex","crt"].some(key => payload.status[key] !== 0);
    if (hasBuild || hasStatus) url.searchParams.set("build", encodeBuild(payload)); else url.searchParams.delete("build");
    history[push ? "pushState" : "replaceState"]({}, "", url);
  }
  function restoreBuildFromUrl() {
    const encoded = new URL(location.href).searchParams.get("build"); if (!encoded) return;
    try {
      const decoded = decodeBuild(encoded);
      const decodedBuild = decoded?.build || decoded || {};
      const decodedStatus = decoded?.status || {};
      SLOT_DEFS.forEach(slot => {
        const id = decodedBuild?.[slot.key];
        state.build[slot.key] = id && context.itemsById.has(String(id)) ? String(id) : null;
      });
      EQUIPMENT_KEYS.forEach(key => {
        const savedSetting = decodedBuild?.equipmentSettings?.[key] || {};
        state.build.equipmentSettings[key] = {
          refinement: 9,
          slots: Math.min(2, Math.max(0, Number(savedSetting.slots) || 0))
        };
        const values = decodedBuild?.crystals?.[key] || [];
        state.build.crystals[key] = [0, 1].map(index => {
          const id = values[index];
          const enabled = index < state.build.equipmentSettings[key].slots;
          return enabled && id && context.itemsById.has(String(id)) ? String(id) : null;
        });
        const starId = decodedBuild?.stars?.[key];
        state.build.stars[key] = starId && context.itemsById.has(String(starId)) ? String(starId) : null;
      });
      state.build.alCrystas = Array.from({ length: 5 }, (_, index) => {
        const id = decodedBuild?.alCrystas?.[index];
        return id && context.itemsById.has(String(id)) ? String(id) : null;
      });
      state.build.relicPlacements = [];
      const savedPlacements = Array.isArray(decodedBuild?.relicPlacements)
        ? decodedBuild.relicPlacements
        : [];
      savedPlacements.forEach((entry, index) => {
        const itemId = String(entry?.itemId || "");
        const candidate = {
          uid: `saved${index}`,
          itemId,
          x: Number(entry?.x) || 0,
          y: Number(entry?.y) || 0,
          rotation: Number(entry?.rotation) || 0
        };
        if (context.itemsById.has(itemId) && canPlaceRelic(candidate)) {
          state.build.relicPlacements.push(candidate);
        }
      });

      // v0.5.0の旧URL（15個のレリック枠）も可能な範囲で自動配置する
      if (!savedPlacements.length && Array.isArray(decodedBuild?.relics)) {
        decodedBuild.relics.filter(Boolean).forEach((id, index) => {
          const itemId = String(id);
          const position = context.itemsById.has(itemId) ? findRelicPosition(itemId) : null;
          if (position) state.build.relicPlacements.push({ uid: `legacy${index}`, ...position });
        });
      }
      state.status = {
        jobId: String(decodedStatus.jobId || ""),
        lv: Number(decodedStatus.lv ?? 1),
        str: Number(decodedStatus.str ?? 0),
        int: Number(decodedStatus.int ?? 0),
        vit: Number(decodedStatus.vit ?? 0),
        agi: Number(decodedStatus.agi ?? 0),
        dex: Number(decodedStatus.dex ?? 0),
        crt: Number(decodedStatus.crt ?? 0)
      };
      document.getElementById("shareMessage").textContent = "共有URLの装備構成とステータスを読み込みました。";
    }
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
      Object.assign(state, data); buildIndexes(); restoreBuildFromUrl(); ui.setConnectionStatus("online", "接続済み"); renderDatabase(); renderStatus(); renderBuild();
    } catch (error) { console.error(error); ui.setConnectionStatus("error", "接続エラー"); ui.renderError(`${error.message}。GASのデプロイ最新版と公開設定を確認してください。`); equipmentSlots.innerHTML = `<div class="state-card is-error">装備データを取得できませんでした。</div>`; }
  }

  document.querySelectorAll(".main-tab").forEach(tab => tab.addEventListener("click", () => setView(tab.dataset.view)));
  ui.elements.searchInput.addEventListener("input", event => { state.searchQuery = event.target.value; renderDatabase(); });
  document.getElementById("clearButton").addEventListener("click", () => { state.searchQuery = ""; ui.elements.searchInput.value = ""; renderDatabase(); ui.elements.searchInput.focus(); });
  document.getElementById("reloadButton").addEventListener("click", loadData);
  addRelicButton.addEventListener("click", () => openPicker("relic_new"));
  rotateRelicButton.addEventListener("click", rotateSelectedRelic);
  removeRelicButton.addEventListener("click", removeSelectedRelic);

  document.getElementById("resetBuildButton").addEventListener("click", () => {
    state.build = createEmptyBuild();
    state.selectedRelicUid = null;
    syncUrl(false);
    renderBuild();
  });
  document.getElementById("copyUrlButton").addEventListener("click", async () => { syncUrl(false); const message = document.getElementById("shareMessage"); try { await navigator.clipboard.writeText(location.href); message.textContent = "共有URLをコピーしました。"; } catch { window.prompt("このURLをコピーしてください", location.href); message.textContent = "共有URLを表示しました。"; } });
  document.getElementById("clearUrlButton").addEventListener("click", () => { const url = new URL(location.href); url.searchParams.delete("build"); history.replaceState({}, "", url); document.getElementById("shareMessage").textContent = "URLからビルド情報を削除しました。装備はそのままです。"; });
  pickerSearchInput.addEventListener("input", event => { state.pickerQuery = event.target.value; renderPicker(); });
  document.getElementById("pickerClearButton").addEventListener("click", () => { state.pickerQuery = ""; pickerSearchInput.value = ""; renderPicker(); pickerSearchInput.focus(); });
  document.getElementById("pickerCloseButton").addEventListener("click", closePicker);
  pickerModal.querySelectorAll("[data-close-picker]").forEach(element => element.addEventListener("click", closePicker));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && pickerModal.classList.contains("is-open")) closePicker(); });
  window.addEventListener("popstate", () => {
    state.build = createEmptyBuild();
    state.selectedRelicUid = null;
    restoreBuildFromUrl();
    renderStatus();
    renderBuild();
  });

  document.getElementById("jobSelect").addEventListener("change", event => {
    state.status.jobId = event.target.value;
    syncUrl(false);
    renderBuild();
  });

  document.querySelectorAll("[data-status-key]").forEach(input => {
    input.addEventListener("input", event => {
      const key = event.target.dataset.statusKey;
      const minimum = key === "lv" ? 1 : 0;
      state.status[key] = Math.max(minimum, Number(event.target.value || minimum));
      syncUrl(false);
      renderBuild();
    });
  });

  document.getElementById("resetStatusButton").addEventListener("click", () => {
    state.status = { jobId: "", lv: 1, str: 0, int: 0, vit: 0, agi: 0, dex: 0, crt: 0 };
    renderStatus();
    syncUrl(false);
    renderBuild();
  });

  loadData();
})();
