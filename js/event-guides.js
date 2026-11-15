"use strict";
(() => {
  const data = window.IRUNA_EVENT_GUIDES, model = globalThis.IrunaEventGuidesModel;
  if (!data || !model) return;
  const state = {family:data.families[0],query:'',hideDone:false,done:model.read(localStorage,model.DONE),owned:model.read(localStorage,model.OWNED)};
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el = id => document.getElementById(id);
  const familyRows = () => data.guides.filter(g=>state.family==='すべて'||g.family===state.family);
  const rows = () => familyRows().filter(g=>model.matches(g,state.query)&&(!state.hideDone||!state.done.has(g.id)));
  const itemId = (g,i) => g.id + ':' + i;
  function save(key,values) {
    try { localStorage.setItem(key,JSON.stringify([...values])); el('eventSaveStatus').textContent=''; }
    catch { el('eventSaveStatus').textContent='チェックを保存できませんでした。この画面では保持しています。空き容量やブラウザーの保存設定を確認してください。'; }
  }
  function render() {
    const open = new Set([...el('eventGuideList').querySelectorAll('details[open]')].map(x=>x.dataset.guide));
    const all = familyRows(), visible = rows(), done = all.filter(g=>state.done.has(g.id)).length;
    el('eventProgressText').textContent=`${done} / ${all.length}`;
    el('eventProgressBar').style.width=`${all.length?done/all.length*100:0}%`;
    el('eventResultCount').textContent=`${visible.length}件`;
    el('eventFamilyTabs').innerHTML=['すべて',...data.families].map(f=>`<button type="button" class="mission-ep-tab ${f===state.family?'is-active':''}" data-family="${esc(f)}" aria-pressed="${f===state.family}">${esc(f)}</button>`).join('');
    el('eventFamilyTabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.family=b.dataset.family;render();}));
    el('eventGuideList').innerHTML=visible.map(g=>{
      const url=model.sourceUrl(g.source);
      return `<details class="mission-card ${state.done.has(g.id)?'is-complete':''}" data-guide="${esc(g.id)}" ${open.has(g.id)?'open':''}>
        <summary><div class="mission-card-title"><strong>${esc(g.title)}</strong><small>${esc(g.family)} · ${g.year}年ストーリー${state.done.has(g.id)?' · 完了済み':''}</small></div><b class="mission-chevron">＋</b></summary>
        <div class="mission-card-body"><label class="mission-toggle"><input type="checkbox" data-event-done="${esc(g.id)}" ${state.done.has(g.id)?'checked':''}> この攻略を完了にする</label>
        <dl class="event-guide-meta"><div><dt>入口</dt><dd>${esc(g.entry)}</dd></div><div><dt>前提・開始条件</dt><dd>${esc(g.requirement)}</dd></div><div><dt>クリア後の解放</dt><dd>${esc(g.unlock)}</dd></div></dl>
        <div class="mission-route-label">進め方</div>${g.steps.map((s,i)=>`<div class="mission-step"><i>${i+1}</i><p>${window.IrunaReferences?.step(s)||esc(s)}</p></div>`).join('')}
        ${g.note?`<p class="mission-review-note">${esc(g.note)}</p>`:''}
        <p class="event-source">参考：${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">えーへいさんの${esc(g.family)}攻略 ↗</a>`:'出典URL未確認'} · 確認日 ${esc(data.checkedAt)}</p>
        </div></details>`;
    }).join('')||'<p class="mission-empty">条件に合う攻略はありません。</p>';
    el('eventGuideList').querySelectorAll('[data-event-done]').forEach(b=>b.addEventListener('change',()=>{
      b.checked?state.done.add(b.dataset.eventDone):state.done.delete(b.dataset.eventDone);save(model.DONE,state.done);render();
    }));
    el('eventItemList').innerHTML=visible.flatMap(g=>g.items.map((x,i)=>`<label class="mission-item ${state.owned.has(itemId(g,i))?'is-owned':''}"><input type="checkbox" data-event-owned="${esc(itemId(g,i))}" ${state.owned.has(itemId(g,i))?'checked':''}><span class="mission-item-main"><strong>${esc(x.name)} ×${x.qty}</strong><small>${esc(g.title)}</small></span></label>`)).join('')||'<p class="mission-help">表示中の攻略に、事前収集する素材の登録はありません。</p>';
    el('eventItemList').querySelectorAll('[data-event-owned]').forEach(b=>b.addEventListener('change',()=>{
      b.checked?state.owned.add(b.dataset.eventOwned):state.owned.delete(b.dataset.eventOwned);save(model.OWNED,state.owned);b.closest('label').classList.toggle('is-owned',b.checked);
    }));
  }
  function init() {
    if (!el('eventGuideList')) return;
    el('eventGuideSearch').addEventListener('input',e=>{state.query=e.target.value;render();});
    el('eventHideDone').addEventListener('change',e=>{state.hideDone=e.target.checked;render();});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
