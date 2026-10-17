const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const model = require('../js/catalog-model.js');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data/catalog.js'),'utf8'),context);
const data = JSON.parse(JSON.stringify(context.window.IRUNA_CATALOG_DATA));
test('snapshot references and IDs are valid; no existing DB ID collision', () => {
  assert.equal(model.validate(data), data);
  const db = JSON.parse(fs.readFileSync(path.join(root,'data/db.json'),'utf8'));
  const existing = new Set(db.data.items.map(i=>i['アイテムID']));
  for(const item of data.items.filter(i=>existing.has(i['アイテムID']))) {
    const original=db.data.items.find(i=>i['アイテムID']===item['アイテムID']);
    assert.equal(item['名前'],original['名前']); assert.equal(item['分類'],original['分類']);
  }
  assert.equal(data.recipes.length,3570); assert.equal(data.drops.length,3);
  for(const field of model.fields) {
    const recipes=data.recipes.filter(r=>r['生産分野']===field);
    assert(recipes.length>0);
    assert(recipes.every(r=>r['レシピLv']>=1 && r['レシピLv']<=265));
    assert.equal(Math.max(...recipes.map(r=>r['レシピLv'])),265);
    for(const r of recipes){
      if(String(r['確認状態']).startsWith('要確認')) {assert(!model.canCraft(r,{levels:Object.fromEntries(model.fields.map(f=>[f,999]))}));continue;}
      assert(data.materials.some(m=>m['レシピID']===r['レシピID']));
      assert(data.results.some(m=>m['レシピID']===r['レシピID']&&m['結果区分']===(r['生産種別']==='強化'?'強化':'通常')));
    }
  }
});
test('every imported source row maps to an existing recipe and coverage totals match', () => {
  const report=JSON.parse(fs.readFileSync(path.join(root,'data/recipe-coverage.json'),'utf8'));
  assert.equal(report.sourceCoverage.length,3528);assert.equal(report.stats.total,data.recipes.length);
  const ids=new Set(data.recipes.map(r=>r['レシピID']));
  assert(report.sourceCoverage.every(r=>ids.has(r.recipeId)));
  assert.equal(report.pending.length,3);assert.equal(report.stats.confirmed,3567);
});
test('bad references, duplicate IDs and unknown probability are distinguished', () => {
  const bad=structuredClone(data);bad.materials[0]['素材アイテムID']='missing';assert.throws(()=>model.validate(bad));
  const duplicate=structuredClone(data);duplicate.items.push(duplicate.items[0]);assert.throws(()=>model.validate(duplicate));
  assert(data.drops.every(d=>d['ドロップ率(%)']===''));
});
test('craft boundary is own field level plus ten, inclusive', () => {
  const s=model.defaults(),r={'生産分野':'鍛冶','レシピLv':10};
  assert(model.canCraft(r,s));r['レシピLv']=11;assert(!model.canCraft(r,s));
  s.levels['調理']=999;assert(!model.canCraft(r,s));s.levels['鍛冶']=1;assert(model.canCraft(r,s));
});
test('favorite ordering is stable and respects bounds', () => {
  assert.deepEqual(model.moveFavorite(['a','b','c'],'b',-1),['b','a','c']);
  assert.deepEqual(model.moveFavorite(['a','b'],'a',-1),['a','b']);
  assert.deepEqual(model.moveFavorite(['a','b'],'missing',1),['a','b']);
});
test('secondary production levels are enforced, including previously held star drops', () => {
  const r=data.recipes.find(r=>r['レシピ名']==='星の雫（鍛冶Lv10）');
  assert(r['有効']);assert.equal(model.requiredLevels(r)['錬金術'],10);
  const s=model.defaults();s.levels['鍛冶']=10;assert(!model.canCraft(r,s));
  s.levels['錬金術']=9;assert(!model.canCraft(r,s));s.levels['錬金術']=10;assert(model.canCraft(r,s));
  const bad=structuredClone(data);bad.recipes[0]['他必要Lv']='{"unknown":1}';assert.throws(()=>model.validate(bad));
});
test('recipe references have no invented equipment stats and cannot be selected for a build', () => {
  const refs=data.items.filter(i=>i['アイテムID'].startsWith('REF'));
  assert(refs.length>0);for(const i of refs){assert.equal(i['基礎ATK'],'');assert.equal(i['基礎DEF'],'');assert.equal(i['表示分類'],'生産参照専用');}
  const app=fs.readFileSync(path.join(root,'js/app-v3.0.55.js'),'utf8');
  const filter=app.match(/function itemMatchesSlot\(item, slot\)\s*\{[\s\S]*?\n  \}/)[0];
  const testContext={window:{}};vm.runInNewContext(filter,testContext);
  for(const item of refs)assert.equal(testContext.itemMatchesSlot(item,{category:item['分類']}),false);
  for(let n=1;n<=212;n++)assert(data.recipes.some(r=>r['レシピID']==='REC'+String(n).padStart(6,'0')));
});
test('production settings join environment allowlist and validate without modifying old storage keys', () => {
  const values=new Map([['other','keep']]);
  const storage={get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const ctx={window:{IRUNA_CONFIG:{APP_VERSION:'3.0.55'}},localStorage:storage};
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/environment.js'),'utf8'),ctx);
  const env=ctx.window.IrunaEnvironment,s=model.defaults();s.levels['鍛冶']=12;s.favorites=['REC000003','REC000001'];
  assert(env.isAllowed(model.key));env.validateValue(model.key,JSON.stringify(s));
  storage.setItem(model.key,JSON.stringify(s));assert.equal(env.capture()[model.key],JSON.stringify(s));
  s.levels['鍛冶']=-1;assert.throws(()=>env.validateValue(model.key,JSON.stringify(s)));
  s.levels['鍛冶']=0;s.favorites=['same','same'];assert.throws(()=>env.validateValue(model.key,JSON.stringify(s)));
  assert.equal(storage.getItem('other'),'keep');
  const memoKey='irunadb.itemMemo.v1',memo=[{id:'memo-1',name:'赤鉄鉱',done:false}];
  assert(env.isAllowed(memoKey));env.validateValue(memoKey,JSON.stringify(memo));
  storage.setItem(memoKey,JSON.stringify(memo));assert.equal(env.capture()[memoKey],JSON.stringify(memo));
  assert.throws(()=>env.validateValue(memoKey,JSON.stringify([{id:'x',name:'',done:false}])));
  assert.throws(()=>env.validateValue(memoKey,JSON.stringify([...memo,...memo])));
});
test('all changed scripts parse and app shell/HTML references exist', () => {
  for(const file of ['js/app-v3.0.55.js','js/config-v3.0.59.js','js/item-filters.js','data/item-effects.js','js/item-memo.js','js/navigation.js','js/catalog.js','js/catalog-model.js','js/environment.js','js/modal.js','js/ui.js','data/catalog.js','service-worker.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:href|src)="(\.\/[^"?]+)(?:\?[^" ]*)?"/g))assert(fs.existsSync(path.join(root,match[1])),match[1]);
  const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  for(const file of JSON.parse(sw.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]))assert(fs.existsSync(path.join(root,file)),file);
});
