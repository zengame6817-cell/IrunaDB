"use strict";
(() => {
  const fields = ["鍛冶", "木工", "裁縫", "彫金", "錬金術", "調理"];
  const key = "irunadb.craft.user.v1";
  const normalize = value => String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s/g, "");
  function validate(data) {
    if (data?.schemaVersion !== 1) throw new Error("生産データの形式が未対応です");
    const ids = {};
    const idKeys = {items:"アイテムID", maps:"マップID", monsters:"モンスターID", spawns:"出現ID", drops:"ドロップID", recipes:"レシピID", materials:"素材行ID", results:"完成品行ID"};
    for (const [table, idKey] of Object.entries(idKeys)) {
      if (!Array.isArray(data[table])) throw new Error(`${table}がありません`);
      ids[table] = new Set();
      for (const row of data[table]) {
        if (typeof row[idKey] !== "string" || !row[idKey] || ids[table].has(row[idKey])) throw new Error(`${table}のIDが不正または重複しています`);
        ids[table].add(row[idKey]);
      }
    }
    const ref = (row, field, table) => { if (!ids[table].has(row[field])) throw new Error(`${field}の参照先がありません`); };
    const count = n => { if (!Number.isInteger(n) || n < 1) throw new Error("個数が不正です"); };
    data.recipes.forEach(r => {
      if (!fields.includes(r["生産分野"]) || !Number.isInteger(r["レシピLv"]) || r["レシピLv"] < 0) throw new Error("生産Lvが不正です");
      const requirements = requiredLevels(r);
      if (!requirements || typeof requirements !== "object" || Array.isArray(requirements) || Object.entries(requirements).some(([f,n]) => !fields.includes(f) || !Number.isInteger(n) || n < 0)) throw new Error("他必要Lvが不正です");
    });
    data.materials.forEach(r => { ref(r,"レシピID","recipes"); ref(r,"素材アイテムID","items"); count(r["必要個数"]); });
    data.results.forEach(r => { ref(r,"レシピID","recipes"); ref(r,"完成アイテムID","items"); count(r["完成個数"]); if (!["通常","大成功A","大成功B","強化"].includes(r["結果区分"])) throw new Error("完成品区分が不正です"); });
    data.spawns.forEach(r => { ref(r,"モンスターID","monsters"); ref(r,"マップID","maps"); });
    data.drops.forEach(r => { ref(r,"モンスターID","monsters"); ref(r,"アイテムID","items"); if (r["ドロップ率(%)"] !== "" && (!Number.isFinite(r["ドロップ率(%)"]) || r["ドロップ率(%)"] < 0 || r["ドロップ率(%)"] > 100)) throw new Error("ドロップ率が不正です"); });
    return data;
  }
  const defaults = () => ({levels:Object.fromEntries(fields.map(f => [f,0])), favorites:[]});
  const requiredLevels = recipe => JSON.parse(recipe["他必要Lv"] || "{}");
  const canCraft = (recipe, settings) => !String(recipe["確認状態"] || "").startsWith("要確認") && recipe["レシピLv"] <= settings.levels[recipe["生産分野"]] + 10 && Object.entries(requiredLevels(recipe)).every(([f,n]) => settings.levels[f] >= n);
  function moveFavorite(list, id, offset) {
    const next = [...list], index = next.indexOf(id), target = index + offset;
    if (index < 0 || target < 0 || target >= next.length) return next;
    [next[index],next[target]] = [next[target],next[index]]; return next;
  }
  const api = {fields,key,normalize,validate,defaults,requiredLevels,canCraft,moveFavorite};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.IrunaCatalogModel = api;
})();
