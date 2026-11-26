'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const paths=['data/update-2026-11-25.js','data/november-locations.js','data/update-2026-11-25-evidence.json','docs/november-catalog-2026-11-23.md'];
test('published November sources never include prohibited third-party article or media URLs',()=>{
 for(const path of paths){
  const contents=fs.readFileSync(path,'utf8');
  assert.doesNotMatch(contents,/pepetaisa|stat\.ameba\.jp/i,path);
 }
});
test('clearing links keeps registered equipment, recipes and monster drops',()=>{
 const context={window:{IRUNA_FORGE:[]}};
 vm.runInNewContext(fs.readFileSync('data/update-2026-11-25.js','utf8'),context);
 const update=context.window.IRUNA_UPDATE_20261125;
 assert.equal(update.items.length,10);
 assert.equal(update.forge.length,5);
 const location={window:{}};
 vm.runInNewContext(fs.readFileSync('data/november-locations.js','utf8'),location);
 assert.equal(location.window.IRUNA_NOVEMBER_LOCATIONS.drops.length,16);
});
