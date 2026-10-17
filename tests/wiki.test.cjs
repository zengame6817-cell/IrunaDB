const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');const root=path.resolve(__dirname,'..'),ctx={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','js/wiki-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);const clean=x=>JSON.parse(JSON.stringify(x)),w=ctx.window,base=w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA),merged=w.IrunaWikiData.mergeCatalog(base),db=JSON.parse(fs.readFileSync(path.join(root,'data/db.json'),'utf8')).data;

test('Dark Sight acquisition resolves both existing IDs without duplicating Gaze drops or changing abilities',()=>{
 const related=w.IrunaCatalogModel.relatedItemIds(merged,'SP000585');assert(related.has('SP000110'));assert(related.has('SP000585'));
 for(const id of ['MON002880','MON002883','MON002886']){const drops=merged.drops.filter(d=>d['モンスターID']===id&&related.has(d['アイテムID']));assert.equal(drops.length,1);assert.equal(drops[0]['アイテムID'],'SP000110');assert.equal(drops[0]['ドロップ率(%)'],'');assert.equal(drops[0]['ドロップ枠'],'');assert.equal(drops[0]['条件'],'');}
 for(const id of related){const original=db.items.find(i=>i['アイテムID']===id),item=w.IrunaWikiData.overlayItem(original);assert.equal(item['特殊性能'],original['特殊性能']);assert(item['入手先'].includes('389'));assert(w.IrunaWikiData.evidence.has(id));}
 const report=JSON.parse(fs.readFileSync(path.join(root,'data/wiki-coverage.json')));assert(!report.held.some(r=>r.id===13293));assert(!report.unmatchedDrops.some(r=>r.name==='ダークサイト'&&[3229,3232,3235].includes(r.monster)));
});

