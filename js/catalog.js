"use strict";
(() => {
  const model = window.IrunaCatalogModel, env = window.IrunaEnvironment;
  const $ = id => document.getElementById(id), esc = window.IrunaUtils.escapeHtml;
  const message = text => { $("craftMessage").textContent = text; };
  let data, settings = model.defaults();
  try {
    data = model.validate(window.IRUNA_CATALOG_DATA);
    const saved = localStorage.getItem(model.key);
    if (saved !== null) { env.validateValue(model.key,saved); settings = JSON.parse(saved); }
  } catch (e) {
    if (!data) { $("craftList").textContent = $("dropList").textContent = `データを読み込めませんでした：${e.message}`; return; }
    message(`保存設定を読み込めませんでした。元データは保持しています：${e.message}`);
  }
  const items = new Map(data.items.map(r => [r["アイテムID"],r]));
  const monsters = new Map(data.monsters.map(r => [r["モンスターID"],r]));
  const maps = new Map(data.maps.map(r => [r["マップID"],r]));
  const name = id => items.get(id)?.["名前"] || id;
  const active = row => row["有効"] !== false && String(row["有効"]).toUpperCase() !== "FALSE";
  const materialRows = id => data.materials.filter(r => active(r) && r["レシピID"] === id).sort((a,b) => a["表示順"]-b["表示順"]);
  const resultRows = id => data.results.filter(r => active(r) && r["レシピID"] === id);
  const button = (attr,id,text) => `<button type="button" class="catalog-link" ${attr}="${esc(id)}">${esc(text)}</button>`;
  function source(row) {
    return `<p class="catalog-source">確認日：${esc(row["確認日"])} · ${esc(row["確認状態"])}</p>`;
  }
  const publicNote = value => esc(String(value || "").replace(/https?:\/\/\S+/g, "").trim());
  function save(next) {
    try { env.validateValue(model.key,JSON.stringify(next)); localStorage.setItem(model.key,JSON.stringify(next)); settings = next; renderCraft(); message("生産設定を保存しました。"); return true; }
    catch (e) { message(`保存できませんでした：${e.message}`); return false; }
  }
  function renderCraft() {
    const q = model.normalize($("craftSearch").value), field = $("craftField").value;
    let rows = data.recipes.filter(active).filter(r => (!field || r["生産分野"] === field) &&
      (!$("craftOnlyPossible").checked || model.canCraft(r,settings)) &&
      (!$("craftOnlyFavorite").checked || settings.favorites.includes(r["レシピID"])) &&
      model.normalize([r["レシピ名"],r["生産分野"],...materialRows(r["レシピID"]).map(m => name(m["素材アイテムID"])),...resultRows(r["レシピID"]).map(m => name(m["完成アイテムID"]))].join(" ")).includes(q));
    if ($("craftOnlyFavorite").checked) rows.sort((a,b) => settings.favorites.indexOf(a["レシピID"])-settings.favorites.indexOf(b["レシピID"]));
    $("craftCount").textContent = `${rows.length}件 / 登録${data.recipes.filter(active).length}件`;
    $("craftList").innerHTML = rows.map(r => {
      const id = r["レシピID"], favorite = settings.favorites.includes(id), index = settings.favorites.indexOf(id);
      return `<article class="catalog-card" data-recipe-card="${esc(id)}"><h3>${esc(r["レシピ名"])}</h3>
      <p>${esc(r["生産分野"])} Lv${r["レシピLv"]} · ${model.canCraft(r,settings)?"Lv条件を満たしています":"Lv不足"}</p>
      <p class="catalog-note">必要道具：${esc(r["必要道具"]||"未確認")}。道具などの追加条件も確認してください。</p>
      <div class="catalog-actions"><button type="button" class="button button-secondary" data-favorite="${esc(id)}" aria-pressed="${favorite}">${favorite?"★ お気に入り解除":"☆ お気に入り登録"}</button>
      ${favorite && $("craftOnlyFavorite").checked?`<button type="button" class="button button-secondary" data-move="${esc(id)}" data-offset="-1" ${index===0?"disabled":""}>↑ 上へ</button><button type="button" class="button button-secondary" data-move="${esc(id)}" data-offset="1" ${index===settings.favorites.length-1?"disabled":""}>↓ 下へ</button>`:""}</div>
      <h4>必要素材</h4><ul>${materialRows(id).map(m => `<li>${button("data-item",m["素材アイテムID"],name(m["素材アイテムID"]))} ×${m["必要個数"]} · ${button("data-drop-item",m["素材アイテムID"],"入手先")}</li>`).join("")}</ul>
      <h4>完成品</h4><ul>${resultRows(id).map(m => `<li>${esc(m["結果区分"])}：${button("data-item",m["完成アイテムID"],name(m["完成アイテムID"]))} ×${m["完成個数"]}</li>`).join("")}</ul>
      ${source(r)}</article>`;
    }).join("") || '<p class="catalog-empty">条件に合うレシピがありません。検索・絞り込みを変更してください。</p>';
  }
  function renderDrops() {
    const q = model.normalize($("dropSearch").value);
    const rows = data.drops.filter(active).filter(r => {
      const mob = monsters.get(r["モンスターID"]);
      const locations = data.spawns.filter(s => active(s) && s["モンスターID"]===r["モンスターID"]).map(s => maps.get(s["マップID"])?.["マップ名"]);
      return model.normalize([name(r["アイテムID"]),mob["名前"],...locations].join(" ")).includes(q);
    });
    $("dropList").innerHTML = rows.map(r => {
      const mob = monsters.get(r["モンスターID"]);
      const spawns = data.spawns.filter(s => active(s) && s["モンスターID"]===r["モンスターID"]);
      const lv = mob["Lv下限"] === "" ? "Lv未確認" : `Lv${mob["Lv下限"]}${mob["Lv上限"]!==mob["Lv下限"]?"～"+mob["Lv上限"]:""}`;
      return `<article class="catalog-card"><h3>${button("data-item",r["アイテムID"],name(r["アイテムID"]))}</h3><p><strong>${esc(mob["名前"])}</strong> ${esc(lv)}</p>
      <p>${spawns.map(s => esc(maps.get(s["マップID"])?.["マップ名"]||"未確認")).join(" / ")}</p>
      <p>ドロップ枠：${esc(r["ドロップ枠"]||"未確認")} · 確率：${r["ドロップ率(%)"]===""?"未確認":esc(r["ドロップ率(%)"])+"%"}</p>
      ${source(r)}<p class="catalog-note">${publicNote(mob["備考"])} ${publicNote(r["備考"])}</p></article>`;
    }).join("") || '<p class="catalog-empty">一致するドロップ情報は未登録です。</p>';
    const purchases = data.items.filter(r => r["入手区分"] === "購入" && model.normalize([r["名前"],r["入手先"],r["マップ"]].join(" ")).includes(q));
    if (purchases.length) $("dropList").innerHTML += purchases.map(r => `<article class="catalog-card"><h3>${button("data-item",r["アイテムID"],r["名前"])}</h3><p>購入：${esc(r["入手先"])} / ${esc(r["マップ"])}</p><p class="catalog-note">ドロップ以外の入手先です。価格は未確認です。</p></article>`).join("");
    const crafted = data.recipes.filter(active).filter(r => resultRows(r["レシピID"]).some(out => model.normalize(name(out["完成アイテムID"])).includes(q)));
    if (q && crafted.length) $("dropList").innerHTML += crafted.map(r => `<article class="catalog-card"><h3>生産で入手</h3>${button("data-recipe",r["レシピID"],r["レシピ名"])}</article>`).join("");
    $("dropCount").textContent = `ドロップ${rows.length}件 / 登録${data.drops.filter(active).length}件`;
  }
  const show = view => window.IrunaCatalogBridge.show(view);
  function navigateDrop(id) { window.IrunaModal.close(); $("dropSearch").value=name(id); renderDrops(); show("drops"); }
  function navigateRecipe(id) {
    const r = data.recipes.find(x => x["レシピID"]===id); if (!r) return;
    window.IrunaModal.close(); $("craftSearch").value=r["レシピ名"]; $("craftField").value="";
    $("craftOnlyPossible").checked=$("craftOnlyFavorite").checked=false; renderCraft(); show("craft");
  }
  document.addEventListener("click", event => {
    const b = event.target.closest("[data-favorite],[data-move],[data-item],[data-drop-item],[data-recipe]");
    if (!b) return;
    if (b.dataset.favorite) {
      const favorites = settings.favorites.includes(b.dataset.favorite)?settings.favorites.filter(x => x!==b.dataset.favorite):[...settings.favorites,b.dataset.favorite];
      save({...settings,favorites});
    } else if (b.dataset.move) save({...settings,favorites:model.moveFavorite(settings.favorites,b.dataset.move,Number(b.dataset.offset))});
    else if (b.dataset.item) {
      if (!window.IrunaCatalogBridge?.openItem(b.dataset.item)) message("DBの読み込み完了後に詳細を開いてください。");
    } else if (b.dataset.dropItem) navigateDrop(b.dataset.dropItem);
    else navigateRecipe(b.dataset.recipe);
  });
  $("craftLevels").innerHTML=model.fields.map(f => `<label>${esc(f)} Lv<input type="number" min="0" max="999" step="1" data-craft-level="${esc(f)}" value="${settings.levels[f]}"></label>`).join("");
  $("craftLevels").addEventListener("change",event => {
    const field=event.target.dataset.craftLevel; if (!field) return;
    const n=Number(event.target.value);
    if(event.target.value==="" || !Number.isInteger(n) || n<0 || n>999) {event.target.value=settings.levels[field];message("生産Lvは0～999の整数で入力してください。");return;}
    if(!save({...settings,levels:{...settings.levels,[field]:n}}))event.target.value=settings.levels[field];
  });
  ["craftSearch","craftField","craftOnlyPossible","craftOnlyFavorite"].forEach(id => $(id).addEventListener("input",renderCraft));
  $("dropSearch").addEventListener("input",renderDrops);
  window.IrunaCatalog = {decorateModal(item) {
    const id=item["アイテムID"], uses=data.materials.filter(m => active(m) && m["素材アイテムID"]===id);
    const outputs=data.results.filter(m => active(m) && m["完成アイテムID"]===id);
    if(!items.has(id)&&!uses.length&&!outputs.length)return;
    const panel=document.createElement("section");panel.className="catalog-modal-links";
    panel.innerHTML=`<h3>入手先・生産</h3>${button("data-drop-item",id,"入手先を調べる")}<ul>${[...new Set([...uses,...outputs].map(m=>m["レシピID"]))].map(r => `<li>${button("data-recipe",r,data.recipes.find(x=>x["レシピID"]===r)["レシピ名"])}</li>`).join("")}</ul>`;
    $("modalEffectArea").appendChild(panel);
  }};
  $("catalogUpdated").textContent=`登録データ確認日：${data.updatedAt}（自動更新ではありません）`;
  renderCraft(); renderDrops();
})();
