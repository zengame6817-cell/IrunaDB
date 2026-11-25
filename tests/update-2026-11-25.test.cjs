'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('November 25 image facts, forge chains and acquisition links reach the catalog without duplicates',()=>{
 const c={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','data/equipment-v3.0.87.js','data/event-items-v3.0.88.js','data/latest-items-v3.0.94.js','data/november-locations.js','data/forge.js','data/update-2026-11-25.js','js/wiki-data.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),c);
 const w=c.window,d=w.IRUNA_UPDATE_20261125,m=w.IrunaWikiData.mergeCatalog(w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA)),ids=new Set(m.items.map(i=>i['アイテムID']));
 assert.equal(d.items.length,10);assert.equal(d.monsters.length,3);assert.equal(d.forge.length,5);
 for(const i of d.items){assert.equal(m.items.filter(x=>x['アイテムID']===i['アイテムID']).length,1);assert(w.IrunaWikiData.isCatalogOnly(i));assert.equal(i['スロット数'],'');}
 for(const f of d.forge){assert(ids.has(f.to));if(f.from)assert(ids.has(f.from));for(const [name,count,id] of f.materials){assert(ids.has(id),name);assert(Number.isInteger(count)&&count>0);}assert.equal(w.IRUNA_FORGE.filter(x=>x.to===f.to).length,1);}
 const ribbon=d.items.find(i=>i['アイテムID']==='JP000052');assert.equal(ribbon['名前'],'シニョンリボン(強化1)');assert.equal(ribbon['基礎ATK'],10);
 assert.equal(d.forge.find(f=>f.to==='JP000053').from,'JP000056');assert.equal(d.items.find(i=>i['アイテムID']==='JP000056')['名前'],'のぼり(強化1)');
 assert(d.items.find(i=>i['アイテムID']==='JP000050')['説明文'].includes('CRT+30'));
 assert(!d.items.some(i=>i['名前'].includes('(仮)')));assert.equal(d.drops[0]['ドロップ枠'],'');assert(d.drops[0]['条件'].includes('2026年11月26日'));assert(!d.drops.some(x=>x['アイテムID']==='JP000055'));
 const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('data/forge.js')<html.indexOf('data/update-2026-11-25.js'));assert(html.indexOf('data/update-2026-11-25.js')<html.indexOf('js/wiki-data.js'));assert(fs.readFileSync('service-worker.js','utf8').includes('data/update-2026-11-25.js'));
});