test('full source audit retains real drop counts and reconciles only unique category and monster matches',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'data/drop-audit-v3.0.67.json'))),proof=JSON.parse(fs.readFileSync(path.join(root,'data/reconciled-drops-v3.0.67.json')));
 assert.equal(report.summary.sourceMonsters,3706);assert.equal(report.monsters.length,3217);assert.equal(new Set(report.monsters.map(m=>m.id)).size,3217);assert.equal(report.summary.missingJapaneseRows,report.monsters.reduce((n,m)=>n+m.missing.length,0));assert(report.summary.sourceListsFewerThanFour>0);
 assert.equal(proof.rows.length,371);assert.equal(new Set(proof.rows.map(r=>r.dropId)).size,371);
 for(const p of proof.rows){const rows=merged.drops.filter(d=>d['モンスターID']===p.monsterId&&d['アイテムID']===p.itemId);assert.equal(rows.length,1);const r=rows[0];assert.equal(r['ドロップID'],p.dropId);assert.equal(r['ドロップ枠'],'');assert.equal(r['ドロップ率(%)'],'');assert.equal(r['条件'],'');const item=merged.items.find(i=>i['アイテムID']===p.itemId);assert(item);if(p.type==='Crysta')assert.equal(item['分類'],'クリスタ');if(p.type==='AL Crysta')assert.equal(item['分類'],'アルクリスタ');}
 assert(proof.rows.some(p=>p.itemId==='CR000285'));assert(proof.rows.some(p=>p.itemId==='AL000117'));
});
test('individually resolved hats reuse existing IDs and do not duplicate old drops',()=>{
 for(const [id,monster,drop]of [['AD000035','MON000551','DROP011389'],['AD000197','MON000522','DROP001718']]){
  const original=db.items.find(x=>x['アイテムID']===id),next=merged.items.find(x=>x['アイテムID']===id);
  assert.equal(merged.items.filter(x=>x['名前']===original['名前']).length,1);
  for(const field of ['基礎ATK','基礎DEF','特殊性能','説明文'])assert.equal(next[field],original[field]);
  const found=merged.drops.filter(x=>x['アイテムID']===id&&x['モンスターID']===monster);assert.equal(found.length,1);assert.equal(found[0]['ドロップID'],drop);
  for(const field of ['ドロップ率(%)','ドロップ枠','条件','難易度'])assert.equal(found[0][field],'');
  assert.equal(next['マップ'],'ミシェルヌ平野');assert(w.IrunaWikiData.evidence.has(id));
 }
});
test('crystal symbols are complete, idempotent and keep Provoke variants distinct',()=>{
 const all=new Map([...db.items,...w.IRUNA_CATALOG_DATA.items,...w.IRUNA_LOCATION_DATA.items,...w.IRUNA_WIKI_DATA.items].map(x=>[x['アイテムID'],x]));
 for(const item of all.values()){
  const next=w.IrunaWikiData.overlayItem(item),again=w.IrunaWikiData.overlayItem(next);
  if(item['分類']==='クリスタ')assert(/^[◇◆][^◇◆▲]/.test(next['名前']));
  else if(item['分類']==='アルクリスタ')assert(/^▲[^◇◆▲]/.test(next['名前']));
  else assert.equal(next['名前'],item['名前']);
  assert.equal(again['名前'],next['名前']);
 }
 assert.equal(w.IrunaWikiData.overlayItem(all.get('CR000379'))['名前'],'◇プロボーグ');
 assert.equal(w.IrunaWikiData.overlayItem(all.get('IW00011587'))['名前'],'◆プロボーグ');
 assert.notEqual(w.IrunaWikiData.evidence.get('CR000379').description,w.IrunaWikiData.evidence.get('IW00011587').description);
 assert(merged.drops.some(x=>x['モンスターID']==='MON000213'&&x['アイテムID']==='IW00011587'));
 assert(!merged.drops.some(x=>x['モンスターID']==='MON000213'&&x['アイテムID']==='CR000379'));
 assert(!w.IRUNA_WIKI_DATA.effects.some(x=>x['アイテムID']==='IW00011587'));
});
test('Cloak stages match individual descriptions and only normal Cloak gets the boss drop',()=>{
 for(const id of ['AD000193','AD000194','AD000195']){
  const old=db.items.find(x=>x['アイテムID']===id),next=w.IrunaWikiData.overlayItem(old),e=w.IrunaWikiData.evidence.get(id);
  assert.equal(e.description.replace(/\s/g,''),old['説明文'].replace(/\s/g,''));
  for(const field of ['基礎DEF','基礎ATK','特殊性能','説明文'])assert.equal(next[field],old[field]);
 }
 const drops=merged.drops.filter(x=>x['モンスターID']==='MON000581'&&['AD000193','AD000194','AD000195'].includes(x['アイテムID']));
 assert.equal(drops.length,1);assert.equal(drops[0]['アイテムID'],'AD000193');
});
test('additional equipment audit reuses IDs, separates L/R and keeps uncertain Picus held',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'data/wiki-coverage.json'),'utf8')),batch=report.followUpV3064;
 assert.equal(batch.items.length,11);assert.equal(batch.addedDrops.length,13);assert.deepEqual(batch.reverifiedDrops,['DROP000917']);
 for(const id of batch.items){const old=db.items.find(x=>x['アイテムID']===id),next=w.IrunaWikiData.overlayItem(old),e=w.IrunaWikiData.evidence.get(id);
  assert.equal(e.description.normalize('NFKC').replace(/\s/g,''),old['説明文'].normalize('NFKC').replace(/\s/g,''));
  for(const field of ['名前','基礎ATK','基礎DEF','説明文','特殊性能'])assert.equal(next[field],old[field]);
  assert.equal(merged.items.filter(x=>x['アイテムID']===id).length,1);
 }
 for(const id of batch.addedDrops){const d=merged.drops.find(x=>x['ドロップID']===id);assert(d);assert.equal(merged.drops.filter(x=>x['モンスターID']===d['モンスターID']&&x['アイテムID']===d['アイテムID']).length,1);for(const k of ['ドロップ枠','ドロップ率(%)','難易度','条件'])assert.equal(d[k],'');}
 assert(merged.drops.some(d=>d['モンスターID']==='MON000589'&&d['アイテムID']==='AD000097'));
 assert(!merged.drops.some(d=>d['モンスターID']==='MON000589'&&d['アイテムID']==='AD000098'));
 for(const id of ['MON000811','MON000812','MON000813'])assert(merged.drops.some(d=>d['モンスターID']===id&&d['アイテムID']==='AD000065'));
 assert(report.held.some(x=>x.id===8957));assert(report.unmatchedDrops.some(x=>x.monster===209&&x.name==='キャスケット'));
 assert(!w.IrunaWikiData.evidence.has('AD000170'));
});
test('verified Nut relationship groups duplicate evidence without changing IDs, rates or recipes',()=>{
 const model=w.IrunaCatalogModel,rows=merged.drops.filter(x=>x['モンスターID']==='MON000522'),before=JSON.stringify(rows);
 const groups=model.groupDrops(merged,rows);assert.equal(groups.length,4);assert.equal(rows.length,5);
 const nut=groups.find(g=>g.some(x=>x['アイテムID']==='MAT000060'));assert.equal(nut.length,2);
 assert.deepEqual([...model.relatedItemIds(merged,'MAT000060')].sort(),['IW00000186','MAT000060']);assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(clean(merged.materials),clean(base.materials));
 const a=clean(nut[0]),b=clean(nut[1]);
 for(const field of ['モンスターID','ドロップ枠','ドロップ率(%)','難易度','条件','イベントID']){
  const other={...b,[field]:field==='ドロップ率(%)'?0:'別条件'};assert.equal(model.groupDrops(merged,[a,other]).length,2);
 }
 assert.equal(model.groupDrops({...merged,itemAliases:[]},nut).length,2);
 const bad=clean(merged);bad.itemAliases[0].canonicalId='missing';assert.throws(()=>model.validate(bad));
});
test('Japanese snapshot references, counts and evidence IDs are valid',()=>{assert.equal(merged.drops.length,11813);assert.equal(merged.monsters.length,3227);assert.equal(merged.maps.length,628);assert.equal(merged.spawns.length,3435);assert.equal(w.IrunaWikiData.evidence.size,6508);assert.equal(new Set(w.IRUNA_WIKI_DATA.itemUpdates.map(r=>r['アイテムID'])).size,5252);assert.equal(w.IrunaCatalogModel.validate(merged),merged);const report=JSON.parse(fs.readFileSync(path.join(root,'data/wiki-coverage.json'),'utf8'));for(const [k,n]of Object.entries(report.totals))assert.equal(merged[k].length,n);assert.equal(report.counts.sourceMonsters,3706);assert(report.skipped.some(r=>r.kind==='item'));assert(report.held.length>0);});
test('existing numerical properties and effects remain intact; sparse updates do not erase descriptions',()=>{let filled=0,retained=0;for(const item of db.items){const next=w.IrunaWikiData.overlayItem(item),update=w.IRUNA_WIKI_DATA.itemUpdates.find(r=>r['アイテムID']===item['アイテムID']);for(const key of ['アイテムID','分類','武器種','属性ID','基礎ATK','基礎DEF','装着可能箇所','特殊性能'])assert.deepEqual(next[key],item[key]);if(!update||!Object.hasOwn(update,'説明文')){assert.equal(next['説明文'],item['説明文']);retained++;}else filled++;}assert(filled>0&&retained>4000);const effects=w.IrunaWikiData.mergeEffects(db.effects);assert.equal(effects.length,db.effects.length+6);assert.deepEqual(clean(effects.slice(0,db.effects.length)),db.effects);assert.equal(w.IrunaWikiData.mergeEffects(effects).length,effects.length);const patch=w.IRUNA_WIKI_DATA.itemUpdates.find(r=>r['説明文']);assert.equal(w.IrunaWikiData.overlayItem({'アイテムID':patch['アイテムID'],'説明文':'後から確認した具体的な説明'} )['説明文'],'後から確認した具体的な説明');for(const id of ['IW00000098','IW00000317','IW00013054','IW00013087','IW00012598'])assert.equal(w.IrunaWikiData.evidence.get(id).description,'');});
test('boss crystals have links to Japanese monsters/maps and unknown rates stay unknown',()=>{const crystals=new Set(merged.items.filter(i=>i['分類']==='クリスタ').map(i=>i['アイテムID'])),boss=new Set(merged.monsters.filter(m=>m['種別']==='ボス').map(m=>m['モンスターID']));const drops=merged.drops.filter(d=>crystals.has(d['アイテムID'])&&boss.has(d['モンスターID']));assert(drops.length>200);assert(new Set(drops.map(d=>d['アイテムID'])).size>180);for(const d of w.IRUNA_WIKI_DATA.drops)assert.equal(d['ドロップ率(%)'],'');for(const r of [...w.IRUNA_WIKI_DATA.maps,...w.IRUNA_WIKI_DATA.monsters])assert(/[ぁ-んァ-ヶ一-龯]/.test(r['マップ名']||r['名前']));assert(merged.maps.some(m=>m['期間限定']));const g=merged.items.find(i=>i['名前']==='◇ガンエイ'&&i['分類']==='クリスタ');assert(merged.drops.some(d=>d['アイテムID']===g['アイテムID']));});
test('drop evidence cannot replace identities, rates or conditions',()=>{for(const field of ['アイテムID','モンスターID','ドロップ率(%)','条件']){const extra=clean(w.IRUNA_WIKI_DATA);extra.updates.drops[0][field]=field==='ドロップ率(%)'?100:'wrong';assert.throws(()=>w.IrunaCatalogModel.mergeLocations(base,extra));}});
test('packed data and integration scripts parse; current shell files exist',()=>{for(const f of ['data/wiki.js','js/wiki-data.js','js/location-browser.js','js/catalog.js','js/item-filters.js','js/app-v3.0.55.js','js/config-v3.0.69.js','service-worker.js'])new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});const snapshot=require('../tools/wiki-snapshot.cjs'),expanded=snapshot.unpack(fs.readFileSync(path.join(root,'data/wiki.js'),'utf8'));assert.deepEqual(snapshot.unpack(snapshot.pack(expanded)),expanded);const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const p of ['data/wiki.js','js/wiki-data.js']){assert(sw.includes(p));assert(html.includes(p));}});
