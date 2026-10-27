'use strict';
(()=>{
 const M=window.IrunaReferenceModel,esc=M.esc;let engine=null,locations=null,source=null,dialog,choices=[],returnBar;
 function html(value,kinds){return engine?engine.html(value,kinds):esc(value);}
 function step(value){const text=String(value||''),kinds=['map'];if(/入手|収集|持|渡|所持|必要|集|[×xｘ]\s*\d/i.test(text))kinds.push('item');if(/討伐|倒|撃破|戦闘|Lv|BOSS|ボス|から取/i.test(text))kinds.push('monster');return html(text,kinds);}
 function back(){if(!source)return;window.IrunaCatalogBridge.show(source.view);requestAnimationFrame(()=>{window.scrollTo({top:source.scroll});if(source.button?.isConnected)source.button.focus({preventScroll:true});});}
 function remember(button){const view=button.closest('.app-view');if(view&&['view-skill','view-mission'].includes(view.id)){source={view:view.id.slice(5),scroll:window.scrollY,button};returnBar.hidden=false;returnBar.querySelector('button').textContent=source.view==='skill'?'← スキルに戻る':'← MSに戻る';}}
 function open(entry,acquisition=false){
  if(entry.kind==='item'&&!acquisition){if(window.IrunaCatalogBridge?.openItem(entry.id)){dialog.close();return;}dialog.querySelector('[data-reference-status]').textContent='DBを読み込み中です。少し待ってから選び直してください。';if(!dialog.open)dialog.showModal();return;}
  if(locations.navigate(entry.kind,entry.id))dialog.close();
 }
 function description(entry,data){const r=entry.row;if(entry.kind==='item')return [r['分類'],r['サブ分類'],entry.id].filter(Boolean).join(' / ');if(entry.kind==='map')return [r['エリア'],r['階層'],r['エピソード'],entry.id].filter(Boolean).join(' / ')||'全域';const mapIds=new Set(data.spawns.filter(s=>s['モンスターID']===entry.id).map(s=>s['マップID']));const maps=data.maps.filter(m=>mapIds.has(m['マップID'])).map(m=>[m['マップ名'],m['エリア'],m['階層']].filter(Boolean).join(' / '));return ['Lv'+(r['Lv下限']===''?'未登録':r['Lv下限'])+(r['Lv上限']!==r['Lv下限']?'～'+r['Lv上限']:''),...maps].join(' · ');}
 function init(data,browser){if(engine)return;engine=M.create(data);locations=browser;
  returnBar=document.createElement('nav');returnBar.className='reference-return';returnBar.hidden=true;returnBar.innerHTML='<button type="button" class="button button-secondary"></button>';returnBar.querySelector('button').addEventListener('click',back);document.getElementById('view-drops').prepend(returnBar);
  dialog=document.createElement('dialog');dialog.id='referenceChoices';dialog.className='reference-dialog';dialog.innerHTML='<div class="reference-dialog-heading"><h3 id="referenceChoiceTitle"></h3><button type="button" class="button button-secondary" data-reference-close>閉じる</button></div><p>分類・出現場所・Lvを確認して選んでください。</p><input type="search" aria-label="候補を絞り込む" placeholder="分類・マップ・Lvで絞り込み"><div data-reference-rows></div><p role="status" data-reference-status></p>';dialog.setAttribute('aria-labelledby','referenceChoiceTitle');document.body.append(dialog);
  dialog.querySelector('[data-reference-close]').addEventListener('click',()=>dialog.close());dialog.querySelector('input').addEventListener('input',e=>{const q=M.normalize(e.target.value);dialog.querySelectorAll('[data-reference-row]').forEach(row=>{row.hidden=!M.normalize(row.textContent).includes(q);});});
  dialog.addEventListener('click',e=>{const b=e.target.closest('[data-reference-choice]');if(!b)return;open(choices[Number(b.dataset.referenceChoice)],b.dataset.referenceAcquisition==='1');});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-reference-name]');if(!b)return;e.preventDefault();remember(b);choices=engine.resolve(b.dataset.referenceName,b.dataset.referenceKinds.split(','));if(!choices.length)return;
   dialog.querySelector('h3').textContent=b.textContent+'の候補';dialog.querySelector('input').value='';dialog.querySelector('[data-reference-status]').textContent='';
   dialog.querySelector('[data-reference-rows]').innerHTML=choices.map((c,i)=>'<article class="reference-choice" data-reference-row><strong>'+esc(c.name)+'</strong><p>'+esc(description(c,data))+'</p><button type="button" class="button button-secondary" data-reference-choice="'+i+'">'+(c.kind==='item'?'詳細を見る':c.kind==='map'?'モンスター一覧':'出現場所・ドロップ')+'</button>'+(c.kind==='item'?' <button type="button" class="button button-secondary" data-reference-choice="'+i+'" data-reference-acquisition="1">入手先</button>':'')+'</article>').join('');if(choices.length===1){open(choices[0]);return;}dialog.showModal();
  });
 }
 window.IrunaReferences={html,step,init};
})();
