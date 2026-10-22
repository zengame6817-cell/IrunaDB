"use strict";
(() => {
  const active=r=>r['有効']!==false&&String(r['有効']).toUpperCase()!=='FALSE';
  function filter(rows,filters,spawns,elements){
    const q=String(filters.query||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
    return rows.filter(active).filter(m=>(!q||String(m['名前']).normalize('NFKC').toLowerCase().replace(/\s+/g,'').includes(q))&&
      (!filters.element||(filters.element==='unknown'?!elements.values(m['属性']).length:elements.values(m['属性']).includes(filters.element)))&&
      (!filters.type||(filters.type==='unknown'?['','未確認'].includes(String(m['種別']||'').trim()):m['種別']===filters.type))&&
      (!filters.map||(spawns.get(m['モンスターID'])||[]).some(s=>s['マップID']===filters.map)))
      .sort((a,b)=>{const av=a['Lv下限']===''?null:Number(a['Lv下限']),bv=b['Lv下限']===''?null:Number(b['Lv下限']);
        if(filters.sort!=='name'){if(av===null&&bv!==null)return 1;if(bv===null&&av!==null)return -1;const diff=(av??0)-(bv??0);if(diff)return filters.sort==='levelDesc'?-diff:diff;}
        return a['名前'].localeCompare(b['名前'],'ja',{numeric:true})||(av??0)-(bv??0)||a['モンスターID'].localeCompare(b['モンスターID']);});
  }
  function create(data){
    const $=id=>document.getElementById(id),esc=window.IrunaUtils.escapeHtml,elements=window.IrunaLocationElements;
    const maps=new Map(data.maps.filter(active).map(m=>[m['マップID'],m])),items=new Map(data.items.map(i=>[i['アイテムID'],i]));
    const monsters=data.monsters.filter(active),byId=new Map(monsters.map(m=>[m['モンスターID'],m])),spawns=new Map(),drops=new Map();
    for(const s of data.spawns.filter(active)){if(!maps.has(s['マップID']))continue;if(!spawns.has(s['モンスターID']))spawns.set(s['モンスターID'],[]);spawns.get(s['モンスターID']).push(s);}
    for(const d of data.drops.filter(active)){if(!drops.has(d['モンスターID']))drops.set(d['モンスターID'],[]);drops.get(d['モンスターID']).push(d);}
    const option=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`;
    $('monsterElement').innerHTML=option('','すべて')+elements.labels.map(v=>option(v,v)).join('')+option('unknown','未確認');
    $('monsterMap').innerHTML=option('','すべてのマップ')+[...maps.values()].sort((a,b)=>a['マップ名'].localeCompare(b['マップ名'],'ja',{numeric:true})).map(m=>option(m['マップID'],[m['マップ名'],m['エリア'],m['階層']].filter(Boolean).join(' / '))).join('');
    const level=m=>m['Lv下限']===''?'Lv未確認':`Lv${m['Lv下限']}${m['Lv上限']!==m['Lv下限']?'～'+m['Lv上限']:''}`;
    const type=m=>m['種別']==='ミニボス'?'レアモブ（ミニボス）':m['種別']||'種別未確認';
    const places=id=>[...new Set((spawns.get(id)||[]).map(s=>s['マップID']))].map(id=>{const m=maps.get(id);return `<button type="button" class="catalog-link" data-map="${esc(id)}">${esc([m['マップ名'],m['エリア'],m['階層']].filter(Boolean).join(' / '))}</button>`;}).join(' / ')||'出現場所は未登録です。';
    let visible=50,selected='',savedScroll=0;
    const filters=()=>({query:$('monsterSearch').value,element:$('monsterElement').value,type:$('monsterType').value,map:$('monsterMap').value,sort:$('monsterSort').value});
    function render(){
      const rows=filter(monsters,filters(),spawns,elements),panel=$('monsterDetail');panel.hidden=!selected;$('monsterList').hidden=Boolean(selected);
      $('monsterCount').textContent=`該当${rows.length}件 / 登録${monsters.length}件（名前${new Set(monsters.map(m=>m['名前'])).size}種類） · ${Math.min(visible,rows.length)}件を表示`;
      if(selected){const m=byId.get(selected),groups=window.IrunaCatalogModel.groupDrops(data,drops.get(selected)||[]);
        panel.innerHTML=`<button type="button" class="button button-secondary" data-monster-back>← モンスター一覧へ戻る</button><h3>${esc(m['名前'])} ${esc(level(m))}</h3><p>属性：${esc(m['属性']||'未確認')} · ${esc(type(m))}</p><h4>出現場所</h4><p>${places(selected)}</p><h4>ドロップ</h4><ul>${groups.map(g=>{const id=g[0]['アイテムID'];return `<li><button type="button" class="catalog-link" data-item="${esc(id)}">${esc(items.get(id)?.['名前']||id)}</button></li>`;}).join('')||`<li>${m['確認状態']==='ドロップなし確認'?'ドロップなし':'ドロップ情報は未登録です。'}</li>`}</ul>`;return;}
      panel.replaceChildren();$('monsterList').innerHTML=rows.slice(0,visible).map(m=>`<article class="catalog-card" data-monster-card="${esc(m['モンスターID'])}"><h3><button type="button" class="catalog-link" data-monster-open="${esc(m['モンスターID'])}">${esc(m['名前'])} ${esc(level(m))}</button></h3><p>属性：${esc(m['属性']||'未確認')} · ${esc(type(m))}</p><p>${places(m['モンスターID'])}</p><p>ドロップ：${(drops.get(m['モンスターID'])||[]).length?'登録あり':m['確認状態']==='ドロップなし確認'?'なし確認':'未登録'}</p></article>`).join('')||'<p class="catalog-empty">条件に合うモンスターがありません。</p>';
      if(rows.length>visible){const more=document.createElement('button');more.type='button';more.className='button button-secondary';more.dataset.moreMonsters='';more.textContent=`次の${Math.min(50,rows.length-visible)}件を表示`;more.addEventListener('click',()=>{const old=visible;visible+=50;render();const card=$('monsterList').querySelectorAll('[data-monster-card]')[old];card.tabIndex=-1;card.focus();});$('monsterList').append(more);}
    }
    const reset=()=>{visible=50;selected='';render();};
    ['monsterSearch','monsterElement','monsterType','monsterMap','monsterSort'].forEach(id=>$(id).addEventListener(id==='monsterSearch'?'input':'change',reset));
    $('monsterClear').addEventListener('click',()=>{['monsterSearch','monsterElement','monsterType','monsterMap'].forEach(id=>$(id).value='');$('monsterSort').value='name';reset();});
    $('view-monsters').addEventListener('click',event=>{const button=event.target.closest('[data-monster-open],[data-monster-back]');if(!button)return;if(button.hasAttribute('data-monster-back')){selected='';render();window.scrollTo({top:savedScroll});$('monsterSearch').focus({preventScroll:true});}else if(byId.has(button.dataset.monsterOpen)){savedScroll=window.scrollY;selected=button.dataset.monsterOpen;render();$('monsterDetail').focus();}});
    render();return {render};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={filter};else window.IrunaMonsterBrowser={create};
})();
