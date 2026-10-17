const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),root=path.resolve(__dirname,'..');
function context(data){const c={window:{}};for(const f of ['data/catalog.js','data/wiki.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),c);if(data)c.window.IRUNA_WIKI_DATA=data;vm.runInNewContext(fs.readFileSync(path.join(root,'js/wiki-data.js'),'utf8'),c);return c;}
test('only individually verified reference crystals can be selected, retaining recipe IDs',()=>{
 const c=context(),w=c.window,api=w.IrunaWikiData;
 const filter=fs.readFileSync(path.join(root,'js/app-v3.0.55.js'),'utf8').match(/function itemMatchesSlot\(item, slot\)\s*\{[\s\S]*?\n  \}/)[0];vm.runInNewContext(filter,c);
 const expected=new Map([['REF000057',1],['REF000073',2],['REF000083',3]]);
 for(const old of w.IRUNA_CATALOG_DATA.items.filter(i=>i['アイテムID'].startsWith('REF'))){const item=api.overlayItem(old),n=expected.get(item['アイテムID']);assert.equal(c.itemMatchesSlot(item,{category:'クリスタ'}),Boolean(n));
  if(n){assert.equal(item['説明文'],'AGI+'+n);assert.equal(item['名前'],'◇AGI+'+n);assert.equal(item['基礎ATK'],'');assert.equal(item['基礎DEF'],'');assert(w.IRUNA_CATALOG_DATA.materials.some(m=>m['素材アイテムID']===item['アイテムID'])||w.IRUNA_CATALOG_DATA.results.some(r=>r['完成アイテムID']===item['アイテムID']));}
 }
 const db=JSON.parse(fs.readFileSync(path.join(root,'data/db.json'))).data;
 const effects=api.mergeEffects(db.effects),again=api.mergeEffects(effects);assert.equal(again.length,effects.length);
 for(const [id,n]of expected){const rows=effects.filter(e=>e['アイテムID']===id);assert.equal(rows.length,1);assert.equal(rows[0]['能力ID'],'AGI');assert.equal(rows[0]['値'],n);assert.equal(rows[0]['単位'],'');assert.equal(rows[0]['条件グループID'],'');}
 assert.equal(effects.filter(e=>expected.has(e['アイテムID'])).reduce((n,e)=>n+e['値'],0),6);
});
test('reference ability import rejects altered value, percent unit, condition and absent source',()=>{
 const source=context().window.IRUNA_WIKI_DATA;
 for(const patch of [{'値':9},{'単位':'%'},{'条件グループID':'unknown'},{'能力ID':'STR'}]){const data=structuredClone(source);Object.assign(data.effects.find(e=>e['効果ID']==='REFEFF000057'),patch);assert.throws(()=>context(data).window.IrunaWikiData.mergeEffects([]));}
 const data=structuredClone(source);data.verifiedReferences[0].url='';assert.throws(()=>context(data));
});
