'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..'),report=require('../data/reconciled-drops-v3.0.72.json'),db=require('../data/db.json').data;
function context(data){const c={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),c);if(data)c.window.IRUNA_WIKI_DATA=data;vm.runInNewContext(fs.readFileSync(path.join(root,'js/wiki-data.js'),'utf8'),c);return c;}
test('new Japanese crystal facts add only verified flat AGI and DEX; unsupported weapons cannot be selected',()=>{
 const c=context(),w=c.window,all=w.IrunaWikiData.mergeEffects(db.effects),items=w.IRUNA_WIKI_DATA.items;
 const code=fs.readFileSync(path.join(root,'js/app-v3.0.55.js'),'utf8').match(/function itemMatchesSlot\(item, slot\)\s*\{[\s\S]*?\n  \}/)[0];vm.runInNewContext(code,c);
 const crystals=report.newItems.filter(x=>x.type==='クリスタ');assert.equal(crystals.length,9);
 for(const r of crystals){const i=items.find(x=>x['アイテムID']===r.id);assert(c.itemMatchesSlot(i,{category:'クリスタ'}));const v=all.filter(e=>e['アイテムID']===r.id);const expected=[...r.description.matchAll(/(AGI|DEX)\+(\d+)/g)];assert.equal(v.length,expected.length);for(const m of expected){const e=v.find(x=>x['能力ID']===m[1]);assert.equal(e['値'],+m[2]);assert.equal(e['単位'],'');assert.equal(e['条件グループID'],'');}}
 for(const r of report.newItems.filter(x=>x.catalogOnly)){const i=items.find(x=>x['アイテムID']===r.id);assert(!c.itemMatchesSlot(i,{category:'武器'}));assert.equal(i['基礎DEF'],'');}
 assert.deepEqual(JSON.parse(JSON.stringify(all.slice(0,db.effects.length))),db.effects);
});
test('new crystal imports reject altered value, percent unit, stat, formula, condition and absent source',()=>{
 const data=context().window.IRUNA_WIKI_DATA;
 for(const patch of [{'値':99},{'単位':'%'},{'能力ID':'STR'},{'数式':'Lv*2'},{'条件グループID':'X'}]){const x=structuredClone(data);Object.assign(x.effects.find(e=>e['効果ID']==='JPEFF000012_AGI'),patch);assert.throws(()=>context(x).window.IrunaWikiData.mergeEffects([]));}
 const x=structuredClone(data);x.evidence.find(e=>e.id==='JP000012').url='';assert.throws(()=>context(x).window.IrunaWikiData.mergeEffects([]));
});
test('32 former audit rows are represented by 16 lowest-level map-specific links without invented probabilities',()=>{
 const w=context().window,d=w.IrunaWikiData.mergeCatalog(w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA));assert.equal(report.newItems.length,14);assert.equal(report.rows.length,16);assert.equal(report.coveredOldAuditRows.length,32);
 const keys=new Set();for(const r of report.rows){const key=r.name+'|'+r.monsterName+'|'+r.mapName;assert(!keys.has(key));keys.add(key);const m=d.monsters.find(x=>x['モンスターID']===r.monsterId);assert.equal(m['Lv下限'],r.level);assert.equal(m['Lv上限'],r.level);const drop=d.drops.find(x=>x['ドロップID']===r.dropId);assert.equal(drop['アイテムID'],r.itemId);for(const k of ['ドロップ率(%)','ドロップ枠','条件'])assert.equal(drop[k],'');}
 const polyps=report.rows.filter(x=>x.name==='◇AGI・DEX+4');assert.equal(polyps.length,2);assert.deepEqual(polyps.map(x=>x.level).sort((a,b)=>a-b),[260,272]);assert(d.monsters.some(m=>m['名前']==='ポリプス'&&m['Lv下限']===278));
 const newIds=new Set(report.newItems.map(x=>x.id));assert(!db.items.some(i=>newIds.has(i['アイテムID'])));assert.equal(newIds.size,14);
});
