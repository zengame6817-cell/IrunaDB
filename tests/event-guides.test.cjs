'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{},URL};vm.createContext(ctx);
for(const p of ['data/event-guides.js','data/event-loot.js','js/event-guides-model.js'])vm.runInContext(fs.readFileSync(p,'utf8'),ctx);
const D=ctx.window.IRUNA_EVENT_GUIDES,M=ctx.IrunaEventGuidesModel;
test('guides carry distinct ids, real story years, material quantities and scoped sources',()=>{
 assert.equal(D.guides.length,59);assert.equal(D.families.length,10);assert.equal(new Set(D.guides.map(g=>g.id)).size,59);
 for(const g of D.guides){assert(D.families.includes(g.family));assert(g.year===null||(g.year>=2010&&g.year<=2026));assert(g.entry&&g.requirement&&g.unlock);assert(g.steps.length>=2);if (g.source) assert.equal(new URL(g.source).protocol,"https:");for(const x of g.items){assert(x.name);if(!x.archived)assert(Number.isInteger(x.qty)&&x.qty>0);}}
 const g=D.guides.find(g=>g.id==='hw-2020');assert.equal(g.items.length,4);assert.equal(g.items.find(x=>x.name==='ハロウィンかぼちゃ').qty,1);
 assert(D.guides.find(g=>g.id==='val-2024').requirement.includes('2019'));assert(D.guides.find(g=>g.id==='wd-2021').requirement.includes('バレンタイン'));
});
test('search covers prerequisites, year, boss and fullwidth text; source links reject deceptive origins',()=>{
 assert(M.matches(D.guides.find(g=>g.id==='wd-2023'),'３５０'));assert(M.matches(D.guides.find(g=>g.id==='val-2024'),'2019'));
 assert(M.matches(D.guides.find(g=>g.id==='hw-2020'),'ハロウィンスプーン'));assert(!M.matches(D.guides[0],'存在しない素材'));
 for(const url of ['javascript:alert(1)','https://irnsnk.com.evil.test/halloween-event/','https://irnsnk.com@evil.test/halloween-event/','https://irnsnk.com/other/','http://irnsnk.com/halloween-event/','https://irnsnk.com/halloween-event/?x=1'])assert.equal(M.sourceUrl(url),'');
});
test('event checks load defensively and never read or replace MS storage',()=>{
 const keys=[],storage={getItem:k=>{keys.push(k);return k===M.DONE?'["hw-2013",12,null]':'broken';}};
 assert.deepEqual([...M.read(storage,M.DONE)],['hw-2013']);assert.equal(M.read(storage,M.OWNED).size,0);assert(keys.every(k=>k.startsWith('irunadb_event_')));
 assert.equal(M.read({getItem:()=>{throw Error('blocked');}},M.DONE).size,0);
 assert.equal(M.read({getItem:()=>'{"wrong":true}'},M.DONE).size,0);
});
test('environment exports both event checks and rejects malformed imported states',()=>{
 const c={window:{},localStorage:{getItem:()=>null}};vm.createContext(c);vm.runInContext(fs.readFileSync('js/environment.js','utf8'),c);const E=c.window.IrunaEnvironment;
 for(const k of [M.DONE,M.OWNED]){assert(E.isAllowed(k));E.validateValue(k,'["hw-2013"]');for(const bad of ['{}','[12]','["x","x"]','[""]'])assert.throws(()=>E.validateValue(k,bad));}
 const values=new Map([[M.DONE,'["hw-2013"]'],[M.OWNED,'["hw-2020:0"]'],['irunadb_mission_done_v1','["ms-original"]']]);
 const captured=E.capture({get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)});
 assert.equal(captured[M.DONE],'["hw-2013"]');assert.equal(captured['irunadb_mission_done_v1'],'["ms-original"]');
});
test('new view, deep link and offline shell are wired and controller parses',()=>{
 const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('service-worker.js','utf8');assert(html.includes('data-view="events"'));assert(html.includes('id="view-events"'));
 for(const p of ['data/event-guides.js','data/event-loot.js','js/event-guides-model.js','js/event-guides.js','css/event-guides.css']){assert(html.includes(p));assert(sw.includes(p));}
 assert(fs.readFileSync('js/app-v3.0.55.js','utf8').includes('location.hash === "#events"'));new vm.Script(fs.readFileSync('js/event-guides.js','utf8'));
});

