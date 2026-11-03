const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('new stages appear once in the catalog and cannot be equipped before calculation is verified',()=>{
 const root=path.join(__dirname,'..'),c={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','data/equipment-v3.0.87.js','js/wiki-data.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),c);
 const w=c.window,items=w.IRUNA_EQUIPMENT_3087,merged=w.IrunaWikiData.mergeCatalog(w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA)),db=require('../data/db.json').data;
 assert.equal(items.length,7);for(const i of items){assert.equal(merged.items.filter(x=>x['アイテムID']===i['アイテムID']).length,1);assert(!db.items.some(x=>x['アイテムID']===i['アイテムID']||x['名前'].normalize('NFKC')===i['名前'].normalize('NFKC')));assert(w.IrunaWikiData.isCatalogOnly(i));}
 assert.match(items[1]['説明文'],/光耐性\+8%/);assert.equal(items[0]['スロット数'],1);assert.equal(items[2]['スロット数'],'');
});
