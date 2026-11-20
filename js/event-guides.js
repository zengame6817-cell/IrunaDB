"use strict";
(() => {
  const data = window.IRUNA_EVENT_GUIDES, model = globalThis.IrunaEventGuidesModel;
  if (!data || !model) return;
  const loot = window.IRUNA_EVENT_LOOT || [];
  const previousYears = 'past';
  const state = {mode:'guide',method:'',year:'',family:data.families[0],query:'',hideDone:false,done:model.read(localStorage,model.DONE),owned:model.read(localStorage,model.OWNED)};
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el = id => document.getElementById(id);
  const familyRows = () => data.guides.filter(g=>state.family==='すべて'||g.family===state.family);
  const inYear = g => !state.year || (state.year===previousYears ? g.year && g.year<=2025 : String(g.year)===state.year);
  const rows = () => familyRows().filter(g=>inYear(g)&&(model.matches(g,state.query)||loot.some(x=>x.guideIds.includes(g.id)&&model.lootMatches(x,state.query,[g])))&&(!state.hideDone||!state.done.has(g.id)))
    .sort((a,b)=>(b.year||0)-(a.year||0));
  function dropList(guide) {
    const groups = model.dropGroups(loot, guide.id);
    if (!groups.length) return '<p class="mission-help">この攻略のドロップ情報は確認中です。</p>';
    return '<h4>モンスターとドロップ</h4>'+groups.map(({target,place,drops})=>
      `<details class="event-monster"><summary>${esc(target)}</summary>
        <p>${window.IrunaReferences?.html(place,['map'])||esc(place)}</p>
        <ul>${drops.map(drop=>`<li>${itemLink(drop.name)}</li>`).join('')}</ul>
      </details>`).join('');
  }
  function itemLink(name) {
    return `<button type="button" class="reference-link" data-event-item="${esc(name)}">${esc(name)}</button>`;
  }
  const itemId = (g,i) => g.id + ':' + i;
  function save(key,values) {
    try { localStorage.setItem(key,JSON.stringify([...values])); el('eventSaveStatus').textContent=''; }
    catch { el('eventSaveStatus').textContent='チェックを保存できませんでした。この画面では保持しています。空き容量やブラウザーの保存設定を確認してください。'; }
  }
  function render() {
    const open = new Set([...el('eventGuideList').querySelectorAll('details[open]')].map(x=>x.dataset.guide));
    const expanded = new Set([...el('eventGuideList').querySelectorAll('.event-monster[open]')]
      .map(node=>node.closest('[data-guide]').dataset.guide + ':' + node.querySelector('summary').textContent + ':' + node.querySelector('p').textContent));
    const available = model.years(familyRows());
    if (state.year && state.year!==previousYears && !available.includes(Number(state.year))) state.year='';
    el('eventGuideYear').innerHTML='<option value="">すべての年</option><option value="past">2025年まで</option>'+
      available.map(year=>`<option value="${year}">${year}年</option>`).join('');
    el('eventGuideYear').value=state.year;
    el('eventGuidePanels').hidden=state.mode!=='guide';
    el('eventLootPanel').hidden=state.mode!=='loot';
    el('eventHideDone').closest('label').hidden=state.mode!=='guide';
    el('eventModeGuide').setAttribute('aria-pressed',String(state.mode==='guide'));
    el('eventModeLoot').setAttribute('aria-pressed',String(state.mode==='loot'));
    el('eventCoverage').textContent=`掲載：${data.families.length}種類・${data.guides.length}攻略・入手アイテム${loot.length}件`;
    const lootRows=loot.filter(x=>(state.family==='すべて'||x.family===state.family)&&(!state.year||data.guides.some(g=>x.guideIds.includes(g.id)&&inYear(g)))&&(!state.method||x.method===state.method)&&model.lootMatches(x,state.query,data.guides));
    el('eventLootCount').textContent=`${lootRows.length}件`;
    el('eventLootList').innerHTML=lootRows.map(x=>`<article class="event-loot-card"><div class="event-loot-heading"><h4>${itemLink(x.name)}</h4><span>${esc(x.method)}</span></div><p class="event-loot-family">${esc(x.family)}</p><dl class="event-guide-meta"><div><dt>場所</dt><dd>${esc(x.place)}</dd></div><div><dt>敵・NPC</dt><dd>${esc(x.target)}</dd></div><div><dt>条件・必要数</dt><dd>${esc(x.condition)}</dd></div></dl></article>`).join('')||'<p class="mission-empty">条件に合うアイテムはありません。</p>';
    const all = familyRows(), visible = rows(), done = all.filter(g=>state.done.has(g.id)).length;
    el('eventProgressText').textContent=`${done} / ${all.length}`;
    el('eventProgressBar').style.width=`${all.length?done/all.length*100:0}%`;
    el('eventResultCount').textContent=`${visible.length}件`;
    el('eventFamilyTabs').innerHTML=['すべて',...data.families].map(f=>`<button type="button" class="mission-ep-tab ${f===state.family?'is-active':''}" data-family="${esc(f)}" aria-pressed="${f===state.family}">${esc(f)}</button>`).join('');
    el('eventFamilyTabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.family=b.dataset.family;render();}));
    el('eventGuideList').innerHTML=visible.map(g=>{
      return `<details class="mission-card ${state.done.has(g.id)?'is-complete':''}" data-guide="${esc(g.id)}" ${open.has(g.id)?'open':''}>
        <summary><div class="mission-card-title"><strong>${esc(g.title)}</strong><small>${esc(g.family)} · ${g.year?g.year+'年ストーリー':'イベントガイド'}${state.done.has(g.id)?' · 完了済み':''}</small></div><b class="mission-chevron">＋</b></summary>
        <div class="mission-card-body"><label class="mission-toggle"><input type="checkbox" data-event-done="${esc(g.id)}" ${state.done.has(g.id)?'checked':''}> この攻略を完了にする</label>
        <dl class="event-guide-meta"><div><dt>入口</dt><dd>${esc(g.entry)}</dd></div><div><dt>前提・開始条件</dt><dd>${esc(g.requirement)}</dd></div><div><dt>クリア後の解放</dt><dd>${esc(g.unlock)}</dd></div></dl>
        <div class="mission-route-label">進め方</div>${g.steps.map((s,i)=>`<div class="mission-step"><i>${i+1}</i><p>${window.IrunaReferences?.step(s)||esc(s)}</p></div>`).join('')}
        ${dropList(g)}
        ${g.note?`<p class="mission-review-note">${esc(g.note)}</p>`:''}
        </div></details>`;
    }).join('')||'<p class="mission-empty">条件に合う攻略はありません。</p>';
    el('eventGuideList').querySelectorAll('.event-monster').forEach(node=>{
      const key=node.closest('[data-guide]').dataset.guide+':'+node.querySelector('summary').textContent+':'+node.querySelector('p').textContent;
      node.open=expanded.has(key);
    });
    el('eventGuideList').querySelectorAll('[data-event-done]').forEach(b=>b.addEventListener('change',()=>{
      b.checked?state.done.add(b.dataset.eventDone):state.done.delete(b.dataset.eventDone);save(model.DONE,state.done);render();
    }));
    el('eventItemList').innerHTML=visible.flatMap(g=>g.items.map((x,i)=>x.archived?'':`<label class="mission-item ${state.owned.has(itemId(g,i))?'is-owned':''}"><input type="checkbox" data-event-owned="${esc(itemId(g,i))}" ${state.owned.has(itemId(g,i))?'checked':''}><span class="mission-item-main"><strong>${esc(x.name)} ×${x.qty}</strong><small>${esc(g.title)}</small><em>${esc(x.obtain||"入手場所は確認中。")}</em></span></label>`)).join('')||'<p class="mission-help">表示中の攻略に、事前収集する素材の登録はありません。</p>';
    el('eventItemList').querySelectorAll('[data-event-owned]').forEach(b=>b.addEventListener('change',()=>{
      b.checked?state.owned.add(b.dataset.eventOwned):state.owned.delete(b.dataset.eventOwned);save(model.OWNED,state.owned);b.closest('label').classList.toggle('is-owned',b.checked);
    }));
  }
  function init() {
    if (!el('eventGuideList')) return;
    el('eventGuideYear').addEventListener('change',e=>{state.year=e.target.value;render();});
    el('view-events').addEventListener('click',e=>{
      const button=e.target.closest('[data-event-item]');
      if(!button)return;
      const result=window.IrunaReferences?.openNamedItem(button.dataset.eventItem);
      el('eventItemStatus').textContent=result===true?'':result===false?'このアイテムの詳細はDBに未登録です。':'DBを読み込み中です。少し待ってからお試しください。';
    });
    el('view-calendar').addEventListener('click',e=>{
      const link=e.target.closest('[data-event-guide-family]');
      if(!link)return;
      state.family=link.dataset.eventGuideFamily;state.year=previousYears;state.mode='guide';
      state.query='';state.hideDone=false;
      el('eventGuideSearch').value='';el('eventHideDone').checked=false;
      window.IrunaCatalogBridge?.show('events');
      render();
    });
    el('eventGuideSearch').addEventListener('input',e=>{state.query=e.target.value;render();});
    el('eventHideDone').addEventListener('change',e=>{state.hideDone=e.target.checked;render();});
    el('eventModeGuide').addEventListener('click',()=>{state.mode='guide';render();});
    el('eventModeLoot').addEventListener('click',()=>{state.mode='loot';render();});
    el('eventLootMethod').addEventListener('change',e=>{state.method=e.target.value;render();});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
