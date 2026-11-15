'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{},URL};vm.createContext(ctx);
for(const p of ['data/event-guides.js','js/event-guides-model.js'])vm.runInContext(fs.readFileSync(p,'utf8'),ctx);
const D=ctx.window.IRUNA_EVENT_GUIDES,M=ctx.IrunaEventGuidesModel;
test('guides carry distinct ids, real story years, material quantities and scoped sources',()=>{
 assert.equal(D.guides.length,13);assert.equal(new Set(D.guides.map(g=>g.id)).size,13);
 for(const g of D.guides){assert(D.families.includes(g.family));assert(g.year>=2013&&g.year<=2024);assert(g.entry&&g.requirement&&g.unlock);assert(g.steps.length>=2);assert(M.sourceUrl(g.source));for(const x of g.items){assert(x.name);assert(Number.isInteger(x.qty)&&x.qty>0);}}
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
 for(const p of ['data/event-guides.js','js/event-guides-model.js','js/event-guides.js','css/event-guides.css']){assert(html.includes(p));assert(sw.includes(p));}
 assert(fs.readFileSync('js/app-v3.0.55.js','utf8').includes('location.hash === "#events"'));new vm.Script(fs.readFileSync('js/event-guides.js','utf8'));
});
