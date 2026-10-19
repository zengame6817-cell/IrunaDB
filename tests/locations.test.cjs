const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),model=require('../js/catalog-model.js'),ctx={window:{}};
for(const f of ['data/catalog.js','data/locations.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
const base=JSON.parse(JSON.stringify(ctx.window.IRUNA_CATALOG_DATA)),extra=JSON.parse(JSON.stringify(ctx.window.IRUNA_LOCATION_DATA));
const merged=model.mergeLocations(base,extra);
test('source supplement preserves baseline recipe/item data and all references',()=>{
 assert.equal(base.drops.length,3);assert.equal(merged.drops.length,1804);assert.equal(merged.monsters.length,547);assert.equal(merged.maps.length,363);
 assert.deepEqual(merged.recipes,base.recipes);assert.deepEqual(merged.materials,base.materials);assert.deepEqual(merged.results,base.results);
 assert.deepEqual(merged.items.slice(0,base.items.length),base.items);assert.equal(model.validate(merged),merged);
 const db=JSON.parse(fs.readFileSync(path.join(root,'data/db.json'),'utf8')).data.items;
 for(const i of extra.items)assert.deepEqual(i,db.find(d=>d['アイテムID']===i['アイテムID']));
 const report=JSON.parse(fs.readFileSync(path.join(root,'data/location-coverage.json'),'utf8'));for(const t of ['maps','monsters','spawns','drops'])assert.equal(report.total[t],merged[t].length);
});
test('unknown drop rates remain unknown; source IDs and URLs are retained for audit',()=>{
 assert(extra.drops.every(d=>d['ドロップ率(%)']===''&&d['出典ID']==='SRC000021'&&d['出典URL'].startsWith('https://jp.iruna-online.info/iruna/item/')));
 assert(extra.maps.every(m=>!m['期間限定']));assert(extra.monsters.every(m=>Number.isInteger(m['Lv下限'])&&m['Lv下限']>=1));
 const ids=new Set(merged.drops.filter(d=>merged.items.find(i=>i['アイテムID']===d['アイテムID'])?.['名前']==='赤鉄鉱').map(d=>d['モンスターID']));assert(ids.size>1);
 assert(merged.maps.find(m=>m['マップID']==='MAP000002')['確認状態'].startsWith('要確認'));
});
test('bad supplement fails before replacing the baseline',()=>{
 const before=JSON.stringify(base);const dup=structuredClone(extra);dup.maps.push(base.maps[0]);assert.throws(()=>model.mergeLocations(base,dup));
 const missing=structuredClone(extra);missing.spawns[0]['モンスターID']='missing';assert.throws(()=>model.mergeLocations(base,missing));
 const swapped=structuredClone(extra);swapped.updates.maps[0]['マップ名']='別のマップ';assert.throws(()=>model.mergeLocations(base,swapped));
 const overwritten=structuredClone(extra);overwritten.updates.items=[base.items[0]];assert.throws(()=>model.mergeLocations(base,overwritten));
 assert.equal(JSON.stringify(base),before);
});
test('monster level gaps and unknown values cannot become an invented range',()=>{
 for(const pair of [[0,1],[10,9],['',10],[-1,1],[1.5,2]]){const d=structuredClone(merged);[d.monsters[0]['Lv下限'],d.monsters[0]['Lv上限']]=pair;assert.throws(()=>model.validate(d));}
 const unknown=structuredClone(merged);unknown.monsters[0]['Lv下限']=unknown.monsters[0]['Lv上限']='';assert.equal(model.validate(unknown),unknown);
 const daz=merged.monsters.filter(m=>m['名前']==='ダズル');assert(daz.some(m=>m['Lv下限']===113&&m['Lv上限']===113));assert(daz.some(m=>m['Lv下限']===116));
});
test('current scripts and service worker point to one release version',()=>{
 for(const f of ['data/locations.js','js/location-browser.js','js/config-v3.0.77.js','js/catalog.js','js/catalog-model.js','service-worker.js'])new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 assert(html.includes('config-v3.0.77.js'));assert(sw.includes('config-v3.0.77.js'));assert(html.includes('data/locations.js'));assert(sw.includes('data/locations.js'));
 for(const f of JSON.parse(sw.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]))assert(fs.existsSync(path.join(root,f)),f);
});
