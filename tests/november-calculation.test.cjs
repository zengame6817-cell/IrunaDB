'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),app=read('js/app-v3.0.55.js'),db=JSON.parse(read('data/db.json')).data;
function load(change){const c={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','data/equipment-v3.0.87.js','data/event-items-v3.0.88.js','data/latest-items-v3.0.94.js'])vm.runInNewContext(read(f),c);if(change)change(c.window.IRUNA_LATEST_ITEMS_3094);for(const f of ['js/november-calculation.js','js/wiki-data.js'])vm.runInNewContext(read(f),c);return c;}
const selection=app.slice(app.indexOf('  function allSelectedSourceEntries() {'),app.indexOf('\n  function allSelectedIds()'));
const totals=app.slice(app.indexOf('  const STAT_NAME_ALIASES ='),app.indexOf('\n  function selectedItemName('));
function runtime(special='JP000038'){
 const c=load(),w=c.window;c.state={items:[],effects:[],status:{jobId:''},selectedSkills:new Set()};w.IrunaItemFilters={overlay:i=>i};
 // Exercise the production data-import path used by both API and static DB loads.
 c.data=structuredClone(db);const start=app.indexOf('    Object.assign(state, data);'),end=app.indexOf('    mergeJobMaster();',start);vm.runInNewContext(app.slice(start,end),c);
 const keys=['weapon','body','additional','special','decoration'];c.SLOT_DEFS=keys.map(key=>({key,label:key}));
 c.state.build={weapon:'JP000037',body:null,additional:'JP000040',special,decoration:null,stars:Object.fromEntries(keys.map(k=>[k,null])),crystals:{weapon:['JP000042','JP000042'],body:[],additional:['JP000041'],special:[],decoration:[]},equipmentSettings:Object.fromEntries(keys.map(k=>[k,{slots:2}])),alCrystas:[],buildRelics:[]};
 c.context={itemsById:new Map(c.state.items.map(i=>[i['アイテムID'],i])),effectsByItem:new Map(),statMap:new Map(db.stats.map(s=>[s['能力ID'],s])),conditionMap:new Map()};
 for(const e of c.state.effects){const id=e['アイテムID'];if(!c.context.effectsByItem.has(id))c.context.effectsByItem.set(id,[]);c.context.effectsByItem.get(id).push(e);}
 Object.assign(c,{getEquipmentSettings:k=>c.state.build.equipmentSettings[k],isBlank:v=>v==null||v==='',isFormulaEffect:e=>e['効果種類']==='数式'||Boolean(e['数式']),effectMatchesEquipmentSlot:()=>true,calculateEffectiveStatus:()=>({status:{},deltas:[]}),collectSelectedSkillEffects:()=>({rows:[],text:[],selected:[]}),collectRelicBoardBonuses:()=>({rows:[]}),collectApostoriaLineBonuses:()=>({rows:[]})});
 vm.runInNewContext(selection+totals,c);return c;
}
const sum=(c,name,unit)=>{const r=c.collectTotalData().rows.find(r=>c.displayStatName(r.statId)===name&&r.unit===unit);return r?.value||0;};
test('six image-verified items enter the real import path and correct equipment/crystal pickers',()=>{
 const c=runtime(),w=c.window;vm.runInNewContext(app.match(/function itemMatchesSlot\(item, slot\)\s*\{[\s\S]*?\n  \}/)[0],c);
 for(const i of w.IRUNA_LATEST_ITEMS_3094){const item=c.state.items.find(x=>x['アイテムID']===i['アイテムID']);assert(item);assert.equal(c.state.items.filter(x=>x['アイテムID']===i['アイテムID']).length,1);const supported=Number(i['アイテムID'].slice(2))<=42;assert.equal(w.IrunaWikiData.isCatalogOnly(item),!supported);assert.equal(c.itemMatchesSlot(item,{category:item['分類']}),supported);if(supported)assert.equal(item['計算対象'],true);}
 const catalog=w.IrunaWikiData.mergeCatalog(w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA));assert.equal(catalog.items.filter(i=>i['アイテムID']==='JP000037').length,1);
});
test('actual aggregate adds fixed percentages, seconds and each equipped crystal occurrence without duplicate effects',()=>{
 const c=runtime();for(const [n,v,u]of [['ATK',25,'%'],['物理耐性',10,'%'],['出血発生',10,'%'],['出血ダメージ',25,'%'],['水魔法威力',10,'%'],['オートスキル発動率',5,'%'],['MATK',20,'%'],['ブリザード威力',20,'%'],['詠唱時間',-20,'%'],['スペルバースト率',10,'%'],['クリティカルダメージ',10,'%'],['DEX',60,'']])assert.equal(sum(c,n,u),v,n);
 const m=c.window.IrunaNovemberCalculation,once=m.mergeEffects(c.state.effects);assert.equal(m.mergeEffects(once).length,once.length);assert.deepEqual(JSON.parse(JSON.stringify(once.slice(0,db.effects.length))),db.effects);
 c.state.build.weapon=null;c.state.build.equipmentSettings.weapon.slots=0;c.state.build.crystals.weapon=[null,null];assert.equal(sum(c,'ATK','%'),0);assert.equal(sum(c,'DEX',''),0);
 c.state.build.additional=null;c.state.build.equipmentSettings.additional.slots=0;assert.equal(sum(c,'MATK','%'),0);assert.equal(sum(c,'クリティカルダメージ','%'),0);
});
test('resist hide has VIT and seconds, while unknown procs remain explicitly uncalculated and disappear on removal',()=>{
 const c=runtime('JP000039');assert.equal(sum(c,'VIT',''),5);assert.equal(sum(c,'出血時間','秒'),-5);assert.equal(sum(c,'水魔法威力','%'),0);const d=c.collectTotalData();assert(d.textOnly.some(t=>t.includes('未計算：レジストハイド／防御時の確率軽減')));assert(!d.rows.some(r=>/被害軽減|魔法追撃/.test(r.statId)));
 c.state.build.special=null;assert.equal(sum(c,'VIT',''),0);assert(!c.collectTotalData().textOnly.some(t=>t.includes('レジストハイド')));
 assert.match(app, /text\.startsWith\('未計算：'\)\?'未計算':'適用'/);
});
test('changed source facts fail closed; conflicting effect IDs and missing runtime assets are detected',()=>{
 for(const patch of [{'名前':'別装備'},{'説明文':'ATK+99%'},{'分類':'特殊'}])assert.throws(()=>load(items=>Object.assign(items[0],patch)));
 const c=load(),m=c.window.IrunaNovemberCalculation,e=m.mergeEffects([]);assert.equal(e.length,14);assert.throws(()=>m.mergeEffects([{...e[0],'値':99}]));assert(!m.isSupported({'アイテムID':'JP000037','名前':'別装備','分類':'武器'}));
 const html=read('index.html');assert.equal(html.split('./js/november-calculation.js').length-1,1);assert(html.indexOf('november-calculation.js')<html.indexOf('./js/wiki-data.js'));assert(read('service-worker.js').includes('./js/november-calculation.js'));
});