test('loot links every item to a guide and preserves actual acquisition methods and requirements',()=>{
 const loot=ctx.window.IRUNA_EVENT_LOOT;assert.equal(loot.length,431);assert.equal(new Set(loot.map(x=>x.id)).size,loot.length);
 const sources=JSON.parse(fs.readFileSync('docs/event-loot-evidence-v3.0.98.json','utf8')).sources;
 for(const x of loot)assert(Object.hasOwn(sources,x.evidence),x.evidence);
 for(const x of loot){assert(D.families.includes(x.family));assert(x.name&&x.place&&x.target&&x.condition&&x.evidence);assert(['ドロップ','交換','抽選','クエスト報酬'].includes(x.method));assert(x.guideIds.every(id=>D.guides.some(g=>g.id===id&&g.family===x.family)));}
 assert.equal(loot.find(x=>x.name==='恋慕の首飾り').condition.includes('ホワイトスイーツ'),true);
 assert.equal(loot.find(x=>x.name==='クッフィアロリタ').condition.includes('ホワイトジュエル'),true);
 assert(loot.find(x=>x.name==='カラベビの卵').condition.includes('50'));
 assert(loot.find(x=>x.name==='イデアレプリカ').target.includes('400'));
});
test('loot search covers place, method, NPC, year and linked story without searching provenance',()=>{
 const loot=ctx.window.IRUNA_EVENT_LOOT,x=loot.find(x=>x.name==='エカトラミンキ');
 for(const q of ['２０２６','星降りの果て','テウクリア','ドロップ','長い永い'])assert(M.lootMatches(x,q,D.guides));
 assert(!M.lootMatches(x,'daifuku',D.guides));
 assert(!M.lootMatches(x,'2025',D.guides));
});
test('event renderer contains no outward source links, author labels or checking dates',()=>{
 const ui=fs.readFileSync('js/event-guides.js','utf8');for(const forbidden of ['event-source','確認日','えーへい','g.source','data.checkedAt','https://'])assert(!ui.includes(forbidden));
 const html=fs.readFileSync('index.html','utf8').split('id="view-events"')[1].split('id="view-mission"')[0];assert(!html.includes('えーへい'));assert(!html.includes('出典'));assert(!html.includes('確認日'));
});
test('old check ids and material order survive expansion and latest prerequisites are explicit',()=>{
 assert.equal(D.guides.find(x=>x.id==='hw-2020').items[0].name,'ハロウィンスプーン');
 assert.equal(D.guides.find(x=>x.id==='wd-2014').items[0].name,'だんご');
 assert(D.guides.find(x=>x.id==='wd-2026').requirement.includes('2026'));
 assert(D.guides.find(x=>x.id==='mermaid-2026').requirement.includes('夜空に届く歌'));
 assert(D.guides.find(x=>x.id==='wd-2023').requirement.includes('シュガー'));
 assert(D.guides.find(x=>x.id==='dg-story').requirement.includes('EP1'));
});

test('archive years and seasonal calendar links match the existing guides',()=>{
 assert.deepEqual(Array.from(M.years(D.guides.filter(g=>g.family==='クリスマス'))),[2025,2024,2023,2022,2021,2020,2019,2018,2016,2015,2014,2013,2012,2010]);
 assert.equal(M.seasonalFamily('新クリスマスイベント'), 'クリスマス');
 assert.equal(M.seasonalFamily('精錬キャンペーン'), '');
});
test('each event displays only its own monster drops, excluding quest rewards',()=>{
 const loot=ctx.window.IRUNA_EVENT_LOOT;
 const groups=M.dropGroups(loot,'xm-2024');
 assert.equal(groups.length,1);
 assert.equal(groups[0].target,'ウヒサディ');
 assert.deepEqual(Array.from(groups[0].drops,row=>row.name),['ベネディジオーネ','▲ウヒサディ','笑い袋','滑らかな布']);
 assert(!M.dropGroups(loot,'hw-2013').some(group=>group.drops.some(row=>row.name==='ハロウィン衣装')));
 for (const path of ['data/event-guides.js','data/event-loot.js','docs/event-loot-evidence-v3.0.98.json']) {
   assert(!fs.readFileSync(path,'utf8').includes('ameblo.jp/pepetaisa'));
 }
});

test('numbered slots keep repeated items, proven empty slots and unverified positions distinct',()=>{
 const loot=ctx.window.IRUNA_EVENT_LOOT;
 const target=(id,name)=>M.dropSlots(M.dropGroups(loot,id).find(group=>group.target===name).drops);
 const piton=target('xm-2010','ピトンLv.100');
 assert.deepEqual(Array.from(piton.slots,x=>x.name),['Xmasチケット','Xmasチケット','Xmasチケット','◇ピトン']);
 const riddle=target('val-2018','リドルハッターLv.50');
 assert.deepEqual(Array.from(riddle.slots,x=>x.status),['item','empty','empty','empty']);
 const igniciel=target('hw-2025','イグニシエル');
 assert.deepEqual(Array.from(igniciel.slots,s=>s.status),['item','unknown','unknown','item']);
 assert(igniciel.unplaced.some(x=>x.name==='フラムブルアーチ'));
});
test('numbered drop claims have evidence and never overlap in the same encounter',()=>{
 const loot=ctx.window.IRUNA_EVENT_LOOT;
 const {sources}=JSON.parse(fs.readFileSync('docs/event-loot-evidence-v3.0.98.json','utf8'));
 let checked=0;
 for(const g of D.guides)for(const {drops} of M.dropGroups(loot,g.id)){
   const used=new Set();
   for(const row of drops){
     const declared=[...(row.slots||[]),...(row.emptySlots||[])];
     if(declared.length)assert(sources[row.slotEvidence],row.name);
     for(const slot of declared){assert(Number.isInteger(slot)&&slot>=1&&slot<=4);assert(!used.has(slot),g.id+':'+slot);used.add(slot);}
   }
   if(used.size===4)checked++;
 }
 assert(checked>=70);
 assert.equal(new Set(loot.filter(row=>row.method==='ドロップ').map(row=>row.family)).size,10);
});
