"use strict";
window.IrunaLocationsBrowser = (() => {
  function create(data) {
    const $=id=>document.getElementById(id),esc=window.IrunaUtils.escapeHtml,normalize=value=>window.IrunaCatalogModel.normalize(value).replace(/^[◇◆▲△□■]/,'');
    const active=r=>r['有効']!==false&&String(r['有効']).toUpperCase()!=='FALSE';
    const items=new Map(data.items.map(r=>[r['アイテムID'],r])),monsters=new Map(data.monsters.filter(active).map(r=>[r['モンスターID'],r])),maps=new Map(data.maps.filter(active).map(r=>[r['マップID'],r]));
    const spawns=data.spawns.filter(active).filter(s=>monsters.has(s['モンスターID'])&&maps.has(s['マップID'])),drops=data.drops.filter(active).filter(d=>monsters.has(d['モンスターID']));
    const name=id=>items.get(id)?.['名前']||id;
    const button=(attr,id,text)=>`<button type="button" class="catalog-link" ${attr}="${esc(id)}">${esc(text)}</button>`;
    const lv=mob=>mob['Lv下限']===''?'Lv未確認':`Lv${mob['Lv下限']}${mob['Lv上限']!==mob['Lv下限']?'～'+mob['Lv上限']:''}`;
    const mapName=m=>m['マップ名']+(m['階層']?`【${m['階層']}】`:'');
    const note=v=>esc(String(v||'').replace(/https?:\/\/\S+/g,'').trim());
    const spawnsByMonster=new Map();for(const row of spawns){const id=row['モンスターID'];if(!spawnsByMonster.has(id))spawnsByMonster.set(id,[]);spawnsByMonster.get(id).push(row);}
    const spawnRows=id=>spawnsByMonster.get(id)||[];
    const mapLinks=id=>spawnRows(id).map(s=>button('data-map',s['マップID'],mapName(maps.get(s['マップID'])))).join(' / ')||'出現場所は未登録です';
    const searchText=new Map(drops.map(r=>[r['ドロップID'],normalize([name(r['アイテムID']),monsters.get(r['モンスターID'])['名前'],...spawnRows(r['モンスターID']).map(s=>mapName(maps.get(s['マップID'])))].join(' '))]));
    const toolbar=$('dropSearch').closest('.catalog-toolbar');
    toolbar.insertAdjacentHTML('beforeend','<label>マップ<select id="dropMap"><option value="">マップを選択</option></select></label><label>エリア・階層<select id="dropArea" disabled><option value="">エリアを選択</option></select></label>');
    const mapGroups=new Map();for(const map of maps.values()){const key=map['マップ名'];if(!mapGroups.has(key))mapGroups.set(key,[]);mapGroups.get(key).push(map);}
    const option=(value,label)=>`<option value="${esc(value)}">${esc(label)}</option>`;
    $('dropMap').insertAdjacentHTML('beforeend',[...mapGroups.keys()].sort((a,b)=>a.localeCompare(b,'ja',{numeric:true})).map(n=>option(n,n)).join(''));
    function syncMapSelection(id){
      const map=maps.get(id);$('dropMap').value=map?.['マップ名']||'';
      const rows=map?mapGroups.get(map['マップ名']):[];
      $('dropArea').innerHTML=option('','エリアを選択')+rows.map(m=>option(m['マップID'],[m['エリア'],m['階層'],m['エピソード']].filter(Boolean).join(' / ')||'全域')).join('');
      $('dropArea').disabled=!rows.length;$('dropArea').value=id||'';
    }
    $('dropMap').addEventListener('change',()=>{const rows=mapGroups.get($('dropMap').value);if(!rows){search(true);return;}syncMapSelection(rows[0]['マップID']);navigate('map',rows[0]['マップID']);});
    $('dropArea').addEventListener('change',()=>{if($('dropArea').value)navigate('map',$('dropArea').value);});
    toolbar.insertAdjacentHTML('beforeend','<label>モンスター種別<select id="dropMonsterType"><option value="">すべて</option><option>ボス</option><option>ミニボス</option><option>通常</option><option value="unknown">種別未確認</option></select></label><label>ドロップ区分<select id="dropItemType"><option value="">すべて</option><option>クリスタ</option><option>アルクリスタ</option><option>レリック</option><option value="equipment">装備</option><option value="material">素材・収集品</option><option>消費</option></select></label>');
    const filterIds=['dropMonsterType','dropItemType'];
    filterIds.forEach(id=>$(id).addEventListener('change',()=>search()));
    const nav=document.createElement('nav');nav.className='location-navigation';nav.setAttribute('aria-label','入手先の移動');
    const panel=document.createElement('section');panel.id='locationDetail';panel.className='location-detail';panel.tabIndex=-1;panel.hidden=true;
    $('dropSearch').closest('.catalog-toolbar').before(nav);$('dropCount').before(panel);
    let route={kind:'list'},visible=50;const history=[];
    function snapshot(){return {route:{...route},query:$('dropSearch').value,filters:filterIds.map(id=>$(id).value),visible,scroll:window.scrollY};}
    function valid(kind,id){return kind==='item'?items.has(id):kind==='monster'?monsters.has(id):kind==='map'?maps.has(id):false;}
    function navigate(kind,id){
      if(!valid(kind,id))return false;
      if(route.kind!==kind||route.id!==id)history.push(snapshot());
      window.IrunaModal.close();route={kind,id};visible=50;
      filterIds.forEach(id=>$(id).value='');
      $('dropSearch').value=kind==='item'?name(id):kind==='monster'?monsters.get(id)['名前']:mapName(maps.get(id));
      render();window.IrunaCatalogBridge.show('drops');panel.focus({preventScroll:true});return true;
    }
    function back(){const prev=history.pop();if(!prev){search(true);return;}route=prev.route;visible=prev.visible;$('dropSearch').value=prev.query;filterIds.forEach((id,i)=>$(id).value=prev.filters[i]);render();window.scrollTo({top:prev.scroll});$('dropSearch').focus({preventScroll:true});}
    function search(clear=false){route={kind:'list'};visible=50;history.length=0;if(clear){$('dropSearch').value='';filterIds.forEach(id=>$(id).value='');}render();}
    function detail(){
      nav.innerHTML=route.kind==='list'?'':`<button type="button" class="button button-secondary" data-location-back>← 戻る</button><button type="button" class="button button-secondary" data-location-list>一覧・全体検索へ</button>`;
      panel.hidden=route.kind==='list';panel.dataset.kind=route.kind;panel.dataset.id=route.id||'';
      if(route.kind==='monster'){
        const mob=monsters.get(route.id);
        panel.innerHTML=`<p class="catalog-note">モンスター詳細</p><h3>${esc(mob['名前'])} <span>${esc(lv(mob))}</span></h3>
          <dl class="location-facts"><dt>属性</dt><dd>${esc(mob['属性']||'未確認')}</dd><dt>種別</dt><dd>${esc(mob['種別']||'未確認')}</dd></dl>
          <h4>出現場所</h4><p>${mapLinks(route.id)}</p>${monsterDrops(route.id)}`;
      } else if(route.kind==='map'){
        const map=maps.get(route.id),ids=[...new Set(spawns.filter(s=>s['マップID']===route.id).map(s=>s['モンスターID']))];
        ids.sort((a,b)=>(monsters.get(a)['Lv下限']||0)-(monsters.get(b)['Lv下限']||0)||monsters.get(a)['名前'].localeCompare(monsters.get(b)['名前'],'ja'));
        panel.innerHTML=`<p class="catalog-note">マップ詳細</p><h3>${esc(mapName(map))}</h3>
          <h4>出現モンスター ${ids.length}件</h4><div class="location-monster-cards">${ids.map(id=>`<article class="catalog-card"><h3>${button('data-monster',id,monsters.get(id)['名前']+' '+lv(monsters.get(id)))}</h3>${monsterDrops(id)}</article>`).join('')||'<p>出現モンスターは未登録です。</p>'}</div>`;
      } else if(route.kind==='item'){
        panel.innerHTML=`<p class="catalog-note">アイテムの入手先</p><h3>${button('data-item',route.id,name(route.id))}</h3><p>登録済みのドロップ・購入先・生産レシピを表示しています。</p>`;
      } else panel.replaceChildren();
    }
    function monsterDrops(id){
      const rows=window.IrunaCatalogModel.groupDrops(data,drops.filter(d=>d['モンスターID']===id));
      const rank=g=>{
        const kind=items.get(g[0]['アイテムID'])?.['分類'];
        return ['クリスタ','アルクリスタ','レリック'].includes(kind)?2:['武器','防具','体','追加','特殊','装飾'].includes(kind)?1:0;
      };
      rows.sort((a,b)=>rank(a)-rank(b));
      const empty=monsters.get(id)['確認状態']==='ドロップなし確認'?'ドロップなし':'ドロップ情報は未登録です。';
      return `<ul class="location-drops">${rows.map(g=>`<li>${button('data-item',g[0]['アイテムID'],name(g[0]['アイテムID']))}</li>`).join('')||`<li>${empty}</li>`}</ul>`;
    }
    function render(){
      syncMapSelection(route.kind==='map'?route.id:route.kind==='monster'?spawnRows(route.id)[0]?.['マップID']:null);
      filterIds.forEach(id=>{$(id).closest('label').hidden=['map','monster'].includes(route.kind);});
      detail();const q=normalize($('dropSearch').value),symbol=$('dropSearch').value.trim().match(/^[◇◆▲]/)?.[0],related=route.kind==='item'?window.IrunaCatalogModel.relatedItemIds(data,route.id):null,mapMobs=new Set(route.kind==='map'?spawns.filter(s=>s['マップID']===route.id).map(s=>s['モンスターID']):[]);
      const matching=drops.filter(r=>{
        const type=$('dropMonsterType').value,kind=$('dropItemType').value,mob=monsters.get(r['モンスターID']),category=items.get(r['アイテムID'])?.['分類'];
        if(type&&(type==='unknown'?Boolean(mob['種別']):mob['種別']!==type))return false;
        if(kind&&(kind==='equipment'?!['武器','防具','体','追加','特殊'].includes(category):kind==='material'?!['素材','収集品'].includes(category):category!==kind))return false;
        if(route.kind==='item')return related.has(r['アイテムID']);
        if(route.kind==='monster')return r['モンスターID']===route.id;
        if(route.kind==='map')return mapMobs.has(r['モンスターID']);
        return (!symbol||name(r['アイテムID']).startsWith(symbol))&&searchText.get(r['ドロップID']).includes(q);
      });
      const grouped=window.IrunaCatalogModel.groupDrops(data,matching);
      if(route.kind==='map'||route.kind==='monster'){$('dropCount').textContent=`ドロップ${grouped.length}件`;$('dropList').replaceChildren();return;}
      const entries=grouped.map(rows=>({kind:'drop',row:rows[0],rows}));
      if(route.kind==='item'||(route.kind==='list'&&q&&!$('dropMonsterType').value&&!$('dropItemType').value)){
        const purchases=data.items.filter(r=>r['入手区分']==='購入'&&(route.kind==='item'?r['アイテムID']===route.id:normalize([r['名前'],r['入手先'],r['マップ']].join(' ')).includes(q)));
        entries.push(...purchases.map(row=>({kind:'purchase',row})));
        const recipeIds=new Set(data.results.filter(active).filter(r=>route.kind==='item'?r['完成アイテムID']===route.id:normalize(name(r['完成アイテムID'])).includes(q)).map(r=>r['レシピID']));
        entries.push(...data.recipes.filter(active).filter(r=>recipeIds.has(r['レシピID'])).map(row=>({kind:'recipe',row})));
      }
      $('dropCount').textContent=`ドロップ${grouped.length}件 / 登録${drops.length}件${matching.length!==grouped.length?'（照合済みの同一入手先をまとめて表示）':''} · 入手先情報${entries.length}件中 ${Math.min(entries.length,visible)}件を表示`;
      $('dropList').innerHTML=entries.slice(0,visible).map(({kind,row:r,rows})=>{
        if(kind==='purchase'){
          const map=data.maps.find(m=>m['マップ名']===r['マップ']&&active(m));
          return `<article class="catalog-card" data-location-card><h3>${button('data-item',r['アイテムID'],r['名前'])}</h3><p>購入：${esc(r['入手先'])} / ${map?button('data-map',map['マップID'],mapName(map)):esc(r['マップ']||'場所未登録')}</p><p class="catalog-note">価格・販売条件は未確認です。</p></article>`;
        }
        if(kind==='recipe')return `<article class="catalog-card" data-location-card><h3>生産で入手</h3>${button('data-recipe',r['レシピID'],r['レシピ名'])}</article>`;
        const mob=monsters.get(r['モンスターID']);
        return `<article class="catalog-card" data-location-card><h3>${button('data-item',r['アイテムID'],name(r['アイテムID']))}</h3><p>${button('data-monster',r['モンスターID'],mob['名前'])} ${esc(lv(mob))}</p><p>${mapLinks(r['モンスターID'])}</p>
          <p>ドロップ枠：${esc(r['ドロップ枠']||'未確認')} · 確率：${r['ドロップ率(%)']===''?'未確認':esc(r['ドロップ率(%)'])+'%'}</p>
          ${rows.length>1?`<p class="catalog-note">${rows.length}件の資料を照合。同じ入手先として表示しています。</p>`:''}
          ${r['条件']?`<p class="catalog-note">${note(r['条件'])}</p>`:''}</article>`;
      }).join('')||'<p class="catalog-empty">この条件に一致する入手先情報は未登録です。情報がないことは、ドロップしないことを意味しません。</p>';
      if(entries.length>visible){
        const pager=document.createElement('div');pager.className='catalog-pagination';
        const more=document.createElement('button');more.type='button';more.className='button button-secondary';more.dataset.moreLocations='';more.textContent=`次の${Math.min(50,entries.length-visible)}件を表示（残り ${entries.length-visible}件）`;
        more.addEventListener('click',()=>{const previous=visible;visible+=50;render();const card=$('dropList').querySelectorAll('[data-location-card]')[previous];if(card){card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({block:'start'});}});
        pager.append(more);$('dropList').append(pager);
      }
    }
    document.addEventListener('click',event=>{
      const b=event.target.closest('[data-monster],[data-map],[data-location-back],[data-location-list]');if(!b)return;
      if(b.hasAttribute('data-location-back'))back();else if(b.hasAttribute('data-location-list')){search(true);$('dropSearch').focus();}else if(b.dataset.monster)navigate('monster',b.dataset.monster);else navigate('map',b.dataset.map);
    });
    return {render,navigate,search};
  }
  return {create};
})();
