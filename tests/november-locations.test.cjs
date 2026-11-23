'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('November monsters resolve all 16 drops to existing items without duplicate catalog entries',()=>{
 const c={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','data/equipment-v3.0.87.js','data/event-items-v3.0.88.js','data/latest-items-v3.0.94.js','data/november-locations.js','js/wiki-data.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),c);
 const w=c.window,m=w.IrunaWikiData.mergeCatalog(w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA)),n=w.IRUNA_NOVEMBER_LOCATIONS;
 assert.equal(n.monsters.length,4);assert.equal(n.drops.length,16);assert.equal(n.maps.length,2);
 for(const monster of n.monsters){assert.equal(m.monsters.filter(x=>x['モンスターID']===monster['モンスターID']).length,1);assert.equal(m.drops.filter(x=>x['モンスターID']===monster['モンスターID']).length,4);}
 for(const d of n.drops){assert.equal(m.items.filter(x=>x['アイテムID']===d['アイテムID']).length,1);assert.equal(d['ドロップ率(%)'],'');}
 assert.equal(n.drops.filter(d=>d['ドロップ枠']==='').length,6);
 for(const id of ['JP000044','JP000045','JP000048'])assert.equal(m.items.find(i=>i['アイテムID']===id)['マップ'],'グランツ水林道');
 const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('data/november-locations.js')<html.indexOf('js/wiki-data.js'));assert(fs.readFileSync('service-worker.js','utf8').includes('data/november-locations.js'));
});
