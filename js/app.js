const APP_VERSION = window.IRUNA_CONFIG?.APP_VERSION || "2.9.20";

function formatDisplayNumber(value, maxDecimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  const factor = 10 ** maxDecimals;
  let rounded = Math.round((n + Number.EPSILON * Math.sign(n || 1)) * factor) / factor;
  if (Object.is(rounded, -0) || Math.abs(rounded) < 0.005) rounded = 0;
  return rounded.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

"use strict";
(() => {
  const SLOT_DEFS = [
    { key: "weapon", label: "武器", category: "武器", aliases: ["武器"], icon: "⚔" },
    { key: "body", label: "体", category: "体", aliases: ["体", "体装備"], icon: "🛡" },
    { key: "additional", label: "追加", category: "追加", aliases: ["追加", "追加装備"], icon: "✦" },
    { key: "special", label: "特殊", category: "特殊", aliases: ["特殊", "特殊装備"], icon: "◆" },
    { key: "decoration", label: "装飾", category: "装飾", aliases: ["装飾", "装飾品", "装飾装備"], icon: "◇" }
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
      key, { refinement: key === "special" ? 0 : 9, slots: 0 }
    ])),
    alCrystas: Array(5).fill(null),
    relicPlacements: []
  });
  function loadStoredFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem("irunadb.favorites") || "[]");
      return new Set(Array.isArray(saved) ? saved.map(String) : []);
    } catch (error) {
      console.warn("お気に入り保存データを初期化しました", error);
      localStorage.removeItem("irunadb.favorites");
      return new Set();
    }
  }

  const state = {
    items: [], effects: [], conditions: [], stats: [], attributes: [], jobs: [], relicPatterns: [],
    activeCategory: "すべて", searchQuery: "", activeView: "build",
    databaseFilters: { weaponType: "", attribute: "", sort: "name", favoriteOnly: false },
    favorites: loadStoredFavorites(),
    build: createEmptyBuild(),
    pickerSlot: null, pickerQuery: "", pickerVisibleCount: 80, selectedRelicUid: null,
    pickerFilters: { weaponType: "", attribute: "", quickTag: "", sort: "name" },
    status: { jobId: "", lv: 1, str: 0, int: 0, vit: 0, agi: 0, dex: 0, crt: 0 },
    selectedSkills: new Set()
  };
  const context = {
    itemsById: new Map(), effectsByItem: new Map(), conditionMap: new Map(),
    statMap: new Map(), attributeMap: new Map(), jobMap: new Map(), searchIndex: new Map(),
    relicPatternByItemId: new Map(), relicPatternByName: new Map(),
    skillsByJob: new Map(), skillEffectsBySkill: new Map(), skillConditionMap: new Map()
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
  const screenshotSummaryPanel = document.getElementById("screenshotSummaryPanel");
  const screenshotSummaryBody = document.getElementById("screenshotSummaryBody");
  const toggleScreenshotSummary = document.getElementById("toggleScreenshotSummary");
  const screenshotModeButton = document.getElementById("screenshotModeButton");
  const skillSelections = document.getElementById("skillSelections");
  const pickerModal = document.getElementById("pickerModal"), pickerTitle = document.getElementById("pickerTitle"), pickerList = document.getElementById("pickerList"), pickerSearchInput = document.getElementById("pickerSearchInput");

  // v2.9.19: スマホで入力のたびに全件検索・全再描画しないための軽量デバウンス。
  function debounce(fn, wait = 120) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  const JOB_MASTER_V12 = [
    "冒険者", "グラディエーター", "パラディン", "スナイパー", "アサシン", "サマナー",
    "ハイウィザード", "ビショップ", "エンチャンター", "モンク", "ビーストナイト",
    "サーヴァント", "ミンストレル", "サムライ", "ニンジャ", "ネクロマンサー", "アルケミスト"
  ];

  const V12_QUICK_TAGS = [
    { label: "物理", query: "ATK 物理 クリティカル" },
    { label: "魔法", query: "MATK 魔法 魔法剣" },
    { label: "耐久", query: "MaxHP 耐性 軽減" },
    { label: "貫通", query: "貫通" },
    { label: "クリティカル", query: "クリティカル" },
    { label: "ディレイ", query: "ディレイ" },
    { label: "属性", query: "属性に物理 魔法威力 耐性" }
  ];

  function injectV12Styles() {
    if (document.getElementById("iruna-v12-style")) return;
    const style = document.createElement("style");
    style.id = "iruna-v12-style";
    style.textContent = `
      .v12-picker-filter{display:grid;gap:8px;margin:10px 0;padding:10px;border:1px solid rgba(210,174,91,.38);border-radius:10px;background:rgba(20,16,13,.78)}
      .v12-filter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      .v12-filter-grid label{display:grid;gap:4px;font-size:11px;color:#d8bd7a}
      .v12-filter-grid select{width:100%;min-width:0;height:36px;padding:5px 7px;border-radius:7px}
      .v12-tag-row{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px}
      .v12-tag-button{flex:0 0 auto;padding:6px 10px;border-radius:999px;border:1px solid rgba(210,174,91,.38);font-size:12px}
      .v12-tag-button.is-active{outline:2px solid rgba(72,206,220,.65);color:#8ff3ff}
      .v12-filter-meta{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#aaa}
      .v12-collapse-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;margin:4px 0;border:1px solid rgba(210,174,91,.38);border-radius:9px;background:rgba(33,24,18,.9);color:#f1d684;font-weight:700;text-align:left}
      .v12-collapse-toggle .v12-arrow{transition:transform .18s ease}
      .v12-collapsible.is-collapsed .v12-collapse-content{display:none!important}
      .v12-collapsible.is-collapsed .v12-arrow{transform:rotate(-90deg)}
      .v12-collapse-content{min-width:0}
      @media(max-width:680px){.v12-filter-grid{grid-template-columns:1fr 1fr}.v12-filter-grid label:last-child{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function updateVersionLabel() {
    document.querySelectorAll("body *").forEach(element => {
      if (element.children.length) return;
      const value = String(element.textContent || "");
      if (/v1\.[0-9]+(?:\.\d+)?/i.test(value)) {
        element.textContent = value.replace(/v1\.[0-9]+(?:\.\d+)?/ig, `v${APP_VERSION}`);
      }
    });
  }

  function createPickerFilterUi() {
    if (document.getElementById("v12PickerFilter")) return;
    const panel = document.createElement("div");
    panel.id = "v12PickerFilter";
    panel.className = "v12-picker-filter";
    panel.innerHTML = `
      <div class="v12-filter-grid">
        <label><span id="v12TypeFilterLabel">種類</span><select id="v12WeaponType"><option value="">すべて</option></select></label>
        <label>属性<select id="v12Attribute"><option value="">すべて</option></select></label>
        <label>並び順<select id="v12PickerSort"><option value="name">名前順</option><option value="atkDesc">ATK 高い順</option><option value="atkAsc">ATK 低い順</option></select></label>
      </div>
      <div class="v12-tag-row" id="v12QuickTags">
        ${V12_QUICK_TAGS.map(tag => `<button type="button" class="v12-tag-button" data-v12-tag="${escapeHtml(tag.query)}">${escapeHtml(tag.label)}</button>`).join("")}
      </div>
      <div class="v12-filter-meta"><span>検索欄は名前・タグ・説明文・能力を横断検索</span><strong id="v12PickerCount">0件</strong></div>
    `;
    pickerList.parentElement.insertBefore(panel, pickerList);

    panel.querySelector("#v12WeaponType").addEventListener("change", event => {
      state.pickerFilters.weaponType = event.target.value;
      renderPicker();
    });
    panel.querySelector("#v12Attribute").addEventListener("change", event => {
      state.pickerFilters.attribute = event.target.value;
      renderPicker();
    });
    panel.querySelector("#v12PickerSort").addEventListener("change", event => {
      state.pickerFilters.sort = event.target.value;
      renderPicker();
    });
    panel.querySelectorAll("[data-v12-tag]").forEach(button => button.addEventListener("click", () => {
      const query = button.dataset.v12Tag || "";
      state.pickerFilters.quickTag = state.pickerFilters.quickTag === query ? "" : query;
      renderPicker();
    }));
  }

  function getPickerTypeValue(item, isWeaponCategory) {
    if (isWeaponCategory) {
      return String(item["武器種"] || item["サブ分類"] || item["表示分類"] || item["分類"] || "").trim();
    }
    return String(item["サブ分類"] || item["表示分類"] || item["分類"] || "").trim();
  }

  function populatePickerFilterOptions(baseItems, isWeaponCategory) {
    const weaponSelect = document.getElementById("v12WeaponType");
    const attributeSelect = document.getElementById("v12Attribute");
    if (!weaponSelect || !attributeSelect) return;

    const weaponTypes = [...new Set(baseItems.map(item => getPickerTypeValue(item, isWeaponCategory)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ja"));
    const attributes = [...new Set(baseItems.map(item => {
      const id = String(item["属性ID"] || "").trim();
      return context.attributeMap.get(id)?.["属性名"] || id;
    }).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));

    const currentWeapon = state.pickerFilters.weaponType;
    const currentAttribute = state.pickerFilters.attribute;
    weaponSelect.innerHTML = `<option value="">すべて</option>${weaponTypes.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    attributeSelect.innerHTML = `<option value="">すべて</option>${attributes.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    weaponSelect.value = weaponTypes.includes(currentWeapon) ? currentWeapon : "";
    attributeSelect.value = attributes.includes(currentAttribute) ? currentAttribute : "";
    if (weaponSelect.value !== currentWeapon) state.pickerFilters.weaponType = weaponSelect.value;
    if (attributeSelect.value !== currentAttribute) state.pickerFilters.attribute = attributeSelect.value;
  }

  function makeCollapsible(targets, key, label, initiallyOpen = true) {
    const nodes = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    const target = nodes[0];
    if (!target || target.closest(`[data-v12-collapse="${key}"]`)) return;
    const storageKey = `irunadb.v12.collapse.${key}`;
    const wrapper = document.createElement("div");
    wrapper.className = "v12-collapsible";
    wrapper.dataset.v12Collapse = key;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "v12-collapse-toggle";
    toggle.innerHTML = `<span>${escapeHtml(label)}</span><span class="v12-arrow">▼</span>`;
    const content = document.createElement("div");
    content.className = "v12-collapse-content";
    target.parentElement.insertBefore(wrapper, target);
    wrapper.append(toggle, content);
    nodes.forEach(node => content.appendChild(node));

    const saved = localStorage.getItem(storageKey);
    const open = saved === null ? initiallyOpen : saved === "open";
    wrapper.classList.toggle("is-collapsed", !open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.addEventListener("click", () => {
      const collapsed = wrapper.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      localStorage.setItem(storageKey, collapsed ? "closed" : "open");
    });
  }

  function setupPanelCollapsibles() {
    document.querySelectorAll(".sim-panel").forEach((panel, index) => {
      const header = panel.querySelector(":scope > .sim-panel-header");
      if (!header || header.querySelector(".panel-collapse-button")) return;
      const title = header.querySelector("h3")?.textContent?.trim() || `panel-${index}`;
      const key = title.replace(/\s+/g, "-");
      const storageKey = `irunadb.panel.${key}.collapsed`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "panel-collapse-button";
      button.setAttribute("aria-label", `${title}を折りたたむ`);
      const collapsed = localStorage.getItem(storageKey) === "true";
      panel.classList.toggle("is-panel-collapsed", collapsed);
      button.textContent = collapsed ? "⌄" : "⌃";
      button.setAttribute("aria-expanded", String(!collapsed));
      header.appendChild(button);
      button.addEventListener("click", event => {
        event.stopPropagation();
        const nowCollapsed = panel.classList.toggle("is-panel-collapsed");
        button.textContent = nowCollapsed ? "⌄" : "⌃";
        button.setAttribute("aria-expanded", String(!nowCollapsed));
        localStorage.setItem(storageKey, String(nowCollapsed));
      });
    });
  }

  function setupV12Ui() {
    injectV12Styles();
    createPickerFilterUi();
    updateVersionLabel();
  }

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
      context.searchIndex.set(String(item["アイテムID"]), [item["名前"], item["分類"], item["表示分類"], item["サブ分類"], item["武器種"], attributeName, item["タグ概要"], item["説明文"], item["特殊性能"], effectTexts].map(normalizeSearchText).join(" "));
    });
  }

  function mergeJobMaster() {
    const names = new Set(state.jobs.map(job => String(job["職業名"] || "").trim()).filter(Boolean));
    JOB_MASTER_V12.forEach((name, index) => {
      if (!names.has(name)) state.jobs.push({ "職業ID": `V12_${String(index + 1).padStart(2, "0")}`, "職業名": name, "表示順": 9000 + index });
    });
  }

  function getDatabaseTypeValue(item) {
    const category = String(item["分類"] || item["表示分類"] || "").trim();
    if (category === "武器") return String(item["武器種"] || item["サブ分類"] || "武器").trim();
    const normalized = category || String(item["表示分類"] || item["サブ分類"] || "").trim();
    const aliases = { "体装備":"体", "追加装備":"追加", "特殊装備":"特殊", "アルクリ":"アルクリスタ", "☆":"☆能力" };
    return aliases[normalized] || normalized;
  }

  function initializeSkillData() {
    const data = window.IRUNA_SKILL_DATA || { jobs:[], skills:[], effects:[], conditions:[] };
    if (Array.isArray(data.jobs) && data.jobs.length) state.jobs = data.jobs.map(job => ({ ...job }));
    context.skillsByJob.clear(); context.skillEffectsBySkill.clear(); context.skillConditionMap.clear();
    const buildReflectSkillIds = new Set(
      (Array.isArray(data.effects) ? data.effects : [])
        .filter(effect => String(effect["ビルド反映"] || "").toUpperCase() === "TRUE" && String(effect["有効"] || "TRUE").toUpperCase() !== "FALSE")
        .map(effect => String(effect["スキルID"] || ""))
        .filter(Boolean)
    );
    data.skills.forEach(skill => {
      // v2.9.18: 未分類でも「ビルド反映=TRUE」の効果を持つスキルは表示・反映対象にする。
      // 効果未登録の未分類スキルは従来どおり除外し、未確定値を合計能力へ混ぜない。
      const skillId = String(skill["スキルID"] || "");
      const isUncategorized = String(skill["カテゴリ"] || "").trim() === "未分類";
      if (isUncategorized && !buildReflectSkillIds.has(skillId)) return;
      const jid=String(skill["職業ID"]||""); if(!context.skillsByJob.has(jid)) context.skillsByJob.set(jid,[]); context.skillsByJob.get(jid).push(skill);
      if(String(skill["選択方式"]||"")==="AUTO") state.selectedSkills.add(skillId);
    });
    data.effects.forEach(effect => { const sid=String(effect["スキルID"]||""); if(!context.skillEffectsBySkill.has(sid)) context.skillEffectsBySkill.set(sid,[]); context.skillEffectsBySkill.get(sid).push(effect); });
    data.conditions.forEach(cond => { const gid=String(cond["条件グループID"]||""); if(!context.skillConditionMap.has(gid)) context.skillConditionMap.set(gid,[]); context.skillConditionMap.get(gid).push(cond); });
  }

  function renderSkills() {
    if (!skillSelections) return;
    const jobId = String(state.status.jobId || "");
    const list = [...(context.skillsByJob.get(jobId) || [])]
      .sort((x, y) => Number(x["表示順"] || 999) - Number(y["表示順"] || 999));
    if (!jobId) {
      skillSelections.innerHTML = '<div class="state-card">職業を選択してください。</div>';
      return;
    }
    if (!list.length) {
      const jobName = context.jobMap.get(jobId)?.["職業名"] || "この職業";
      skillSelections.innerHTML = `<div class="state-card">${escapeHtml(jobName)}は、現在ビルドへ数値反映できる確定スキルがありません。</div>`;
      return;
    }

    // 同名スキルのLv・状態候補を1枚のカードへまとめる。
    const categories = new Map();
    list.forEach(skill => {
      const category = String(skill["カテゴリ"] || "その他");
      const skillName = String(skill["スキル名"] || skill["選択肢名"] || skill["スキルID"] || "スキル");
      if (!categories.has(category)) categories.set(category, new Map());
      const names = categories.get(category);
      if (!names.has(skillName)) names.set(skillName, []);
      names.get(skillName).push(skill);
    });

    const selectedRow = rows => rows.find(row => state.selectedSkills.has(String(row["スキルID"] || "")));
    const defaultRow = rows => rows.find(row => String(row["初期選択"] || "").toUpperCase() === "TRUE") || rows[rows.length - 1] || rows[0];

    const cardFor = (skillName, rows) => {
      const active = selectedRow(rows);
      const chosen = active || defaultRow(rows);
      const mode = String(chosen?.["選択方式"] || rows[0]?.["選択方式"] || "CHECK");
      const isAuto = rows.some(row => String(row["選択方式"] || "") === "AUTO");
      const isOn = isAuto || Boolean(active);
      const hasChoices = rows.length > 1 || mode === "LEVEL" || mode === "RADIO";
      const description = String(chosen?.["説明文"] || chosen?.["特殊効果"] || rows[0]?.["説明文"] || rows[0]?.["特殊効果"] || "");
      const safeName = encodeURIComponent(skillName);
      const options = rows.map(row => {
        const id = String(row["スキルID"] || "");
        const label = String(row["選択肢名"] || row["適用Lv"] || row["最大Lv"] || skillName);
        return `<option value="${escapeHtml(id)}" ${String(chosen?.["スキルID"] || "") === id ? "selected" : ""}>${escapeHtml(label)}</option>`;
      }).join("");

      return `<article class="skill-card ${isOn ? "is-active" : ""} ${isAuto ? "skill-auto" : ""}">
        <div class="skill-card-main">
          <label class="skill-toggle-row">
            <input type="checkbox" data-skill-toggle="${escapeHtml(safeName)}" ${isOn ? "checked" : ""} ${isAuto ? "disabled" : ""}>
            <span class="skill-card-copy"><b>${escapeHtml(skillName)}</b>${description ? `<small>${escapeHtml(description)}</small>` : ""}</span>
          </label>
          ${isAuto ? '<em class="skill-badge">自動</em>' : ""}
        </div>
        ${hasChoices ? `<label class="skill-level-control"><span>Lv・状態</span><select data-skill-choice="${escapeHtml(safeName)}" ${isOn ? "" : "disabled"}>${options}</select></label>` : ""}
      </article>`;
    };

    skillSelections.innerHTML = [...categories].map(([category, names]) =>
      `<section class="skill-group"><h4>${escapeHtml(category)}</h4><div class="skill-card-list">${[...names].map(([name, rows]) => cardFor(name, rows)).join("")}</div></section>`
    ).join("");

    const rowsForName = encoded => {
      const name = decodeURIComponent(String(encoded || ""));
      return list.filter(row => String(row["スキル名"] || row["選択肢名"] || row["スキルID"] || "") === name);
    };
    const clearRows = rows => rows.forEach(row => state.selectedSkills.delete(String(row["スキルID"] || "")));
    const finishSkillChange = () => {
      renderSkills();
      renderTotals();
      renderScreenshotSummary();
      syncUrl(false);
    };

    skillSelections.querySelectorAll('[data-skill-toggle]').forEach(input => input.addEventListener('change', () => {
      const rows = rowsForName(input.dataset.skillToggle);
      clearRows(rows);
      if (input.checked) {
        const select = skillSelections.querySelector(`[data-skill-choice="${CSS.escape(String(input.dataset.skillToggle || ""))}"]`);
        const id = String(select?.value || defaultRow(rows)?.["スキルID"] || "");
        if (id) state.selectedSkills.add(id);
      }
      finishSkillChange();
    }));

    skillSelections.querySelectorAll('[data-skill-choice]').forEach(select => select.addEventListener('change', () => {
      const rows = rowsForName(select.dataset.skillChoice);
      clearRows(rows);
      const toggle = skillSelections.querySelector(`[data-skill-toggle="${CSS.escape(String(select.dataset.skillChoice || ""))}"]`);
      if (toggle?.checked || rows.some(row => String(row["選択方式"] || "") === "AUTO")) {
        const id = String(select.value || "");
        if (id) state.selectedSkills.add(id);
      }
      finishSkillChange();
    }));
  }

  function getEquippedWeaponType() {
    const weapon = state.build.weapon ? context.itemsById.get(String(state.build.weapon)) : null;
    return String(weapon?.["武器種"] || weapon?.["サブ分類"] || "").trim();
  }

  function skillEffectConditionsPass(effect) {
    const groupId = String(effect["条件グループID"] || "").trim();
    if (!groupId) return true;
    const rows = context.skillConditionMap.get(groupId) || [];
    if (!rows.length) return true;
    return rows.every(condition => {
      const item = String(condition["条件項目"] || "");
      const op = String(condition["演算子"] || "EQ").toUpperCase();
      const expected = String(condition["比較値ID"] || condition["比較値"] || "").trim();
      if (item === "武器種") {
        const actual = getEquippedWeaponType();
        if (op === "IN") return expected.split(",").map(v => v.trim()).includes(actual);
        return actual === expected;
      }
      // 戦闘中だけ確定する条件は、ビルド画面では効果を加算せず説明のみとする。
      if (["敵ターゲット", "敵状態異常", "騎士の心", "暴撃力", "獣性"].includes(item)) return false;
      return true;
    });
  }

  function evaluateSkillFormula(formula, skill) {
    if(!formula) return NaN;
    const effective = calculateEffectiveStatus().status;
    const vars={Lv:Number(effective.lv||1),STR:Number(effective.str||0),INT:Number(effective.int||0),VIT:Number(effective.vit||0),AGI:Number(effective.agi||0),DEX:Number(effective.dex||0),CRT:Number(effective.crt||0),SLv:Number(skill["最大Lv"]||1),MaxHP:0,現在HP:0,DEX_BEFORE:Number(effective.dex||0),武器精錬値:9,REFINEMENT:9,REFINE:9};
    let expr=String(formula).replace(/FLOOR/g,'Math.floor').replace(/MIN/g,'Math.min').replace(/MAX/g,'Math.max');
    Object.entries(vars).sort((x,y)=>y[0].length-x[0].length).forEach(([k,v])=>{expr=expr.replace(new RegExp(k,'g'),String(v))});
    if(!/^[0-9+\-*/()., Mathminfloorax]+$/.test(expr)) return NaN;
    try{return Number(Function(`"use strict";return (${expr})`)())}catch{return NaN}
  }

  function collectSelectedSkillEffects() {
    const selected=[]; const jobSkills=context.skillsByJob.get(String(state.status.jobId))||[];
    jobSkills.forEach(skill=>{const sid=String(skill["スキルID"]); const mode=String(skill["選択方式"]||""); if(mode==="AUTO"||state.selectedSkills.has(sid)) selected.push(skill)});
    const rows=[]; const text=[];
    selected.forEach(skill=>(context.skillEffectsBySkill.get(String(skill["スキルID"]))||[]).forEach(effect=>{
      if(String(effect["ビルド反映"]??"TRUE").toUpperCase()==="FALSE")return;
      if(!skillEffectConditionsPass(effect)) { if(effect["表示文"]) text.push(`条件付き：${String(effect["表示文"])}`); return; }
      const statId=String(effect["能力ID"]||""); const unit=String(effect["単位"]||"");
      // v2.9.15: 空欄/null を Number() に通すと 0 になり、計算式が実行されない不具合を修正。
      // 「値」が実際に入力されている場合だけ固定値として扱い、空欄なら数式を評価する。
      const rawValue = effect["値"];
      const hasFixedValue = rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== "";
      let value = hasFixedValue ? Number(rawValue) : NaN;
      if(!Number.isFinite(value)&&effect["数式"]) value=evaluateSkillFormula(effect["数式"],skill);
      if(statId&&Number.isFinite(value)) rows.push({
        statId, unit, value, source: 'skill',
        sourceName: String(skill["スキル名"] || skill["選択肢名"] || "スキル"),
        sourceLabel: `スキル：${String(skill["選択肢名"] || skill["スキル名"] || "スキル")}`,
        effectText: String(effect["表示文"] || "")
      }); else if(effect["表示文"]) text.push(String(effect["表示文"]));
    }));
    selected.forEach(skill=>{if(skill["特殊効果"])text.push(`${skill["選択肢名"]||skill["スキル名"]}: ${skill["特殊効果"]}`)});
    return {selected,rows,text};
  }

  function populateDatabaseFilters() {
    const weapon = document.getElementById("databaseWeaponType");
    const attribute = document.getElementById("databaseAttribute");
    const weaponTypes = [...new Set(state.items.map(getDatabaseTypeValue).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja"));
    const attributes = [...new Set(state.items.map(item => { const id=String(item["属性ID"]||""); return context.attributeMap.get(id)?.["属性名"] || id; }).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ja"));
    weapon.innerHTML = `<option value="">すべて</option>${weaponTypes.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("")}`;
    attribute.innerHTML = `<option value="">すべて</option>${attributes.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("")}`;
    weapon.value = state.databaseFilters.weaponType; attribute.value = state.databaseFilters.attribute;
  }

  function toggleFavorite(itemId) {
    const id = String(itemId || "");
    if (!id) return;
    if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    localStorage.setItem("irunadb.favorites", JSON.stringify([...state.favorites]));
    renderDatabase();
  }

  function setView(view) {
    state.activeView = view;
    document.querySelectorAll(".main-tab").forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".app-view").forEach(section => section.classList.toggle("is-active", section.id === `view-${view}`));

    const mainTabs = document.getElementById("mainTabs");
    const mobileToggle = document.getElementById("mobileTabToggle");
    if (mainTabs && mobileToggle && window.matchMedia("(max-width: 720px)").matches) {
      mainTabs.classList.remove("is-open");
      mobileToggle.setAttribute("aria-expanded", "false");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function itemMatchesSlot(item, slot) {
    const candidates = [item["分類"], item["表示分類"], item["サブ分類"]]
      .map(value => String(value || "").trim())
      .filter(Boolean);
    const aliases = slot.aliases?.length ? slot.aliases : [slot.category];
    return candidates.some(value => aliases.includes(value));
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

  function allSelectedSourceEntries() {
    const entries = [];
    const pushEntry = (id, label, kind) => {
      if (!id) return;
      const item = context.itemsById.get(String(id));
      entries.push({
        id: String(id),
        label: String(label || kind || "選択項目"),
        kind: String(kind || "アイテム"),
        name: String(item?.["名前"] || id)
      });
    };

    SLOT_DEFS.forEach(slot => {
      if (slot.key === "decoration") return;
      pushEntry(state.build[slot.key], slot.label, "装備");
    });

    SLOT_DEFS.forEach(slot => {
      if (slot.key === "decoration") {
        pushEntry(state.build.stars[slot.key], `${slot.label}・☆能力`, "☆能力");
        return;
      }
      const slotCount = Number(state.build.equipmentSettings[slot.key]?.slots || 0);
      (state.build.crystals[slot.key] || []).slice(0, slotCount).forEach((id, index) =>
        pushEntry(id, `${slot.label}・クリスタ${index + 1}`, "クリスタ")
      );
      pushEntry(state.build.stars[slot.key], `${slot.label}・☆能力`, "☆能力");
    });

    state.build.alCrystas.forEach((id, index) =>
      pushEntry(id, `アルクリスタ${index + 1}`, "アルクリスタ")
    );
    state.build.relicPlacements.forEach((entry, index) =>
      pushEntry(entry.itemId, `レリック${index + 1}`, "レリック")
    );
    return entries;
  }

  function allSelectedIds() {
    return allSelectedSourceEntries().map(entry => entry.id);
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
      if (slot.key === "decoration") {
        return `
          <section class="equipment-option-group decoration-star-only">
            <h3>${escapeHtml(slot.label)}</h3>
            <div class="equipment-option-content">
              <p class="decoration-note">装飾は装備・クリスタを選択せず、☆能力のみ設定します。</p>
              <div class="equipment-option-slots star-only-slot">
                ${renderMiniSlot(`star_${slot.key}`, "☆能力")}
              </div>
            </div>
          </section>
        `;
      }
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
              ${slot.key === "special" ? `<span class="fixed-refinement-note is-none">精錬なし</span>` : `<span class="fixed-refinement-note">精錬 +9 固定</span>`}
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
      .forEach(button => button.addEventListener("click", () => {
        const token = button.dataset.slotPick;
        const descriptor = getSlotDescriptor(token);
        const itemId = descriptor?.get();
        const item = itemId ? context.itemsById.get(String(itemId)) : null;
        if (item) {
          modal.open(item, context, { changeLabel: "この枠を変更", onChange: () => openPicker(token) });
        } else {
          openPicker(token);
        }
      }));

    equipmentOptions.querySelectorAll("[data-slot-count-key]").forEach(select => {
      select.addEventListener("change", event => {
        const key = event.target.dataset.slotCountKey;
        const count = Number(event.target.value);
        state.build.equipmentSettings[key].slots = count;
        state.build.equipmentSettings[key].refinement = key === "special" ? 0 : 9;
        for (let index = count; index < 2; index += 1) {
          state.build.crystals[key][index] = null;
        }
        syncUrl(false);
        renderBuild();
      });
    });

    renderRelicBoard();
  }



  function formatFormulaText(value) {
    const source = String(value ?? "").trim();
    if (!source) return "";

    let text = source
      .replace(/If \[([A-Za-z]+)\s*>\s*(\d+)\] then\s*/gi, "$1が$2より大きい場合、")
      .replace(/If \[([A-Za-z]+)\s*<\s*(\d+)\] then\s*/gi, "$1が$2未満の場合、")
      .replace(/When equip \[([^\]]+)\] then\s*/gi, "「$1」を装備している場合、")
      .replace(/If \[Mage\] then\s*/gi, "魔法職の場合、")
      .replace(/If \[Sniper\] then\s*/gi, "スナイパーの場合、")
      .replace(/If \[Enchanter\] then\s*/gi, "エンチャンターの場合、")
      .replace(/\[Mage\]/gi, "魔法職の場合")
      .replace(/\[Sniper\]/gi, "スナイパーの場合")
      .replace(/\[Enchanter\]/gi, "エンチャンターの場合")
      .replace(/\[Unknown\]/gi, "特定条件時");

    const blocks = [...text.matchAll(/\[([^\]]+)\]/g)].map(match => match[1].trim());
    if (!blocks.length) return text;

    const variables = new Map();
    const descriptions = [];
    const normalizeExpression = expression => String(expression)
      .replace(/\bLv\b/g, "レベル")
      .replace(/\s*[·*]\s*/g, "×")
      .replace(/\s*\/\s*/g, "÷")
      .replace(/\s*\+\s*/g, "＋")
      .replace(/\s*-\s*/g, "－");

    blocks.forEach(block => {
      const assignment = block.match(/^([XY])\s*=\s*(.+)$/i);
      if (assignment) {
        const variable = assignment[1].toUpperCase();
        let expression = normalizeExpression(assignment[2]);
        variables.forEach((saved, key) => {
          expression = expression.replace(new RegExp(`\\b${key}\\b`, "g"), `（${saved}）`);
        });
        variables.set(variable, expression);
        return;
      }

      const increase = block.match(/^(.+?)\s+up by\s+(.+)$/i);
      if (increase) {
        const target = increase[1].trim() || "能力";
        let amount = normalizeExpression(increase[2]);
        variables.forEach((saved, key) => {
          amount = amount.replace(new RegExp(`\\b${key}\\b`, "g"), `（${saved}）`);
        });
        descriptions.push(`${target}が${amount}に応じて増加`);
        return;
      }

      descriptions.push(normalizeExpression(block));
    });

    let replaced = text.replace(/(?:\[[^\]]+\]\s*)+/g, () => descriptions.length ? descriptions.join("、") : "");
    return replaced.replace(/\s+/g, " ").trim();
  }

  function isFormulaEffect(effect) {
    const effectType = String(effect?.["効果種類"] || "").trim();
    const formula = String(effect?.["数式"] || "").trim();
    return effectType === "数式" || formula !== "";
  }

  function effectDisplayText(effect) {
    const stat = context.statMap.get(String(effect["能力ID"]));
    const statName = stat?.["表示名"] || effect["能力ID"] || "効果";
    const value = effect["値"];
    const unit = effect["単位"] || "";
    const display = String(effect["表示文"] || "").trim();
    const hasNumericDisplay = /[-+]?\d/.test(display);
    if (display && (hasNumericDisplay || isBlank(value))) return formatFormulaText(display);
    if (!isBlank(value)) {
      const number = Number(value);
      const prefix = Number.isFinite(number) && number > 0 ? "+" : "";
      return `${statName}${prefix}${value}${unit}`;
    }
    if (effect["数式"]) return `${formatFormulaText(display || statName)}（${formatFormulaText(effect["数式"])}）`;
    return formatFormulaText(display || statName);
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
      .filter(effect => !isFormulaEffect(effect))
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
    const item = context.itemsById.get(String(itemId));
    if (state.build.relicPlacements.length >= 15) {
      relicMessage.textContent = "レリックは最大15個まで選択できます。";
      return;
    }
    const placement = {
      uid: `r${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
      itemId: String(itemId),
      x: 0,
      y: 0,
      rotation: 0
    };
    state.build.relicPlacements.push(placement);
    state.selectedRelicUid = placement.uid;
    relicMessage.textContent = `${item?.["名前"] || "レリック"}を追加しました。形状・配置は現在計算しません。`;
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
            </button>
            <button class="relic-row-detail" type="button" data-relic-detail="${placement.uid}">詳細</button>
          </article>`;
        }).join("")
      : '<p class="empty-relic-list">まだレリックは追加されていません。</p>';

    relicPlacementList.querySelectorAll("[data-relic-select]").forEach(button => {
      button.addEventListener("click", () => {
        const placement = state.build.relicPlacements.find(entry => entry.uid === button.dataset.relicSelect);
        if (!placement) return;
        // v2.9.20: 行タップは詳細表示ではなく削除対象の選択にする。
        // 詳細は右端の「詳細」ボタンから開く。
        state.selectedRelicUid = placement.uid;
        const item = context.itemsById.get(String(placement.itemId));
        relicMessage.textContent = `${item?.["名前"] || "レリック"}を選択しました。削除ボタンでこのレリックを削除できます。`;
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

    relicCount.textContent = `${state.build.relicPlacements.length} / 15`;
    const selectedExists = state.build.relicPlacements.some(entry => entry.uid === state.selectedRelicUid);
    rotateRelicButton.disabled = true;
    removeRelicButton.disabled = !selectedExists;
  }

  function renderBuild() {
    renderSkills();
    equipmentSlots.innerHTML = SLOT_DEFS.map(slot => {
      if (slot.key === "decoration") {
        const starId = state.build.stars.decoration;
        const star = starId ? context.itemsById.get(String(starId)) : null;
        return `<article class="equipment-slot equipment-card decoration-card ${star ? "is-selected" : "is-empty"}">
          <div class="equipment-card-header">
            <div class="equipment-card-type">
              <span class="slot-icon" aria-hidden="true">${slot.icon}</span>
              <span><span class="slot-label">${slot.label}</span><small>☆能力専用</small></span>
            </div>
            <button class="equipment-card-collapse" type="button" data-card-collapse="${slot.key}" aria-label="${slot.label}を折りたたむ">⌃</button>
          </div>
          <div class="equipment-card-collapsible">
            <div class="equipment-card-body">
              <button class="slot-item-info slot-detail-button ${star ? "" : "is-empty"}" type="button" data-slot-pick="star_decoration">
                <strong>${escapeHtml(star?.["名前"] || "＋ ☆能力を選ぶ")}</strong>
                <small>${star ? "タップして☆能力を変更" : "装飾は☆能力のみ設定します"}</small>
              </button>
            </div>
          </div>
        </article>`;
      }
      const item = state.build[slot.key] ? context.itemsById.get(String(state.build[slot.key])) : null;
      const slotCount = Number(state.build.equipmentSettings[slot.key]?.slots || 0);
      const refinement = Number(state.build.equipmentSettings[slot.key]?.refinement ?? 9);
      return `<article class="equipment-slot equipment-card ${item ? "is-selected" : "is-empty"}">
        <div class="equipment-card-header">
          <div class="equipment-card-type">
            <span class="slot-icon" aria-hidden="true">${slot.icon}</span>
            <span>
              <span class="slot-label">${slot.label}</span>
              <small>${item ? "選択済み" : "未選択"}</small>
            </span>
          </div>
          <div class="equipment-card-header-actions">
            ${item ? `<span class="slot-selected-badge">選択中</span>` : `<span class="slot-empty-badge">未設定</span>`}
            <button class="equipment-card-collapse" type="button" data-card-collapse="${slot.key}" aria-label="${slot.label}を折りたたむ">⌃</button>
          </div>
        </div>
        <div class="equipment-card-collapsible">
        <div class="equipment-card-body">
          ${item ? `<button class="slot-item-info slot-detail-button" type="button" data-slot-detail="${slot.key}">
              <strong>${escapeHtml(item["名前"] || "名称未設定")}</strong>
              <span class="equipment-meta-chips">
                ${slot.key === "special" ? "" : `<small>精錬 +${refinement}</small>`}
                <small>${slotCount}スロット</small>
                <small>詳細を見る</small>
              </span>
            </button>` : `<button class="slot-item-info slot-detail-button is-empty" type="button" data-slot-pick="${slot.key}">
              <strong>＋ ${slot.label}を選ぶ</strong>
              <small>名前・タグ・能力から検索できます</small>
            </button>`}
        </div>
        <div class="equipment-card-actions">
          <button class="slot-change" type="button" data-slot-pick="${slot.key}"><span aria-hidden="true">⌕</span>${item ? "装備を変更" : "装備を検索"}</button>
          ${item ? `<button class="slot-remove" type="button" data-slot-remove="${slot.key}" aria-label="${slot.label}を解除"><span aria-hidden="true">×</span>解除</button>` : ""}
        </div>
        </div>
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
    equipmentSlots.querySelectorAll("[data-card-collapse]").forEach(button => {
      const key = button.dataset.cardCollapse;
      const card = button.closest(".equipment-card");
      const storageKey = `irunadb.equipment-card.${key}.collapsed`;
      const collapsed = localStorage.getItem(storageKey) === "true";
      card.classList.toggle("is-collapsed", collapsed);
      button.textContent = collapsed ? "⌄" : "⌃";
      button.setAttribute("aria-expanded", String(!collapsed));
      button.addEventListener("click", event => {
        event.stopPropagation();
        const nowCollapsed = card.classList.toggle("is-collapsed");
        button.textContent = nowCollapsed ? "⌄" : "⌃";
        button.setAttribute("aria-expanded", String(!nowCollapsed));
        localStorage.setItem(storageKey, String(nowCollapsed));
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
    const effectiveStatus = calculateEffectiveStatus().status;
    if (["LV", "LEVEL", "レベル"].includes(key)) return effectiveStatus.lv;
    if (["STR", "INT", "VIT", "AGI", "DEX", "CRT"].includes(key)) {
      return effectiveStatus[key.toLowerCase()];
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

  function evaluateSimpleStatusExpression(expression, vars) {
    let expr = String(expression || "").trim();
    if (!expr) return NaN;
    expr = expr
      .replace(/FLOOR/gi, "Math.floor")
      .replace(/CEIL/gi, "Math.ceil")
      .replace(/ROUND/gi, "Math.round")
      .replace(/MIN/gi, "Math.min")
      .replace(/MAX/gi, "Math.max");

    const names = Object.keys(vars).sort((a, b) => b.length - a.length);
    names.forEach(name => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expr = expr.replace(new RegExp(`\\b${escaped}\\b`, "g"), String(Number(vars[name] || 0)));
    });

    if (!/^[0-9+\-*/().,\sA-Za-z.]+$/.test(expr)) return NaN;
    try {
      const value = Function(`"use strict"; return (${expr});`)();
      return Number(value);
    } catch (_) {
      return NaN;
    }
  }

  function calculateEffectiveStatus() {
    const status = {
      lv: Number(state.status.lv || 1),
      str: Number(state.status.str || 0),
      int: Number(state.status.int || 0),
      vit: Number(state.status.vit || 0),
      agi: Number(state.status.agi || 0),
      dex: Number(state.status.dex || 0),
      crt: Number(state.status.crt || 0)
    };
    const deltas = [];
    const selectedEntries = allSelectedSourceEntries();

    const statusKeyMap = {
      LV: "lv", LEVEL: "lv", STR: "str", INT: "int", VIT: "vit",
      AGI: "agi", DEX: "dex", CRT: "crt"
    };

    selectedEntries.forEach(sourceEntry => {
      (context.effectsByItem.get(String(sourceEntry.id)) || []).forEach(effect => {
        if (!isFormulaEffect(effect)) return;
        const formula = String(effect["数式"] || "").trim();
        if (!formula) return;

        const vars = {
          Lv: status.lv, LEVEL: status.lv,
          STR: status.str, INT: status.int, VIT: status.vit,
          AGI: status.agi, DEX: status.dex, CRT: status.crt,
          X: 0, Y: 0, Z: 0,
          武器精錬値: Number(state.build.equipmentSettings.weapon?.refinement || 0),
          REFINEMENT: Number(state.build.equipmentSettings.weapon?.refinement || 0),
          REFINE: Number(state.build.equipmentSettings.weapon?.refinement || 0)
        };

        formula.split(/[;\n]+/).map(part => part.trim()).filter(Boolean).forEach(statement => {
          let match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(statement);
          if (match) {
            const value = evaluateSimpleStatusExpression(match[2], vars);
            if (Number.isFinite(value)) vars[match[1]] = value;
            return;
          }

          match = /^(STR|INT|VIT|AGI|DEX|CRT)\s+up\s+by\s+(.+)$/i.exec(statement);
          if (match) {
            const statName = match[1].toUpperCase();
            const value = evaluateSimpleStatusExpression(match[2], vars);
            if (!Number.isFinite(value)) return;
            const applied = Math.trunc(value);
            const key = statusKeyMap[statName];
            status[key] += applied;
            vars[statName] = status[key];
            if (statName === "LV") vars.Lv = status[key];
            deltas.push({
              statId: statName,
              unit: "",
              value: applied,
              sourceId: String(sourceEntry.id),
              sourceName: sourceEntry.name,
              sourceLabel: sourceEntry.label,
              effectText: String(effect["表示文"] || formula)
            });
          }
        });
      });
    });

    return { status, deltas };
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

  
  const STAT_NAME_ALIASES = {
    "詠唱":"詠唱時間",
    "ボスに物理":"ボス物理",
    "ボスに魔法":"ボス魔法",
    "スペルバースト":"スペルバースト率",
    "物理貫通率":"物理貫通",
    "魔法貫通率":"魔法貫通",
    "魔法威力増加":"魔法威力",
    "状態異常耐性":"異常耐性",
    "割合ダメージ軽減":"割合軽減",
    "範囲ダメージ軽減":"範囲軽減",
    "最大HP":"MaxHP",
    "最大MP":"MaxMP",
    "オートスキル発動":"オートスキル発動率"
  };

  function normalizeAbilityName(name){
    const normalized = String(name ?? "")
      .normalize("NFKC")
      .replace(/[\s　]+/g, "")
      .replace(/－/g, "-");
    const aliases = {
      "オートスキル": "オートスキル発動率",
      "オートスキル発動": "オートスキル発動率",
      "オートスキル発動率": "オートスキル発動率"
    };
    return aliases[normalized] || normalized;
  }

  function displayStatName(statId){
    const raw = context.statMap.get(statId)?.["表示名"] || statId;
    const normalized = String(raw ?? "").normalize("NFKC");
    const aliased = STAT_NAME_ALIASES[raw] || STAT_NAME_ALIASES[normalized] || normalized;
    return normalizeAbilityName(aliased);
  }

  function findStatIdByDisplayName(targetName) {
    // STAT_MASTERを優先
    for (const [statId] of context.statMap.entries()) {
      if (displayStatName(String(statId)) === targetName) return String(statId);
    }

    // ITEM_EFFECT側も検索
    for (const effects of context.effectsByItem.values()) {
      for (const effect of (effects || [])) {
        const statId = String(effect["能力ID"] || "");
        if (statId && displayStatName(statId) === targetName) return statId;
      }
    }

    // 能力ID自体が表示名のケース（スキルDB等）
    return targetName;
  }

function collectTotalData() {
    const selectedEntries = allSelectedSourceEntries();
    const selectedIds = selectedEntries.map(entry => entry.id);
    const totals = new Map(), textOnly = [];
    const activeConditional = [], inactiveConditional = [];

    // v2.9.20: ディレイ系で「秒」と単位空欄が別能力として分裂しないように正規化。
    const normalizeTotalUnit = (statId, unit) => {
      const displayName = String(displayStatName(String(statId)) || statId || "")
        .replace(/[\s　]+/g, "")
        .replace(/－/g, "-");
      const rawUnit = String(unit ?? "").normalize("NFKC").trim();
      const lowerUnit = rawUnit.toLowerCase();
      if (["%", "percent", "pct"].includes(lowerUnit)) return "%";
      if (["スキルディレイ", "アイテムディレイ", "ディレイ"].includes(displayName)) {
        if (["", "s", "sec", "second", "seconds", "秒"].includes(lowerUnit || rawUnit)) return "秒";
      }
      return rawUnit;
    };

    const addNumericRaw = (statId, unit, numeric, sourceInfo) => {
      const normalizedUnit = normalizeTotalUnit(statId, unit);
      const key = `${statId}__${normalizedUnit}`;
      const current = totals.get(key) || { statId, unit: normalizedUnit, value: 0, sources: [] };
      current.value += numeric;
      current.sources.push({ ...sourceInfo, unit: normalizedUnit });
      totals.set(key, current);
    };

    // v2.9.11: 同一アイテムに「個別能力」と「複合能力」が両方登録されている場合、
    // 複合能力の分配で二重加算しないため、各アイテムが直接持つ能力名を先に記録する。
    const directAbilityNamesBySource = new Map();
    const directAbilityKeysBySource = new Map();
    selectedEntries.forEach(sourceEntry => {
      const names = new Set();
      const keys = new Set();
      (context.effectsByItem.get(sourceEntry.id) || []).forEach(effect => {
        if (isFormulaEffect(effect)) return;
        const statId = String(effect["能力ID"] || "");
        if (!statId) return;
        const name = String(displayStatName(statId) || "")
          .replace(/[\s　]+/g, "")
          .replace(/－/g, "-");
        if (name) {
          names.add(name);
          keys.add(`${name}__${normalizeTotalUnit(statId, effect["単位"] || "")}`);
        }
      });
      directAbilityNamesBySource.set(String(sourceEntry.id), names);
      directAbilityKeysBySource.set(String(sourceEntry.id), keys);
    });

    const addNumeric = (statId, unit, numeric, sourceInfo) => {
      const displayName = String(displayStatName(statId) || "")
        .replace(/[\s　]+/g, "")
        .replace(/－/g, "-");

      // v2.6.6:
      // 「ディレイ」はスキルディレイ・アイテムディレイの両方を短縮する共通値として扱う。
      // 合計欄には「ディレイ」単独行を出さず、2項目へ吸収する。
      // v2.9.11: 複合能力は最終値が分かるよう個別能力へ分配して集計する。
      // 例: 「絶対・魔法回避 +17%」→ 絶対回避 +17% / 魔法回避 +17%
      const compositeTargets = {
        "絶対・魔法回避": ["絶対回避", "魔法回避"],
        "物理・魔法耐性": ["物理耐性", "魔法耐性"]
      };
      const targets = compositeTargets[displayName];
      if (targets) {
        const directNames = directAbilityNamesBySource.get(String(sourceInfo?.id || "")) || new Set();
        targets.forEach(targetName => {
          // 同一アイテムに対象の個別能力が既にある場合は、複合能力からは加算しない。
          if (directNames.has(targetName)) return;
          const targetId = findStatIdByDisplayName(targetName) || targetName;
          addNumericRaw(targetId, unit, numeric, {
            ...sourceInfo,
            effectText: sourceInfo?.effectText || `${displayName}${numeric > 0 ? "+" : ""}${numeric}${unit || ""}`,
            sourceAbility: displayName,
            appliedAs: targetName
          });
        });
        return;
      }

      if (displayName === "ディレイ") {
        // 共通ディレイはスキル/アイテムの両方へ展開する。
        // v2.9.20: 同じアイテムに同単位の個別ディレイが登録済みなら、
        // 共通ディレイ側からは重ねて加算しない（二重発動防止）。
        const skillDelayId = findStatIdByDisplayName("スキルディレイ") || "スキルディレイ";
        const itemDelayId = findStatIdByDisplayName("アイテムディレイ") || "アイテムディレイ";
        const normalizedUnit = normalizeTotalUnit(statId, unit);
        const directKeys = directAbilityKeysBySource.get(String(sourceInfo?.id || "")) || new Set();

        const sharedSource = {
          ...sourceInfo,
          effectText: sourceInfo?.effectText || `ディレイ${numeric > 0 ? "+" : ""}${numeric}${normalizedUnit || ""}`,
          sourceAbility: "ディレイ"
        };

        if (!directKeys.has(`スキルディレイ__${normalizedUnit}`)) {
          addNumericRaw(skillDelayId, normalizedUnit, numeric, {
            ...sharedSource,
            appliedAs: "スキルディレイ"
          });
        }

        if (!directKeys.has(`アイテムディレイ__${normalizedUnit}`)) {
          addNumericRaw(itemDelayId, normalizedUnit, numeric, {
            ...sharedSource,
            appliedAs: "アイテムディレイ"
          });
        }

        return;
      }

      addNumericRaw(statId, unit, numeric, sourceInfo);
    };

    selectedEntries.forEach(sourceEntry => {
      const seenEffectSignatures = new Set();
      (context.effectsByItem.get(sourceEntry.id) || []).filter(effect => {
        if (isFormulaEffect(effect)) return false;
        const groupId = effect["条件グループID"];
        // v2.6.5: 条件付き能力はシミュレーターではすべて発動扱い。
        // 条件文自体は内訳・詳細確認用として保持する。
        if (!isBlank(groupId)) activeConditional.push(effect);
        return true;
      }).forEach(effect => {
        const statId = String(effect["能力ID"] || "");
        const numeric = Number(effect["値"]);
        if (statId && Number.isFinite(numeric) && !isBlank(effect["値"])) {
          const unit = normalizeTotalUnit(statId, effect["単位"] || "");
          const groupId = effect["条件グループID"];
          const displayName = String(displayStatName(statId) || statId).replace(/[\s　]+/g, "");
          const signature = `${displayName}__${unit}__${numeric}__${String(groupId || "")}`;
          // v2.9.20: 同一アイテム内に同じ能力・値・単位・条件の重複行があっても1回だけ反映。
          if (seenEffectSignatures.has(signature)) return;
          seenEffectSignatures.add(signature);
          const group = !isBlank(groupId) ? (context.conditionMap.get(String(groupId)) || []) : [];
          const conditionText = group.map(condition => condition["表示文"]).filter(Boolean).join(" ＆ ");
          addNumeric(statId, unit, numeric, {
            id: sourceEntry.id,
            name: sourceEntry.name,
            label: sourceEntry.label,
            kind: sourceEntry.kind,
            value: numeric,
            unit,
            conditionText,
            effectText: String(effect["表示文"] || "")
          });
        } else if (effect["表示文"]) {
          textOnly.push(String(effect["表示文"]));
        }
      });
    });

    // v2.9.17: 装備のステータス変換式を合計能力へ反映。
    // 例: 流離の服「STRの半分をCRTに変換」→ STR減少 / CRT増加。
    const transformedStatus = calculateEffectiveStatus();
    transformedStatus.deltas.forEach(delta => {
      addNumeric(delta.statId, delta.unit, delta.value, {
        id: delta.sourceId,
        name: delta.sourceName,
        label: delta.sourceLabel,
        kind: "装備数式",
        value: delta.value,
        unit: delta.unit,
        conditionText: "",
        effectText: delta.effectText
      });
    });

    const skillData = collectSelectedSkillEffects();
    skillData.rows.forEach(row => {
      addNumeric(row.statId, row.unit, row.value, {
        id: "skill",
        name: row.sourceName || "スキル",
        label: row.sourceLabel || `スキル：${row.sourceName || "スキル"}`,
        kind: "スキル",
        value: row.value,
        unit: row.unit,
        conditionText: "",
        effectText: row.effectText || ""
      });
    });
    textOnly.push(...skillData.text);

    // 表示名と単位が同じ能力は、元の能力IDが異なっても1行へ統合する。
    const mergedByDisplay = new Map();
    [...totals.values()].forEach(row => {
      const rawDisplayName = normalizeAbilityName(displayStatName(String(row.statId)));
      const normalizedUnit = String(row.unit ?? "").normalize("NFKC").trim();
      // v2.9.23: percentage HIT aliases are one ability.
      // Fixed-value 命中 (no % unit) remains separate.
      const displayName = normalizedUnit === "%" && ["HIT", "HIT率", "命中", "命中率"].includes(rawDisplayName)
        ? "HIT"
        : rawDisplayName;
      const mergeKey = `${displayName}__${normalizedUnit}`;
      const current = mergedByDisplay.get(mergeKey) || {
        ...row,
        statId: displayName === "HIT" ? "HIT" : row.statId,
        unit: normalizedUnit,
        value: 0,
        sources: []
      };
      current.value += Number(row.value || 0);
      current.sources.push(...(row.sources || []));
      mergedByDisplay.set(mergeKey, current);
    });

    // v2.9.24: ダブルアタック発動率（パッシブ）は、
    // 1) スナイパーでヒドゥンスナイパーがON、または
    // 2) 装備・特殊性能などで「ダブルアタックSL+1 / SLv+1」等を取得している
    // 場合だけ表示する。スナイパーを選んだだけでは表示しない。
    const mergedRows = [...mergedByDisplay.values()];
    const isSniper = String(state.status.jobId || "") === "JOB004";
    const hiddenOn = isSniper && state.selectedSkills.has("SNPSK000010");
    const doubleAttackGrantText = [
      ...textOnly.map(v => String(v || "")),
      ...mergedRows.flatMap(row => (row.sources || []).map(src =>
        [src.name, src.label, src.effectText, src.conditionText].filter(Boolean).join(" ")
      ))
    ].join(" ").normalize("NFKC");
    // 「ダブルアタック威力+○%」は取得判定に含めず、SL/SLv表記があるものだけ対象。
    const hasDoubleAttackSkillGrant = /ダブルアタック\s*S(?:KILL)?L(?:V)?\.?\s*(?:\+|＋)?\s*[1-9]\d*/i.test(doubleAttackGrantText);

    // v2.9.25: 装備等の「ダブルアタック発動率+○%」は単独行で表示せず、
    // パッシブが有効な時だけ派生値へ加算する。
    const doubleAttackRateRows = mergedRows.filter(row => {
      const name = normalizeAbilityName(displayStatName(String(row.statId)));
      return ["ダブルアタック発動率", "ダブルアタック率"].includes(name)
        && (String(row.unit || "") === "%" || String(row.unit || "") === "");
    });
    const doubleAttackRateBonus = doubleAttackRateRows
      .reduce((sum, row) => sum + Number(row.value || 0), 0);
    const doubleAttackRateSources = doubleAttackRateRows
      .flatMap(row => row.sources || []);
    // standalone のダブルアタック発動率は常に隠す。
    for (const [key, row] of [...mergedByDisplay.entries()]) {
      const name = normalizeAbilityName(displayStatName(String(row.statId)));
      if (["ダブルアタック発動率", "ダブルアタック率"].includes(name)) {
        mergedByDisplay.delete(key);
      }
    }

    if (hiddenOn || hasDoubleAttackSkillGrant) {
      const finalCrtBonus = mergedRows
        .filter(row => normalizeAbilityName(displayStatName(String(row.statId))) === "CRT")
        .reduce((sum, row) => sum + Number(row.value || 0), 0);
      const finalCrt = Number(state.status.crt || 0) + finalCrtBonus;
      const finalAutoSkillRate = mergedRows
        .filter(row => {
          const name = normalizeAbilityName(displayStatName(String(row.statId)));
          return name === "オートスキル発動率";
        })
        .filter(row => String(row.unit || "") === "%" || String(row.unit || "") === "")
        .reduce((sum, row) => sum + Number(row.value || 0), 0);
      // v2.9.22: 「現在のオートスキル発動率」とヒドゥンスナイパー低下分を分けて計算。
      // mergedRows の finalAutoSkillRate にはヒドゥンスナイパー -20% が既に含まれるため、
      // ON時だけ20%を戻して現在値を求め、式の最後で -20% を明示的に適用する。
      const currentAutoSkillRate = finalAutoSkillRate + (hiddenOn ? 20 : 0);
      const hiddenPenalty = hiddenOn ? 20 : 0;
      const doubleAttackRate = 10 + finalCrt / 8 + currentAutoSkillRate - hiddenPenalty + doubleAttackRateBonus;
      mergedByDisplay.set("ダブルアタック発動率（パッシブ）__%", {
        statId: "ダブルアタック発動率（パッシブ）",
        unit: "%",
        value: doubleAttackRate,
        sources: [
          { id:"derived-da-base", name:"基礎発動率", label:"ダブルアタック（パッシブ）", kind:"計算", value:10, unit:"%", conditionText:"", effectText:"基礎発動率 10%" },
          { id:"derived-da-crt", name:`最終CRT ${formatDisplayNumber(finalCrt)}`, label:"CRT補正", kind:"計算", value:finalCrt / 8, unit:"%", conditionText:"", effectText:`CRT ${formatDisplayNumber(finalCrt)} ÷ 8` },
          { id:"derived-da-auto", name:`現在オート ${formatDisplayNumber(currentAutoSkillRate)}%`, label:"現在のオートスキル発動率", kind:"計算", value:currentAutoSkillRate, unit:"%", conditionText:"", effectText:"装備・クリスタ・アルクリスタ・レリック・スキル等のオートスキル発動率を合算" },
          ...(hiddenOn ? [{ id:"derived-da-hidden", name:"ヒドゥンスナイパー -20%", label:"ヒドゥンスナイパー", kind:"計算", value:-20, unit:"%", conditionText:"ON", effectText:"ダブルアタック発動率から20%低下" }] : []),
          ...(doubleAttackRateBonus ? [{ id:"derived-da-equipment", name:`装備等の発動率 ${formatDisplayNumber(doubleAttackRateBonus)}%`, label:"ダブルアタック発動率補正", kind:"計算", value:doubleAttackRateBonus, unit:"%", conditionText:"", effectText:"装備・クリスタ等のダブルアタック発動率を合算", sources:doubleAttackRateSources }] : [])
        ]
      });
    }

    const rows = [...mergedByDisplay.values()].sort((x,y) => {
      if (x.statId === "ダブルアタック発動率（パッシブ）") return -1;
      if (y.statId === "ダブルアタック発動率（パッシブ）") return 1;
      return (context.statMap.get(x.statId)?.["表示順"] || 9999) -
        (context.statMap.get(y.statId)?.["表示順"] || 9999);
    });
    return { selectedIds, selectedEntries, rows, textOnly, activeConditional, inactiveConditional };
  }

  function selectedItemName(id) {
    return id ? String(context.itemsById.get(String(id))?.["名前"] || "") : "";
  }

  function renderScreenshotSummary(totalData = collectTotalData()) {
    if (!screenshotSummaryBody) return;
    const jobName = state.status.jobId
      ? String(context.jobMap.get(String(state.status.jobId))?.["職業名"] || "未選択")
      : "未選択";
    const statusText = [
      `Lv ${state.status.lv}`,
      `STR ${state.status.str}`, `INT ${state.status.int}`, `VIT ${state.status.vit}`,
      `AGI ${state.status.agi}`, `DEX ${state.status.dex}`, `CRT ${state.status.crt}`
    ].join(" / ");

    const equipmentRows = SLOT_DEFS.map(slot => {
      const itemName = slot.key === "decoration" ? "" : selectedItemName(state.build[slot.key]);
      const setting = state.build.equipmentSettings[slot.key] || {};
      const suffix = itemName
        ? (slot.key === "special" ? `${Number(setting.slots || 0)}s` : `+${Number(setting.refinement || 0)} / ${Number(setting.slots || 0)}s`)
        : "";
      const crystals = slot.key === "decoration" ? [] : (state.build.crystals[slot.key] || [])
        .filter(Boolean).map(id => selectedItemName(id)).filter(Boolean);
      const starName = selectedItemName(state.build.stars[slot.key]);

      // 装飾は☆能力のみ。その他は装備・クリスタ・☆能力を同じ部位行にまとめる。
      if (!itemName && !crystals.length && !starName) return "";
      const itemHtml = itemName
        ? `<span class="screenshot-item-name">${escapeHtml(itemName)} <small>${escapeHtml(suffix)}</small></span>`
        : `<span class="screenshot-item-name empty-mini">—</span>`;
      const attached = [
        ...crystals.map(name => `<span class="screenshot-attach screenshot-crystal">${escapeHtml(name)}</span>`),
        ...(starName ? [`<span class="screenshot-attach screenshot-star">${escapeHtml(starName)}</span>`] : [])
      ].join("");
      return `<li><b>${escapeHtml(slot.label)}</b>${itemHtml}<span class="screenshot-slot-tags">${attached}</span></li>`;
    }).filter(Boolean).join("");

    const alNames = [], relicNames = [];
    state.build.alCrystas.filter(Boolean).forEach(id => {
      const name = selectedItemName(id); if (name) alNames.push(name);
    });
    state.build.relicPlacements.forEach(entry => {
      const name = selectedItemName(entry.itemId); if (name) relicNames.push(name);
    });

    const skillNames = collectSelectedSkillEffects().selected.map(skill => String(skill["選択肢名"] || skill["スキル名"] || "")).filter(Boolean);

    const totalRows = totalData.rows.filter(row => Number(row.value) !== 0).map(row => {
      const name = displayStatName(row.statId);
      const value = `${row.value > 0 ? "+" : ""}${formatDisplayNumber(row.value)}${row.unit}`;
      return `<li><span>${escapeHtml(name)}</span><b>${escapeHtml(value)}</b></li>`;
    }).join("");
    const passiveRows = totalData.textOnly.slice(0, 8).map(text => `<li class="is-text"><span>${escapeHtml(text)}</span></li>`).join("");

    screenshotSummaryBody.innerHTML = `
      <article class="screenshot-card" id="screenshotCard">
        <header><div><strong>IrunaDB</strong><span>ビルドシミュレーター</span></div><small>v${APP_VERSION}</small></header>
        <section class="screenshot-character"><b>${escapeHtml(jobName)}</b><span>${escapeHtml(statusText)}</span></section>
        <section class="screenshot-build-slots"><h4>装備・クリスタ・☆能力</h4><ul class="screenshot-equipment">${equipmentRows || '<li class="empty-mini">未選択</li>'}</ul></section>
        <div class="screenshot-section-grid">
          <section><h4>アルクリスタ</h4><p class="screenshot-tags">${alNames.length ? alNames.map(name => `<span>${escapeHtml(name)}</span>`).join("") : '<span class="empty-mini">未選択</span>'}</p></section>
          <section><h4>レリック</h4><p class="screenshot-tags">${relicNames.length ? relicNames.map(name => `<span>${escapeHtml(name)}</span>`).join("") : '<span class="empty-mini">未選択</span>'}</p></section>
          <section><h4>スキル</h4><p class="screenshot-tags">${skillNames.length ? skillNames.map(name => `<span>${escapeHtml(name)}</span>`).join("") : '<span class="empty-mini">未選択</span>'}</p></section>
        </div>
        <section><h4>合計能力</h4><ul class="screenshot-totals">${totalRows || '<li class="empty-mini">能力なし</li>'}${passiveRows}</ul></section>
      </article>`;
  }

  function renderTotals() {
    const totalData = collectTotalData();
    const { selectedIds, rows, textOnly, activeConditional, inactiveConditional } = totalData;
    selectedCount.textContent = `${selectedIds.length}件＋スキル${collectSelectedSkillEffects().selected.length}件`;

    const totalsHtml =
      rows.map((row, rowIndex) => {
        const name = displayStatName(row.statId);
        const icon = /HP|体力|耐性|軽減|DEF|防御/i.test(name) ? "♥" : /MP|MATK|魔法|詠唱|スペル/i.test(name) ? "✦" : /ATK|物理|クリ|攻撃|貫通/i.test(name) ? "⚔" : "＋";
        const sources = Array.isArray(row.sources) ? row.sources : [];
        const sourceHtml = sources.map(source => {
          const sourceValue = `${source.value > 0 ? "+" : ""}${formatDisplayNumber(source.value)}${source.unit || ""}`;
          const condition = source.conditionText ? `<small class="total-source-condition">条件：${escapeHtml(source.conditionText)}</small>` : "";
          const appliedFrom = source.sourceAbility === "ディレイ"
            ? `<small class="total-source-condition">共通ディレイとして反映</small>`
            : "";
          return `<div class="total-source-row">
            <span><b>${escapeHtml(source.label)}</b><em>${escapeHtml(source.name)}</em>${condition}${appliedFrom}</span>
            <strong>${escapeHtml(sourceValue)}</strong>
          </div>`;
        }).join("");
        return `<details class="total-row total-stat-card total-breakdown" data-total-row="${rowIndex}">
          <summary>
            <span class="total-expand-icon" aria-hidden="true"></span>
            <span class="total-stat-label"><i aria-hidden="true">${icon}</i>${escapeHtml(name)}</span>
            <strong>${row.value > 0 ? "+" : ""}${escapeHtml(formatDisplayNumber(row.value))}${escapeHtml(row.unit)}</strong>
          </summary>
          <div class="total-source-list">
            <div class="total-source-title">効果の発生元 ${sources.length}件</div>
            ${sourceHtml || '<div class="total-source-empty">内訳情報なし</div>'}
          </div>
        </details>`;
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
      renderScreenshotSummary(totalData);
      return;
    }

    totalEffects.innerHTML = totalsHtml + activeHtml + inactiveHtml;
    renderScreenshotSummary(totalData);
  }
  function openPicker(slotToken) {
    state.pickerSlot = slotToken;
    state.pickerQuery = "";
    state.pickerVisibleCount = 80;
    state.pickerFilters = { weaponType: "", attribute: "", quickTag: "", sort: "name" };
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
    const quickTokens = String(state.pickerFilters.quickTag || "")
      .split(/\s+/).map(normalizeSearchText).filter(Boolean);

    const baseItems = state.items.filter(item => itemMatchesSlot(item, descriptor));
    const isWeaponCategory = descriptor.category === "武器";
    const typeFilterLabel = document.getElementById("v12TypeFilterLabel");
    const attributeFilterLabel = document.getElementById("v12Attribute")?.closest("label");
    if (typeFilterLabel) {
      typeFilterLabel.textContent = isWeaponCategory
        ? "武器種"
        : descriptor.category === "☆能力"
          ? "能力種類"
          : "分類";
    }
    if (attributeFilterLabel) attributeFilterLabel.style.display = isWeaponCategory ? "grid" : "none";
    if (!isWeaponCategory) state.pickerFilters.attribute = "";
    populatePickerFilterOptions(baseItems, isWeaponCategory);

    const items = baseItems.filter(item => {
      const itemId = String(item["アイテムID"] || "");
      const searchText = context.searchIndex.get(itemId) || "";
      const pickerType = getPickerTypeValue(item, isWeaponCategory);
      const attributeId = String(item["属性ID"] || "").trim();
      const attributeName = context.attributeMap.get(attributeId)?.["属性名"] || attributeId;
      const weaponMatched = !state.pickerFilters.weaponType || pickerType === state.pickerFilters.weaponType;
      const attributeMatched = !isWeaponCategory || !state.pickerFilters.attribute || attributeName === state.pickerFilters.attribute || attributeId === state.pickerFilters.attribute;
      const queryMatched = !query || searchText.includes(query);
      const tagMatched = !quickTokens.length || quickTokens.some(token => searchText.includes(token));
      return weaponMatched && attributeMatched && queryMatched && tagMatched;
    }).sort((a, b) => {
      // お気に入りは、検索条件や並び順にかかわらず先頭へ表示する。
      const aFavorite = state.favorites.has(String(a["アイテムID"] || ""));
      const bFavorite = state.favorites.has(String(b["アイテムID"] || ""));
      if (aFavorite !== bFavorite) return aFavorite ? -1 : 1;
      if (state.pickerFilters.sort === "atkDesc") return Number(b["基礎ATK"] || 0) - Number(a["基礎ATK"] || 0);
      if (state.pickerFilters.sort === "atkAsc") return Number(a["基礎ATK"] || 0) - Number(b["基礎ATK"] || 0);
      return String(a["名前"] || "").localeCompare(String(b["名前"] || ""), "ja");
    });

    document.querySelectorAll("[data-v12-tag]").forEach(button =>
      button.classList.toggle("is-active", button.dataset.v12Tag === state.pickerFilters.quickTag)
    );
    const count = document.getElementById("v12PickerCount");
    if (count) count.textContent = `${items.length}件`;

    const currentId = descriptor.get();
    pickerList.innerHTML =
      `<button class="picker-item is-none" type="button" data-picker-id="">
        <span><strong>未選択にする</strong><small>このスロットを解除</small></span><b>×</b>
      </button>` +
      (items.length ? items.slice(0, state.pickerVisibleCount).map(item => {
        const itemId = String(item["アイテムID"]);
        const attributeId = String(item["属性ID"] || "");
        const attributeName = context.attributeMap.get(attributeId)?.["属性名"] || attributeId;
        const basic = [
          !isBlank(item["基礎ATK"]) ? `ATK ${item["基礎ATK"]}` : "",
          !isBlank(item["基礎DEF"]) ? `DEF ${item["基礎DEF"]}` : "",
          item["武器種"] ? String(item["武器種"]) : "",
          attributeName ? `${attributeName}属性` : "",
          Number(item["スロット数"]) > 0 ? `Slot ${item["スロット数"]}` : ""
        ].filter(Boolean).join(" / ");
        const effects = fullEffectSummary(item, { includeConditions: true, separator: " / " });
        const description = [item["説明文"], item["特殊性能"]].filter(Boolean).map(formatFormulaText).join(" / ");
        const isFavorite = state.favorites.has(itemId);
        return `<article class="picker-card ${String(currentId) === itemId ? "is-current" : ""} ${isFavorite ? "is-favorite" : ""}">
          <button class="picker-card-favorite ${isFavorite ? "is-active" : ""}" type="button" data-picker-favorite="${escapeHtml(itemId)}" aria-label="${isFavorite ? "お気に入りから外す" : "お気に入りに追加"}" aria-pressed="${isFavorite ? "true" : "false"}" title="${isFavorite ? "お気に入りから外す" : "お気に入りに追加"}">${isFavorite ? "♥" : "♡"}</button>
          <button class="picker-card-select" type="button" data-picker-id="${escapeHtml(itemId)}">
            <span class="picker-card-head"><strong>${escapeHtml(item["名前"] || "名称未設定")}</strong><b>選択</b></span>
            ${basic ? `<span class="picker-card-basic">${escapeHtml(basic)}</span>` : ""}
            ${effects ? `<span class="picker-card-effects">${escapeHtml(effects)}</span>` : ""}
            ${description ? `<span class="picker-card-description">${escapeHtml(description)}</span>` : ""}
          </button>
          <button class="picker-card-detail" type="button" data-picker-detail="${escapeHtml(itemId)}">詳細を見る</button>
        </article>`;
      }).join("") + (state.pickerVisibleCount < items.length
        ? `<button class="button button-secondary iruna-load-more" type="button" data-picker-load-more>さらに表示（残り ${items.length - state.pickerVisibleCount}件）</button>`
        : "") : `<div class="state-card">条件に一致する装備がありません。フィルターを解除してください。</div>`);

    pickerList.querySelectorAll("[data-picker-id]").forEach(button =>
      button.addEventListener("click", () => {
        const selectedId = button.dataset.pickerId || null;
        descriptor.set(selectedId);
        closePicker();
        syncUrl(false);
        renderBuild();
      })
    );
    pickerList.querySelectorAll("[data-picker-favorite]").forEach(button =>
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const itemId = String(button.dataset.pickerFavorite || "");
        if (!itemId) return;
        if (state.favorites.has(itemId)) state.favorites.delete(itemId); else state.favorites.add(itemId);
        localStorage.setItem("irunadb.favorites", JSON.stringify([...state.favorites]));
        renderPicker();
        renderDatabase();
      })
    );
    pickerList.querySelector("[data-picker-load-more]")?.addEventListener("click", () => {
      state.pickerVisibleCount += 80;
      renderPicker();
    });
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
        refinement: key === "special" ? 0 : 9,
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
    return { build, status: { ...state.status }, skills: [...state.selectedSkills] };
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
      state.selectedSkills = new Set(Array.isArray(decoded?.skills) ? decoded.skills.map(String) : []);
      SLOT_DEFS.forEach(slot => {
        const id = decodedBuild?.[slot.key];
        state.build[slot.key] = id && context.itemsById.has(String(id)) ? String(id) : null;
      });
      EQUIPMENT_KEYS.forEach(key => {
        const savedSetting = decodedBuild?.equipmentSettings?.[key] || {};
        state.build.equipmentSettings[key] = {
          refinement: key === "special" ? 0 : 9,
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

      // v2.6.5の旧URL（15個のレリック枠）も可能な範囲で自動配置する
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
    let filtered = ui.filterItems(state.items, state.activeCategory, state.searchQuery, context.searchIndex);
    filtered = filtered.filter(item => {
      const weaponType = getDatabaseTypeValue(item);
      const attributeId = String(item["属性ID"] || "");
      const attributeName = context.attributeMap.get(attributeId)?.["属性名"] || attributeId;
      return (!state.databaseFilters.weaponType || weaponType === state.databaseFilters.weaponType)
        && (!state.databaseFilters.attribute || attributeName === state.databaseFilters.attribute || attributeId === state.databaseFilters.attribute)
        && (!state.databaseFilters.favoriteOnly || state.favorites.has(String(item["アイテムID"] || "")));
    });
    filtered.sort((a,b) => {
      // データベース検索でもお気に入りを常に先頭へ表示する。
      const aFavorite = state.favorites.has(String(a["アイテムID"] || ""));
      const bFavorite = state.favorites.has(String(b["アイテムID"] || ""));
      if (aFavorite !== bFavorite) return aFavorite ? -1 : 1;
      const sort = state.databaseFilters.sort;
      if (sort === "atkDesc") return Number(b["基礎ATK"]||0)-Number(a["基礎ATK"]||0);
      if (sort === "atkAsc") return Number(a["基礎ATK"]||0)-Number(b["基礎ATK"]||0);
      if (sort === "defDesc") return Number(b["基礎DEF"]||0)-Number(a["基礎DEF"]||0);
      if (sort === "defAsc") return Number(a["基礎DEF"]||0)-Number(b["基礎DEF"]||0);
      return String(a["名前"]||"").localeCompare(String(b["名前"]||""), "ja");
    });
    ui.renderItems(filtered, context, item => modal.open(item, context), state.favorites, toggleFavorite);
  }

  function updateDatabaseInfo(meta = {}) {
    const sourceNames = { static: "GitHub Pages（静的JSON）", all: "Apps Script（一括）", sequential: "Apps Script（互換）", cache: "ブラウザ保存データ" };
    const source = document.getElementById("dbSourceInfo");
    const version = document.getElementById("dbVersionInfo");
    const updated = document.getElementById("dbUpdatedInfo");
    if (source) source.textContent = sourceNames[meta.source] || meta.source || "-";
    if (version) version.textContent = meta.version || meta.dataVersion || "-";
    const rawDate = meta.generatedAt || meta.updatedAt || "";
    if (updated) {
      if (!rawDate) updated.textContent = "-";
      else {
        const date = new Date(rawDate);
        updated.textContent = Number.isNaN(date.getTime()) ? rawDate : date.toLocaleString("ja-JP");
      }
    }
  }

  function applyData(data, connectionText, meta = {}) {
    for (const [key, value] of Object.entries(data)) {
      if (!Array.isArray(value)) throw new Error(`${key}のデータ形式が正しくありません`);
    }
    Object.assign(state, data);
    mergeJobMaster();
    buildIndexes();
    initializeSkillData();
    populateDatabaseFilters();
    restoreBuildFromUrl();
    renderDatabase();
    renderStatus();
    renderBuild();
    ui.setConnectionStatus("online", connectionText);
    updateDatabaseInfo(meta);
  }

  const SAVED_BUILD_KEY = "irunadb.savedBuilds.v21";

  function readSavedBuilds() {
    try {
      const value = JSON.parse(localStorage.getItem(SAVED_BUILD_KEY) || "[]");
      const builds = Array.isArray(value) ? value : [];
      while (builds.length < 3) builds.push(null);
      return builds;
    } catch (error) {
      console.warn("保存ビルドを初期化しました", error);
      return [null, null, null];
    }
  }

  function writeSavedBuilds(builds) {
    localStorage.setItem(SAVED_BUILD_KEY, JSON.stringify(builds));
  }

  function renderSavedBuildSlots() {
    const container = document.getElementById("savedBuildSlots");
    if (!container) return;
    const saved = readSavedBuilds();
    container.innerHTML = saved.map((entry, index) => {
      const title = entry?.name || `保存枠 ${index + 1}`;
      const meta = entry?.savedAt ? new Date(entry.savedAt).toLocaleString("ja-JP") : "未保存";
      return `<article class="saved-build-slot ${entry ? "has-data" : ""}">
        <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(meta)}</small></div>
        <div class="saved-build-actions">
          <button type="button" class="button button-primary compact-button" data-save-build="${index}">保存</button>
          <button type="button" class="button button-secondary compact-button" data-load-build="${index}" ${entry ? "" : "disabled"}>読込</button>
          <button type="button" class="icon-button danger-icon" data-delete-build="${index}" ${entry || index >= 3 ? "" : "disabled"} aria-label="削除">×</button>
        </div>
      </article>`;
    }).join("");

    container.querySelectorAll("[data-save-build]").forEach(button => button.addEventListener("click", () => {
      const index = Number(button.dataset.saveBuild);
      const builds = readSavedBuilds();
      const input = document.getElementById("buildNameInput");
      const fallback = `ビルド ${index + 1}`;
      builds[index] = {
        name: String(input?.value || fallback).trim() || fallback,
        savedAt: new Date().toISOString(),
        build: JSON.parse(JSON.stringify(state.build)),
        status: JSON.parse(JSON.stringify(state.status)),
        skills: [...state.selectedSkills]
      };
      writeSavedBuilds(builds);
      renderSavedBuildSlots();
    }));
    container.querySelectorAll("[data-load-build]").forEach(button => button.addEventListener("click", () => {
      const entry = readSavedBuilds()[Number(button.dataset.loadBuild)];
      if (!entry) return;
      state.build = { ...createEmptyBuild(), ...entry.build };
      EQUIPMENT_KEYS.forEach(key => {
        state.build.equipmentSettings[key] = {
          ...(state.build.equipmentSettings[key] || {}),
          refinement: key === "special" ? 0 : 9,
          slots: Math.min(2, Math.max(0, Number(state.build.equipmentSettings[key]?.slots) || 0))
        };
      });
      state.status = { ...state.status, ...entry.status };
      state.selectedSkills = new Set(Array.isArray(entry.skills) ? entry.skills.map(String) : []);
      state.selectedRelicUid = null;
      const input = document.getElementById("buildNameInput");
      if (input) input.value = entry.name || "";
      renderStatus(); renderBuild(); syncUrl(false); setView("build");
    }));
    container.querySelectorAll("[data-delete-build]").forEach(button => button.addEventListener("click", () => {
      const index = Number(button.dataset.deleteBuild);
      const builds = readSavedBuilds();
      if (index < 3) builds[index] = null;
      else builds.splice(index, 1);
      while (builds.length < 3) builds.push(null);
      writeSavedBuilds(builds);
      renderSavedBuildSlots();
    }));
  }

  function setupV21Navigation() {
    document.querySelectorAll(".main-tab").forEach(tab => tab.addEventListener("click", () => setView(tab.dataset.view)));
    const addSlotButton = document.getElementById("addSavedBuildSlotButton");
    addSlotButton?.addEventListener("click", () => {
      const builds = readSavedBuilds();
      builds.push(null);
      writeSavedBuilds(builds);
      renderSavedBuildSlots();
    });
    renderSavedBuildSlots();
  }

  async function loadData(options = {}) {
    const force = options === true || options?.force === true;
    const cached = !force ? api.readCache() : null;
    let cacheShown = false;

    if (cached) {
      try {
        applyData(cached.data, "保存データ表示中", { ...(cached.meta || {}), source: "cache" });
        cacheShown = true;
      } catch (error) {
        console.warn("保存データの初期化に失敗したため破棄します", error);
        api.clearCache();
      }
    }

    if (!cacheShown) {
      ui.renderLoading();
      ui.setConnectionStatus("loading", "接続中");
    } else {
      ui.setConnectionStatus("loading", "最新データ確認中");
    }

    try {
      const result = await api.getInitialData();
      const connectionLabel = result.meta.source === "static"
        ? "GitHub静的DB"
        : result.meta.source === "all" ? "GAS一括取得" : "GAS互換取得";

      // v2.9.19: 起動時にキャッシュを描画済みで、取得したDBも同一なら二重描画しない。
      const cachedStamp = cached?.meta?.generatedAt || cached?.meta?.updatedAt || cached?.meta?.dataVersion || "";
      const resultStamp = result.meta?.generatedAt || result.meta?.updatedAt || result.meta?.dataVersion || "";
      const sameCachedData = cacheShown && cachedStamp && resultStamp && String(cachedStamp) === String(resultStamp);
      if (sameCachedData) {
        ui.setConnectionStatus("online", connectionLabel);
        updateDatabaseInfo(result.meta);
      } else {
        applyData(result.data, connectionLabel, result.meta);
      }
      api.writeCache(result.data, result.meta);
    } catch (error) {
      console.error("GAS API connection failed", error);
      if (cacheShown) {
        ui.setConnectionStatus("online", "オフライン・保存データ");
        return;
      }
      ui.setConnectionStatus("error", "接続エラー");
      ui.renderError(`${error.message}。保存データもないため表示できません。GASの公開設定または通信状態を確認してください。`);
      equipmentSlots.innerHTML = `<div class="state-card is-error">装備データを取得できませんでした。</div>`;
    }
  }

  document.getElementById("reloadButton").addEventListener("click", () => loadData({ force: true }));
  addRelicButton.addEventListener("click", () => openPicker("relic_new"));
  rotateRelicButton.addEventListener("click", rotateSelectedRelic);
  removeRelicButton.addEventListener("click", removeSelectedRelic);

  document.getElementById("resetBuildButton").addEventListener("click", () => {
    state.build = createEmptyBuild();
    state.selectedRelicUid = null;
    syncUrl(false);
    renderBuild();
  });
  document.getElementById("copyUrlButton").addEventListener("click", async () => {
      // 共有するのは現在表示中のビルドだけ。
      // 保存枠・お気に入り・テーマ等のlocalStorage情報は含めない。
      const shareUrl = new URL(location.href);
      const payload = compactBuild();
      const hasBuild = allSelectedIds().length > 0 ||
        EQUIPMENT_KEYS.some(key => Number(state.build.equipmentSettings[key]?.slots || 0) !== 0);
      const hasStatus = payload.status.jobId || payload.status.lv !== 1 ||
        ["str","int","vit","agi","dex","crt"].some(key => payload.status[key] !== 0);

      if (hasBuild || hasStatus || payload.skills.length) {
        shareUrl.searchParams.set("build", encodeBuild(payload));
      } else {
        shareUrl.searchParams.delete("build");
      }

      const shareText = shareUrl.toString();
      const message = document.getElementById("shareMessage");
      try {
        await navigator.clipboard.writeText(shareText);
        message.textContent = "現在表示中のビルドだけを共有URLにコピーしました。";
      } catch {
        window.prompt("このURLをコピーしてください", shareText);
        message.textContent = "現在表示中のビルドの共有URLを表示しました。";
      }
    });
  // v2.6.5: 共有処理修正時に消えていた選択画面の検索イベントを復元
  document.getElementById("clearUrlButton").addEventListener("click", () => {
    const url = new URL(location.href);
    url.searchParams.delete("build");
    history.replaceState({}, "", url);
    document.getElementById("shareMessage").textContent =
      "URLからビルド情報を削除しました。装備はそのままです。";
  });

  const renderPickerFromInput = debounce(value => {
    state.pickerQuery = value;
    state.pickerVisibleCount = 80;
    renderPicker();
  }, 120);
  pickerSearchInput.addEventListener("input", event => {
    renderPickerFromInput(event.target.value);
  });

  document.getElementById("pickerClearButton").addEventListener("click", () => {
    state.pickerQuery = "";
    state.pickerFilters = { weaponType: "", attribute: "", quickTag: "", sort: "name" };
    pickerSearchInput.value = "";
    renderPicker();
    pickerSearchInput.focus();
  });

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
    state.selectedSkills.clear();
    (context.skillsByJob.get(String(state.status.jobId)) || []).filter(skill => String(skill["選択方式"]||"")==="AUTO").forEach(skill => state.selectedSkills.add(String(skill["スキルID"])));
    syncUrl(false);
    renderBuild();
  });

  const renderBuildFromStatusInput = debounce(() => {
    syncUrl(false);
    renderBuild();
  }, 80);
  document.querySelectorAll("[data-status-key]").forEach(input => {
    input.addEventListener("input", event => {
      const key = event.target.dataset.statusKey;
      const minimum = key === "lv" ? 1 : 0;
      state.status[key] = Math.max(minimum, Number(event.target.value || minimum));
      renderBuildFromStatusInput();
    });
  });

  document.getElementById("resetStatusButton").addEventListener("click", () => {
    state.status = { jobId: "", lv: 1, str: 0, int: 0, vit: 0, agi: 0, dex: 0, crt: 0 };
    state.selectedSkills.clear();
    renderStatus();
    syncUrl(false);
    renderBuild();
  });

  if (toggleScreenshotSummary && screenshotSummaryBody) {
    toggleScreenshotSummary.addEventListener("click", () => {
      const willOpen = screenshotSummaryBody.hidden;
      screenshotSummaryBody.hidden = !willOpen;
      toggleScreenshotSummary.textContent = willOpen ? "閉じる" : "表示する";
      toggleScreenshotSummary.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) {
        renderScreenshotSummary();
        requestAnimationFrame(() => screenshotSummaryPanel?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    });
  }
  if (screenshotModeButton && screenshotSummaryBody) {
    screenshotModeButton.addEventListener("click", () => {
      const active = document.body.classList.toggle("screenshot-mode");
      screenshotSummaryBody.hidden = false;
      toggleScreenshotSummary.textContent = "閉じる";
      toggleScreenshotSummary.setAttribute("aria-expanded", "true");
      screenshotModeButton.textContent = active ? "通常表示へ戻る" : "スクショモード";
      renderScreenshotSummary();
      requestAnimationFrame(() => screenshotSummaryPanel?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  }

  setupV12Ui();
  setupV21Navigation();
  setupPanelCollapsibles();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("Service Worker registration failed", error));
  }

  loadData();
})();

document.addEventListener("DOMContentLoaded", () => {

  const appVersionLabel = document.getElementById("appVersionLabel");
  if (appVersionLabel) appVersionLabel.textContent = `Version ${APP_VERSION}`;

});


// v2.9.4 mobile collapsible main menu
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("mobileTabToggle");
  const tabs = document.getElementById("mainTabs");
  if (!toggle || !tabs) return;
  toggle.addEventListener("click", () => {
    const open = tabs.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "× 閉じる" : "☰ メニュー";
  });
  tabs.querySelectorAll(".main-tab").forEach(tab => tab.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 720px)").matches) {
      tabs.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "☰ メニュー";
    }
  }));
});
