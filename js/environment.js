"use strict";
// Explicit allowlist: never export caches, credentials, migration flags or backups.
window.IrunaEnvironment = (() => {
  const DRAFT = "irunadb.environment.current.v1";
  const BACKUP = "irunadb.environment.backup.v1";
  const BUILDS = "irunadb.savedBuilds.v21", RG = "irunadb.savedRgSlots.v1";
  const fixed = new Set([BUILDS, RG, "irunadb.rg.workspace.v1", "irunadb.favorites",
    "irunadb.relic.customPatterns.v1", "irunadb.rg.onboardingSeen.v1", "irunadb.theme.v2",
    "irunadb_mission_done_v1", "irunadb_mission_owned_v1", "irunadb_skillquest_done_v1", DRAFT]);
  const isAllowed = key => fixed.has(key) || /^irunadb\.panel\.[^\r\n]{1,100}\.collapsed$/.test(key) ||
    /^irunadb\.equipment-card\.(weapon|body|additional|special|decoration)\.collapsed$/.test(key) ||
    /^irunadb\.v12\.collapse\.[\w-]{1,60}$/.test(key);
  const plain = v => v !== null && typeof v === "object" && !Array.isArray(v);
  const assert = (ok, label) => { if (!ok) throw new Error(`データ形式が不正です：${label}`); };
  const clone = v => JSON.parse(JSON.stringify(v));
  const arr = (v, max, label) => assert(Array.isArray(v) && v.length <= max, label);
  const id = v => typeof v === "string" && v.length <= 500;
  function safeTree(v, depth = 0) {
    assert(depth < 30, "階層数");
    if (typeof v === "number") assert(Number.isFinite(v), "数値");
    if (typeof v === "string") assert(v.length <= 100000, "文字列長");
    if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => {
      assert(!["__proto__", "prototype", "constructor"].includes(k), "予約キー"); safeTree(x, depth + 1);
    });
  }
  const slots = ["weapon", "body", "additional", "special", "decoration"];
  function board(v, blocked = true) {
    assert(plain(v) && ["none", "physical", "magic"].includes(v.mode), "レリック盤面");
    ["red", "yellow", "white", "blue", "green", "black"].forEach(k => assert(Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 49, k));
    if (blocked) { arr(v.blocked, 49, "使用不可マス"); assert(v.blocked.length === 49 && v.blocked.every(x => typeof x === "boolean"), "使用不可マス"); }
  }
  function placements(v) {
    arr(v, 15, "レリック候補");
    v.forEach(p => {
      assert(plain(p) && id(p.itemId) && p.itemId.length > 0, "レリックID");
      ["x", "y"].forEach(k => assert(Number.isInteger(p[k]) && p[k] >= -100 && p[k] <= 6, "配置位置"));
      assert(Number.isInteger(p.rotation) && p.rotation >= 0 && p.rotation <= 3, "回転");
      assert(p.enabled === undefined || typeof p.enabled === "boolean", "有効状態");
      assert(p.patternIndex === undefined || (Number.isInteger(p.patternIndex) && p.patternIndex >= 0 && p.patternIndex <= 10000), "形状候補");
      assert(p.color === undefined || ["", "red", "yellow", "white", "blue", "green", "black"].includes(p.color), "色");
      assert(p.uid === undefined || id(p.uid), "候補識別子");
    });
  }
  function workspace(v) { assert(plain(v), "RG作業内容"); board(v.relicBoard); placements(v.relicPlacements); }
  function build(v) {
    assert(plain(v), "ビルド");
    slots.forEach(k => {
      assert(v[k] === undefined || v[k] === null || id(v[k]), "装備ID");
      assert(plain(v.crystals) && plain(v.stars) && plain(v.equipmentSettings), "装備設定");
      arr(v.crystals[k], 2, "クリスタ"); assert(v.crystals[k].length === 2 && v.crystals[k].every(x => x === null || id(x)), "クリスタID");
      assert(v.stars[k] === null || id(v.stars[k]), "星能力ID");
      const s = v.equipmentSettings[k];
      assert(plain(s) && Number.isInteger(s.slots) && s.slots >= 0 && s.slots <= 2 && Number.isFinite(s.refinement) && s.refinement >= 0 && s.refinement <= 9, "スロット数・精錬");
    });
    arr(v.alCrystas, 5, "アルクリスタ"); assert(v.alCrystas.length === 5 && v.alCrystas.every(x => x === null || id(x)), "アルクリスタID");
    if (v.buildRelics !== undefined) { arr(v.buildRelics, 15, "ビルドレリック"); assert(v.buildRelics.every(id), "レリックID"); }
    workspace(v); if (v.relicBoardBonus !== undefined) board(v.relicBoardBonus, false);
  }
  function current(v) {
    assert(plain(v), "編集中ビルド"); build(v.build);
    assert(plain(v.status) && id(v.status.jobId), "ステータス");
    Object.entries(v.status).forEach(([k, x]) => { if (k !== "jobId") assert(Number.isFinite(x) && x >= 0 && x <= 100000, "ステータス数値"); });
    arr(v.skills, 2000, "スキル"); assert(v.skills.every(id), "スキルID");
    if (v.candidates !== undefined) {
      arr(v.candidates, 100, "配置候補一覧");
      v.candidates.forEach(list => { arr(list, 15, "配置候補"); list.forEach(p => assert(plain(p) && id(p.uid) && Number.isInteger(p.x) && p.x >= 0 && p.x <= 6 && Number.isInteger(p.y) && p.y >= 0 && p.y <= 6 && Number.isInteger(p.rotation) && p.rotation >= 0 && p.rotation <= 3, "配置候補位置")); });
      assert(Number.isInteger(v.candidateIndex) && v.candidateIndex >= 0 && v.candidateIndex < Math.max(1, v.candidates.length), "配置候補番号");
    }
    ["buildName", "rgName"].forEach(k => assert(v[k] === undefined || id(v[k]), "編集中の名前"));
  }
  function validateValue(key, raw) {
    assert(typeof raw === "string", key);
    if (key === "irunadb.theme.v2") { assert(["light", "dark"].includes(raw), key); return; }
    if (key === "irunadb.rg.onboardingSeen.v1") { assert(raw === "1", key); return; }
    if (key.includes(".collapsed")) { assert(["true", "false"].includes(raw), key); return; }
    if (key.startsWith("irunadb.v12.collapse.")) { assert(["open", "closed"].includes(raw), key); return; }
    const v = JSON.parse(raw); safeTree(v);
    if (key === BUILDS || key === RG) {
      arr(v, 10000, key); v.forEach(e => {
        if (e === null) return;
        assert(plain(e) && id(e.name) && typeof e.savedAt === "string" && Number.isFinite(Date.parse(e.savedAt)), "保存枠");
        if (key === BUILDS) current(e); else workspace(e.workspace);
      });
    } else if (key === DRAFT) current(v);
    else if (key === "irunadb.rg.workspace.v1") workspace(v);
    else if (key === "irunadb.relic.customPatterns.v1") {
      assert(plain(v), "ローカル形状"); Object.entries(v).forEach(([k, cells]) => {
        assert(id(k), "形状ID"); arr(cells, 49, "形状セル"); cells.forEach(c => assert(Array.isArray(c) && c.length === 2 && c.every(x => Number.isInteger(x) && x >= 0 && x <= 6), "形状座標"));
      });
    } else { arr(v, 100000, key); assert(v.every(x => id(x) || (typeof x === "number" && Number.isFinite(x))), key); }
  }
  function validate(file) {
    safeTree(file);
    assert(plain(file) && file.format === "IrunaDB-environment" && file.schemaVersion === 1, "スキーマバージョン");
    assert(typeof file.createdAt === "string" && Number.isFinite(Date.parse(file.createdAt)) && /^\d+\.\d+\.\d+$/.test(file.appVersion), "作成日時・アプリバージョン");
    assert(plain(file.storage) && Object.keys(file.storage).length <= 1000, "保存データ");
    assert(Object.hasOwn(file.storage, DRAFT), "編集中のビルドがありません");
    Object.entries(file.storage).forEach(([k, v]) => { assert(isAllowed(k), `対象外キー ${k}`); validateValue(k, v); });
    return clone(file);
  }
  function capture(storage = localStorage) {
    const result = {};
    for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (isAllowed(k)) result[k] = storage.getItem(k); }
    return result;
  }
  function exportFile(live, storage = localStorage) {
    const data = capture(storage); data[DRAFT] = JSON.stringify(live);
    return validate({ format: "IrunaDB-environment", schemaVersion: 1, createdAt: new Date().toISOString(), appVersion: window.IRUNA_CONFIG.APP_VERSION, storage: data });
  }
  function mergeSlots(oldRaw, newRaw) {
    const old = oldRaw === undefined ? [] : JSON.parse(oldRaw), incoming = JSON.parse(newRaw);
    const names = new Set(old.filter(Boolean).map(x => x.name));
    incoming.filter(Boolean).forEach(entry => {
      const e = clone(entry), base = e.name || "取り込み"; let n = 2; e.name = base;
      while (names.has(e.name)) e.name = `${base} (${n++})`;
      names.add(e.name); old.push(e);
    });
    return JSON.stringify(old);
  }
  function plan(file, storage = localStorage) {
    const valid = validate(file), before = capture(storage), next = { ...before, ...valid.storage };
    [BUILDS, RG].forEach(k => { if (valid.storage[k] !== undefined) { if (before[k] !== undefined) validateValue(k, before[k]); next[k] = mergeSlots(before[k], valid.storage[k]); validateValue(k, next[k]); } });
    return { before, next };
  }
  function replace(values, storage) {
    // Remove only managed keys absent from the snapshot (e.g. a newly imported draft on rollback).
    Object.keys(capture(storage)).forEach(k => { if (!Object.hasOwn(values, k)) storage.removeItem(k); });
    Object.entries(values).forEach(([k, v]) => storage.setItem(k, v));
  }
  function revert(values, storage) {
    // Free the changed values first so a quota failure can be rolled back.
    Object.keys(capture(storage)).forEach(k => storage.removeItem(k)); replace(values, storage);
  }
  function commit(file, live, storage = localStorage) {
    const { before, next } = plan(file, storage);
    const oldBackup = storage.getItem(BACKUP);
    const backup = { schemaVersion: 1, phase: "pending", createdAt: new Date().toISOString(), storage: before, current: clone(live) };
    current(backup.current); safeTree(backup);
    storage.setItem(BACKUP, JSON.stringify(backup)); // No writes unless backup succeeded.
    try {
      replace(next, storage);
      backup.phase = "complete"; storage.setItem(BACKUP, JSON.stringify(backup));
    } catch (error) {
      storage.removeItem(BACKUP);
      revert(before, storage);
      if (oldBackup !== null) storage.setItem(BACKUP, oldBackup);
      throw error;
    }
  }
  function readBackup(storage = localStorage) {
    const raw = storage.getItem(BACKUP); if (!raw) return null;
    const b = JSON.parse(raw); safeTree(b);
    assert(plain(b) && b.schemaVersion === 1 && ["pending", "complete"].includes(b.phase) && plain(b.storage), "バックアップ");
    Object.entries(b.storage).forEach(([k,v]) => assert(isAllowed(k) && typeof v === "string", "バックアップキー")); current(b.current);
    return b;
  }
  function rollback(storage = localStorage) {
    const b = readBackup(storage); assert(b, "バックアップがありません");
    const original = capture(storage), next = { ...b.storage, [DRAFT]: JSON.stringify(b.current) };
    try { revert(next, storage); } catch (error) { revert(original, storage); throw error; }
    storage.removeItem(BACKUP);
  }
  // Runs before app/theme/mission initialization; recover interrupted multi-key imports.
  let recoveryError = null;
  try { const b = readBackup(); if (b?.phase === "pending") { rollback(); } } catch (e) { recoveryError = e; }
  return { DRAFT, BACKUP, isAllowed, capture, validate, validateValue, exportFile, plan, commit, rollback, readBackup, current, recoveryError };
})();
