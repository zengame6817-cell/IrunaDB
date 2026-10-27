"use strict";
(() => {
  const model = window.IrunaCatalogModel, env = window.IrunaEnvironment;
  const $ = id => document.getElementById(id), esc = window.IrunaUtils.escapeHtml;
  const message = text => { $("craftMessage").textContent = text; };
  let data, settings = model.defaults();
  try {
    data = model.validate(model.mergeLocations(window.IRUNA_CATALOG_DATA,window.IRUNA_LOCATION_DATA));
    if(window.IrunaWikiData)data=window.IrunaWikiData.mergeCatalog(data);
    data=window.IrunaMonsterAttributes.apply(data);
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
  const group = rows => {
    const map = new Map();
    for (const r of rows.filter(active)) {
      const id = r["レシピID"];
      if (!map.has(id)) map.set(id,[]);
      map.get(id).push(r);
    }
    return map;
  };
  const materialsByRecipe = group(data.materials), resultsByRecipe = group(data.results);
  for (const rows of materialsByRecipe.values()) rows.sort((a,b) => a["表示順"]-b["表示順"]);
  const materialRows = id => materialsByRecipe.get(id) || [];
  const resultRows = id => resultsByRecipe.get(id) || [];
  const recipeSearch = new Map(data.recipes.map(r => [r["レシピID"],model.normalize([r["レシピ名"],r["生産分野"],...materialRows(r["レシピID"]).map(m => name(m["素材アイテムID"])),...resultRows(r["レシピID"]).map(m => name(m["完成アイテムID"]))].join(" "))]));
  const itemFilters = window.IrunaItemFilters;
  itemFilters.populate($("craftEffect"));
  const outputItems = id => resultRows(id).map(r=>items.get(r["完成アイテムID"])).filter(Boolean);
  let visibleRecipes = 50;
  const button = (attr,id,text) => `<button type="button" class="catalog-link" ${attr}="${esc(id)}">${esc(text)}</button>`;
  const publicNote = value => esc(String(value || "").replace(/https?:\/\/\S+/g, "").replace(/対象装備の品質強化。別アイテムへの進化ではありません。個別ATK・DEF上限は未登録。|大?成功の未記載区分は未登録。ゲーム内の最新仕様は未検証。/g, "").trim());
  function save(next) {
    try { env.validateValue(model.key,JSON.stringify(next)); localStorage.setItem(model.key,JSON.stringify(next)); settings = next; renderCraft(false); message("生産設定を保存しました。"); return true; }
    catch (e) { message(`保存できませんでした：${e.message}`); return false; }
  }
  function renderCraft(reset = true) {
    if (reset) visibleRecipes = 50;
    const q = model.normalize($("craftSearch").value), field = $("craftField").value;
    const itemType = $("craftItemType").value, kind = $("craftKind").value, effect = $("craftEffect").value, effectQuery = $("craftEffectSearch").value;
    const min = $("craftMinLevel").value === "" ? 0 : Number($("craftMinLevel").value), max = $("craftMaxLevel").value === "" ? 999 : Number($("craftMaxLevel").value);
    const validRange = Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max <= 999 && min <= max;
    $("craftSort").disabled = $("craftOnlyFavorite").checked;
    $("craftFilterHint").textContent = !validRange ? "Lv範囲は0～999の整数で、下限≦上限にしてください。" : $("craftOnlyFavorite").checked ? "お気に入りだけ表示中は、自分で並べた順番を優先します。" : "完成品の区分・効能は大成功の完成品も対象です。効能の記載がないものは推測せず区別しています。";
    let rows = data.recipes.filter(active).filter(r => (!field || r["生産分野"] === field) &&
      validRange && r["レシピLv"] >= min && r["レシピLv"] <= max && (!kind || r["生産種別"] === kind) &&
      ((!itemType && !effect && !effectQuery.trim()) || outputItems(r["レシピID"]).some(item => (!itemType || itemFilters.kind(item) === itemType) && itemFilters.matches(item,effect,effectQuery))) &&
      (!$("craftOnlyPossible").checked || model.canCraft(r,settings)) &&
      (!$("craftOnlyFavorite").checked || settings.favorites.includes(r["レシピID"])) &&
      recipeSearch.get(r["レシピID"]).includes(q));
    if ($("craftOnlyFavorite").checked) rows.sort((a,b) => settings.favorites.indexOf(a["レシピID"])-settings.favorites.indexOf(b["レシピID"]));
    else {
      const sort = $("craftSort").value;
      rows.sort((a,b) => {
        const byLevel = a["レシピLv"]-b["レシピLv"], byField = model.fields.indexOf(a["生産分野"])-model.fields.indexOf(b["生産分野"]), byName = a["レシピ名"].localeCompare(b["レシピ名"],"ja",{numeric:true});
        if(sort === "name") return byName || byLevel;
        if(sort === "field") return byField || byLevel || byName;
        return (sort === "levelDesc" ? -byLevel : byLevel) || byField || byName;
      });
    }
    const shown = Math.min(rows.length,visibleRecipes);
    $("craftCount").textContent = `該当${rows.length}件 / 登録${data.recipes.filter(active).length}件 · ${shown}件を表示中（検索・絞り込みは全件が対象です）`;
    $("craftList").innerHTML = rows.slice(0,visibleRecipes).map(r => {
      const id = r["レシピID"], favorite = settings.favorites.includes(id), index = settings.favorites.indexOf(id);
      return `<article class="catalog-card" data-recipe-card="${esc(id)}"><h3>${esc(r["レシピ名"])}</h3>
      <p>${esc(r["生産分野"])} Lv${r["レシピLv"]} · ${String(r["確認状態"]||"").startsWith("要確認")?"詳細未確認":model.canCraft(r,settings)?"Lv条件を満たしています":"Lv不足"}</p>
      <p class="catalog-note">${esc(r["生産種別"] || "作成")}${Object.keys(model.requiredLevels(r)).length ? " · 他必要Lv：" + Object.entries(model.requiredLevels(r)).map(([f,n]) => `${esc(f)} Lv${n}`).join(" / ") : ""}</p>
      <div class="catalog-actions"><button type="button" class="button button-secondary" data-favorite="${esc(id)}" aria-pressed="${favorite}">${favorite?"★ お気に入り解除":"☆ お気に入り登録"}</button>
      ${favorite && $("craftOnlyFavorite").checked?`<button type="button" class="button button-secondary" data-move="${esc(id)}" data-offset="-1" ${index===0?"disabled":""}>↑ 上へ</button><button type="button" class="button button-secondary" data-move="${esc(id)}" data-offset="1" ${index===settings.favorites.length-1?"disabled":""}>↓ 下へ</button>`:""}</div>
      <h4>${r["生産種別"]==="強化"?"強化対象":"必要素材"}</h4><ul>${materialRows(id).map(m => `<li>${button("data-item",m["素材アイテムID"],name(m["素材アイテムID"]))} ×${m["必要個数"]} · ${button("data-drop-item",m["素材アイテムID"],"入手先")} · ${button("data-memo-add",name(m["素材アイテムID"]),"メモに追加")}</li>`).join("") || "<li>未確認</li>"}</ul>
      <h4>完成品</h4><ul>${resultRows(id).map(m => `<li>${esc(m["結果区分"])}：${button("data-item",m["完成アイテムID"],name(m["完成アイテムID"]))} ×${m["完成個数"]}</li>`).join("") || "<li>未確認</li>"}</ul>
      ${[...new Map(outputItems(id).filter(i=>i["分類"]==="消費").map(i=>[i["アイテムID"],i])).values()].map(i=>`<p class="catalog-effect-summary">${esc(i["名前"])}：${esc(itemFilters.textFor(i)||"効能の記載なし")}</p>`).join("")}
      ${publicNote(r["備考"])?`<p class="catalog-note">${publicNote(r["備考"])}</p>`:""}
      </article>`;
    }).join("") || '<p class="catalog-empty">条件に合うレシピがありません。検索・絞り込みを変更してください。</p>';
    if (rows.length > visibleRecipes) {
      const pager = document.createElement("div"); pager.className = "catalog-pagination";
      const summary = document.createElement("p"); summary.textContent = `${rows.length}件中 ${shown}件を表示中`;
      const more = document.createElement("button");
      more.type = "button"; more.className = "button button-secondary";
      more.textContent = `次の${Math.min(50,rows.length-shown)}件を表示（残り ${rows.length-shown}件）`;
      more.dataset.moreRecipes = "";
      more.addEventListener("click",() => {
        const previous = shown; visibleRecipes += 50; renderCraft(false);
        const firstNew = $("craftList").querySelectorAll("[data-recipe-card]")[previous];
        if (firstNew) { firstNew.tabIndex = -1; firstNew.focus({preventScroll:true}); firstNew.scrollIntoView({block:"start"}); }
      });
      pager.append(summary,more); $("craftList").appendChild(pager);
    }
  }
  const locations = window.IrunaLocationsBrowser.create(data);
  window.IrunaReferences?.init(data,locations);
  window.IrunaMonsterBrowser.create(data);
  function renderDrops() { locations.render(); }
  const show = view => window.IrunaCatalogBridge.show(view);
  function navigateDrop(id) { locations.navigate("item",id); }
  function navigateRecipe(id) {
    const r = data.recipes.find(x => x["レシピID"]===id); if (!r) return;
    window.IrunaModal.close(); $("craftSearch").value=r["レシピ名"]; $("craftField").value="";
    ["craftItemType","craftKind","craftMinLevel","craftMaxLevel","craftEffect","craftEffectSearch"].forEach(id=>{$(id).value="";});
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
  ["craftSearch","craftField","craftOnlyPossible","craftOnlyFavorite","craftItemType","craftKind","craftMinLevel","craftMaxLevel","craftSort","craftEffect","craftEffectSearch"].forEach(id => $(id).addEventListener("input",renderCraft));
  document.addEventListener("iruna-item-effects-ready",()=>renderCraft(false));
  $("craftClearFilters").addEventListener("click",()=>{
    ["craftSearch","craftField","craftItemType","craftKind","craftMinLevel","craftMaxLevel","craftEffect","craftEffectSearch"].forEach(id=>{$(id).value="";});
    $("craftOnlyPossible").checked=$("craftOnlyFavorite").checked=false;$("craftSort").value="levelAsc";renderCraft();
  });
  $("dropSearch").addEventListener("input",()=>locations.search());
  window.IrunaCatalog = {setEquipmentData:locations.setEquipmentData,decorateModal(item) {
    const id=item["アイテムID"], uses=data.materials.filter(m => active(m) && m["素材アイテムID"]===id);
    const outputs=data.results.filter(m => active(m) && m["完成アイテムID"]===id);
    const wiki=window.IrunaWikiData?.evidence.get(id);
    if(!items.has(id)&&!uses.length&&!outputs.length&&!wiki)return;
    const panel=document.createElement("section");panel.className="catalog-modal-links";
    panel.innerHTML=`<h3>入手先・生産</h3>${button("data-drop-item",id,"入手先を調べる")}<ul>${[...new Set([...uses,...outputs].map(m=>m["レシピID"]))].map(r => `<li>${button("data-recipe",r,data.recipes.find(x=>x["レシピID"]===r)["レシピ名"])}</li>`).join("")}</ul>`;
    $("modalEffectArea").appendChild(panel);
    if(window.IrunaWikiData?.isCatalogOnly(item)){
      const note=document.createElement('p');note.className='catalog-note';
      note.textContent='能力説明のみ登録しています。装備計算への選択は未対応です。';panel.prepend(note);
    }
    if(wiki){
      const audit=document.createElement('details');audit.className='catalog-wiki-audit';
      const differences=Object.entries(wiki.baseDifferences||{});
      audit.innerHTML=`<summary>資料の照合（日本語）</summary><p>日本語資料 · ${esc(wiki.checkedAt||data.updatedAt)} · ${esc(wiki.status)}</p>
        ${wiki.description?`<p>${esc(wiki.description)}</p>`:'<p>資料には日本語の説明文がありません。</p>'}
        ${differences.length?`<p>基礎値の資料差：${differences.map(([key,v])=>`${esc(key)} 登録値 ${esc(v.registered)} / 資料値 ${esc(v.reference)}`).join('、')}</p>`:''}
        <p class="catalog-note">${wiki.status==='説明表記に差分あり'||differences.length?'数値・条件・強化段階の違いは個別確認が必要です。計算には既存の能力データを使用します。':'日本語表記を照合しています。'} 日本版の実装・現行仕様はゲーム内未検証です。</p>`;
      panel.appendChild(audit);
    }
  }};
  $("catalogUpdated").textContent=`登録データ確認日：${data.updatedAt}（自動更新ではありません）`;
  renderCraft(); renderDrops();
})();
