const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),root=path.resolve(__dirname,'..'),ctx={window:{}};
for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','js/wiki-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const w=ctx.window,d=w.IrunaWikiData.mergeCatalog(w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA)),db=JSON.parse(fs.readFileSync(path.join(root,'data/db.json'))).data,proof=JSON.parse(fs.readFileSync(path.join(root,'data/reconciled-drops-v3.0.68.json')));
test('new equipment stages are searchable separately and cannot enter a calculation with missing effects',()=>{
 for(const [id,name]of [['JP000001','マーマンシルト'],['JP000002','フラムブラゾン(強化1)'],['JP000003','プライアハット(強化1)']]){const i=d.items.find(i=>i['アイテムID']===id);assert.equal(i['名前'],name);assert(w.IrunaWikiData.isCatalogOnly(i));assert(w.IrunaWikiData.isCatalogOnly({'アイテムID':id}));assert.equal(i['分類'],'追加');assert(w.IrunaWikiData.evidence.has(id));}
 assert.equal(d.items.find(i=>i['アイテムID']==='JP000001')['基礎DEF'],'');
 for(const id of ['AD000314','AD000640']){assert(!w.IrunaWikiData.isCatalogOnly({'アイテムID':id}));const old=db.items.find(i=>i['アイテムID']===id);for(const k of ['名前','基礎ATK','基礎DEF','説明文','特殊性能'])assert.equal(w.IrunaWikiData.overlayItem(old)[k],old[k]);}
 const source=fs.readFileSync(path.join(root,'js/app-v3.0.55.js'),'utf8'),body=source.match(/function itemMatchesSlot\(item, slot\) \{([\s\S]*?)\n  \}/)[1],matches=vm.runInNewContext('(function(item,slot){'+body+'})',ctx);
 assert(!matches({'アイテムID':'JP000002','分類':'追加'},{category:'追加'}));assert(matches({'アイテムID':'AD000314','分類':'追加'},{category:'追加'}));
});
test('article drops retain map/area/Lv and unresolved duplicates are held instead of filled to four',()=>{
 assert.equal(proof.rows.length,35);for(const p of proof.rows){const rows=d.drops.filter(r=>r['モンスターID']===p.monsterId&&r['アイテムID']===p.itemId);assert.equal(rows.length,1);assert.equal(rows[0]['ドロップID'],p.dropId);assert.equal(rows[0]['ドロップ率(%)'],'');assert.equal(rows[0]['ドロップ枠'],'');assert(d.spawns.some(s=>s['モンスターID']===p.monsterId&&s['マップID']===p.mapId));}
 for(const name of ['カラベビ','センパスチル','カラベラ','テウクリア','ハートリス','ヘルムグラーキレ','ガルネパンツァ','サンドリス']){const m=d.monsters.find(m=>m['名前']===name);assert.equal(d.drops.filter(r=>r['モンスターID']===m['モンスターID']).length,4);}
 const fish=d.monsters.find(m=>m['名前']==='魚兵');assert.equal(d.drops.filter(r=>r['モンスターID']===fish['モンスターID']).length,3);assert(!d.drops.some(r=>r['モンスターID']===fish['モンスターID']&&['IW00000099','MAT000255'].includes(r['アイテムID'])));
 const none=d.monsters.find(m=>m['名前']==='音波の陣');assert.equal(d.drops.filter(r=>r['モンスターID']===none['モンスターID']).length,0);
 assert(!d.monsters.some(m=>m['名前']==='フタコポス'));assert(proof.held.some(h=>h.name==='フタコポス'));
 const sea=d.maps.filter(m=>m['マップ名']==='マリーン珊晶宮');assert.deepEqual(Array.from(sea,m=>m['エリア']).sort(),['エリア1〜2','表座敷']);
});
