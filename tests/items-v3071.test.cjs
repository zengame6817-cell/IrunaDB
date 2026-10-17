'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..'),ctx={window:{}};
for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','js/wiki-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const a=ctx.window,d=a.IrunaWikiData.mergeCatalog(a.IrunaCatalogModel.mergeLocations(a.IRUNA_CATALOG_DATA,a.IRUNA_LOCATION_DATA)),db=require('../data/db.json').data,p=require('../data/reconciled-drops-v3.0.71.json');
test('individual Japanese equipment reconciliation supplies 26 unique drops at verified monster locations',()=>{
 assert.equal(p.resolved.length,14);assert.equal(p.rows.length,26);assert.equal(p.sources.length,39);
 for(const r of p.rows){const rows=d.drops.filter(x=>x['アイテムID']===r.itemId&&x['モンスターID']===r.monsterId);assert.equal(rows.length,1);assert.equal(rows[0]['ドロップID'],r.dropId);for(const key of ['ドロップ枠','ドロップ率(%)','難易度','条件'])assert.equal(rows[0][key],'');const m=d.monsters.find(x=>x['モンスターID']===r.monsterId);assert.equal(m['名前'],r.monsterName);assert(m['Lv下限']<=r.level&&r.level<=m['Lv上限']);assert(d.spawns.some(s=>s['モンスターID']===r.monsterId&&d.maps.some(m=>m['マップID']===s['マップID']&&m['マップ名']===r.mapName)));}
});
test('same equipment master IDs share acquisition without rewriting abilities or merging upgraded and reference IDs',()=>{
 assert.equal(p.resolved.flatMap(r=>r.aliases).length,12);
 for(const r of p.resolved){for(const id of [r.canonicalId,...r.aliases]){const old=db.items.find(x=>x['アイテムID']===id),next=a.IrunaWikiData.overlayItem(old);for(const key of ['基礎ATK','基礎DEF','特殊性能','タグ概要','分類','名前'])assert.equal(next[key],old[key]);assert(next['入手先']);assert(a.IrunaCatalogModel.relatedItemIds(d,id).has(r.canonicalId));}for(const id of r.excluded){assert(!a.IrunaCatalogModel.relatedItemIds(d,id).has(r.canonicalId));assert(!p.rows.some(x=>x.itemId===id));}}
 assert(!p.resolved.some(r=>r.name==='愛叫マイク'));assert(!p.rows.some(r=>r.itemId==='AD001076'||r.itemId.startsWith('REF')));
});
test('blank descriptions gain Japanese conditions while existing texts and calculation rows remain unchanged',()=>{
 for(const id of ['SP000070','SP000106','SP000105','SP000026']){const old=db.items.find(x=>x['アイテムID']===id);assert.equal(old['説明文'],'');assert(a.IrunaWikiData.overlayItem(old)['説明文']);}
 assert(a.IrunaWikiData.overlayItem(db.items.find(x=>x['アイテムID']==='SP000070'))['説明文'].includes('DEX300以上'));
 const effects=a.IrunaWikiData.mergeEffects(db.effects);assert.deepEqual(JSON.parse(JSON.stringify(effects.slice(0,db.effects.length))),db.effects);
});
