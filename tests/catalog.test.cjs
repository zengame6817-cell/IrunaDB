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
  assert(data.items.every(i=>!existing.has(i['アイテムID'])));
  assert.equal(data.recipes.length,3); assert.equal(data.drops.length,3);
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
});
test('all changed scripts parse and app shell/HTML references exist', () => {
  for(const file of ['js/app-v3.0.55.js','js/config-v3.0.55.js','js/catalog.js','js/catalog-model.js','js/environment.js','js/modal.js','js/ui.js','data/catalog.js','service-worker.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const match of html.matchAll(/(?:href|src)="(\.\/[^"?]+)(?:\?[^" ]*)?"/g))assert(fs.existsSync(path.join(root,match[1])),match[1]);
  const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  for(const file of JSON.parse(sw.match(/const APP_SHELL = (\[[\s\S]*?\]);/)[1]))assert(fs.existsSync(path.join(root,file)),file);
});
