const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..');
const ctx={window:{},document:{getElementById:()=>({})}};
for(const f of ['js/utils.js','data/catalog.js','data/locations.js','data/wiki.js','js/item-filters.js','js/wiki-data.js','js/ui.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const w=ctx.window,db=JSON.parse(fs.readFileSync(path.join(root,'data/db.json'),'utf8')).data,ids=new Set(db.items.map(i=>i['アイテムID'])),extra=[...w.IRUNA_CATALOG_DATA.items,...w.IRUNA_LOCATION_DATA.items,...w.IRUNA_WIKI_DATA.items],runtime=[...db.items,...extra.filter(i=>i['有効']!==false&&!ids.has(i['アイテムID']))].map(w.IrunaItemFilters.overlay).map(w.IrunaWikiData.overlayItem),report=JSON.parse(fs.readFileSync(path.join(root,'data/master-coverage.json'),'utf8'));
test('every master equipment/crystal/al-crystal/relic ID is reachable through its category tab',()=>{
 assert.equal(report.targetRows,4871);assert.equal(new Set(runtime.map(i=>i['アイテムID'])).size,runtime.length);
 let checked=0;for(const [category,expected]of Object.entries(report.byCategory)){const found=new Set(w.IrunaUi.filterItems(runtime,category,'',new Map()).map(i=>i['アイテムID']));for(const id of expected){assert(found.has(id),category+': '+id);checked++;}}
 assert.equal(checked,4871);
});
test('legacy armor labels use display/subcategory while search and unrelated categories remain intact',()=>{
 const armor=runtime.filter(i=>i['分類']==='防具');assert.equal(armor.length,473);
 const body=w.IrunaUi.filterItems(armor,'体','',new Map()),additional=w.IrunaUi.filterItems(armor,'追加','',new Map());assert.equal(body.length,272);assert.equal(additional.length,201);
 assert.equal(w.IrunaUi.filterItems(armor,'クリスタ','',new Map()).length,0);
 const one=body[0],index=new Map([[one['アイテムID'],'found']]);assert.equal(w.IrunaUi.filterItems(armor,'体','found',index).length,1);assert.equal(w.IrunaUi.filterItems(armor,'体','absent',index).length,0);
});
test('coverage audit does not add a duplicate special-slot MaxHP effect to Ganei',()=>{
 const effects=w.IrunaWikiData.mergeEffects(db.effects).filter(e=>e['アイテムID']==='CR000162'&&e['能力ID']==='MaxHP'&&e['値']===30);
 assert.equal(effects.length,1);assert.equal(effects[0]['効果ID'],'CREFF000440');
 const group=db.conditions.filter(c=>c['条件グループID']===effects[0]['条件グループID']);assert(group.some(c=>c['比較値ID']==='特殊'));
});
