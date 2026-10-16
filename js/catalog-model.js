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
    data.maps.forEach(r => { if (typeof r['マップ名'] !== 'string' || !r['マップ名'].trim()) throw new Error('マップ名が不正です'); });
    data.monsters.forEach(r => {
      if (typeof r['名前'] !== 'string' || !r['名前'].trim()) throw new Error('モンスター名が不正です');
      const min=r['Lv下限'],max=r['Lv上限'];
      if (!(min === '' && max === '') && (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min)) throw new Error('モンスターLvが不正です');
    });
    data.spawns.forEach(r => { ref(r,"モンスターID","monsters"); ref(r,"マップID","maps"); });
    data.drops.forEach(r => { ref(r,"モンスターID","monsters"); ref(r,"アイテムID","items"); if (r["ドロップ率(%)"] !== "" && (!Number.isFinite(r["ドロップ率(%)"]) || r["ドロップ率(%)"] < 0 || r["ドロップ率(%)"] > 100)) throw new Error("ドロップ率が不正です"); });
    return data;
  }
  const defaults = () => ({levels:Object.fromEntries(fields.map(f => [f,0])), favorites:[]});
  function mergeLocations(base, extra) {
    if (!extra) return base;
    if (extra.schemaVersion !== 1) throw new Error("入手先データの形式が未対応です");
    const keys={items:"アイテムID",maps:"マップID",monsters:"モンスターID",spawns:"出現ID",drops:"ドロップID"};
    const next={...base,updatedAt:extra.updatedAt || base.updatedAt};
    for(const [table,key] of Object.entries(keys)) {
      if(!Array.isArray(extra[table]))throw new Error(`${table}の補足データが不正です`);
      const rows=new Map(base[table].map(r=>[r[key],r]));
      const updates=extra.updates?.[table] || [];
      if(!Array.isArray(updates))throw new Error("入手先の更新形式が不正です");
      if(updates.length && !['maps','monsters','drops'].includes(table))throw new Error('この種類の入手先更新はできません');
      const updated=new Set();
      for(const row of updates){
        if(!rows.has(row[key]) || updated.has(row[key]))throw new Error("入手先の更新IDが不正です");
        const old=rows.get(row[key]);
        if(table==='drops' && Object.keys(row).some(field=>!['出典ID','出典URL','確認日','確認状態','備考'].includes(field)&&row[field]!==old[field]))throw new Error('ドロップの照合では参照先・条件・確率を置換できません');
        if((table==='maps'&&old['マップ名']!==row['マップ名'])||(table==='monsters'&&old['名前']!==row['名前']))throw new Error("別の場所・モンスターへの置換はできません");
        rows.set(row[key],{...old,...row});updated.add(row[key]);
      }
      for(const row of extra[table]){if(rows.has(row[key]))throw new Error("入手先の補足IDが重複しています");rows.set(row[key],row);}
      next[table]=[...rows.values()];
    }
    return validate(next);
  }
  const requiredLevels = recipe => JSON.parse(recipe["他必要Lv"] || "{}");
  const canCraft = (recipe, settings) => !String(recipe["確認状態"] || "").startsWith("要確認") && recipe["レシピLv"] <= settings.levels[recipe["生産分野"]] + 10 && Object.entries(requiredLevels(recipe)).every(([f,n]) => settings.levels[f] >= n);
  function moveFavorite(list, id, offset) {
    const next = [...list], index = next.indexOf(id), target = index + offset;
    if (index < 0 || target < 0 || target >= next.length) return next;
    [next[index],next[target]] = [next[target],next[index]]; return next;
  }
  const api = {fields,key,normalize,validate,mergeLocations,defaults,requiredLevels,canCraft,moveFavorite};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.IrunaCatalogModel = api;
})();
