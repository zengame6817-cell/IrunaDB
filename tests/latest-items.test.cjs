'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..');
test('November items reach catalog once, preserve image uncertainty and stay out of unverified calculations',()=>{
 const c={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','data/equipment-v3.0.87.js','data/event-items-v3.0.88.js','data/latest-items-v3.0.94.js','js/wiki-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),c);
 const w=c.window,items=w.IRUNA_LATEST_ITEMS_3094,merged=w.IrunaWikiData.mergeCatalog(w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA));w.IrunaCatalogModel.validate(merged);
 const base=require('../data/db.json').data.items;
 for(const i of items){assert.equal(merged.items.filter(x=>x['アイテムID']===i['アイテムID']).length,1);assert(w.IrunaWikiData.isCatalogOnly(i));assert(!base.some(x=>x['アイテムID']===i['アイテムID']));if(['武器','特殊','追加'].includes(i['分類']))assert.equal(i['スロット数'],'');}
 const e=require('../data/latest-items-evidence-v3.0.94.json');assert.equal(e.items.length,items.length);assert(e.unresolved.some(x=>x.field==='ドロップ順'));assert.equal(items.find(i=>i['名前']==='氷晶のブローチ')['基礎DEF'],'');assert.equal(items.find(i=>i['名前']==='EPスキップの書')['入手区分'],'ショップ');
 for(const f of ['index.html','service-worker.js'])assert(fs.readFileSync(path.join(root,f),'utf8').includes('latest-items-v3.0.94.js'));
});
