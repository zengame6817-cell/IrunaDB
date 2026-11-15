'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),c={window:{}};vm.runInNewContext(read('data/missions.js'),c);const data=c.window.IRUNA_MISSION_DATA,report=JSON.parse(read('data/mission-review-v3.0.96.json'));
const ep=n=>data.missions.filter(m=>m.ep==='EP'+n),row=id=>data.missions.find(m=>m.id===id);
test('review adds nine missing missions, preserves old check IDs and orders chapters without duplicates',()=>{
 assert.equal(ep(3).length,29);assert.equal(ep(4).length,16);assert.equal(ep(5).length,21);assert.equal(new Set(data.missions.map(m=>m.id)).size,data.missions.length);assert.equal(report.changes.filter(m=>m.added).length,9);assert(report.preservedMissionIds);assert(report.preservedOtherEpisodes);
 for(const r of report.reports)assert.deepEqual(JSON.parse(JSON.stringify(ep(Number(r.ep.slice(2))).map(m=>({id:m.id,title:m.title})))),r.order);
 const normalize=s=>s.normalize('NFKC').replace(/[\s・･]/g,'');
 for(const r of report.reports)for(const f of r.sourceFacts){const m=data.missions.find(m=>m.ep===r.ep&&normalize(m.title)===normalize(f.title));assert(m,f.title);assert.equal(m.exp,f.exp,f.title);}
 const order=(n,titles)=>{const a=ep(n).map(m=>m.title),positions=titles.map(t=>a.indexOf(t));assert(positions.every(i=>i>=0));assert(positions.every((p,i)=>!i||p>positions[i-1]));};
 order(3,['山竜と神の欠片','使えぬ者と暴走する者','湖竜と盗賊少女']);order(3,['皇帝と竜魔','怪物畑と欲望の宮殿','神の欠片と魔の望み','天使の園と新竜王','矛盾と自我','？（会話イベントのみ）']);
 order(4,['盲目の竜','実りの約束','友情の果て','後悔の傷跡','慈悲の戯言と魔女の灯','灯火の先へ','ひとときの幸福を願う','こわれたつちにんぎょう','沈没した街の中で']);
 order(5,['未開の案内人','夜の王','染まる獣','月夜の杖','ナイトフォーカス','閑静な獣']);order(5,['思い出の丘','夕闇の怪鳥','民衆の乙女騎士','笑う道化師']);
 assert.equal(row('EP4-006').title,'慈悲の戯言と魔女の灯');assert.equal(row('EP5-002').title,'ナイトフォーカス');assert.equal(row('EP4-002').title,'謎の少女と');
});
test('zero EXP mistakes, intermediate reward totals and shifted EP5 routes are corrected',()=>{
 assert.equal(row('EP3-022').exp,128000000);assert.equal(row('EP4-006').exp,191000000);assert.equal(row('EP4-010').exp,226000000);assert.equal(row('EP3-027').exp,83200000);assert.equal(row('EP3-027').expBreakdown.reduce((a,b)=>a+b),row('EP3-027').exp);
 assert(!row('EP5-003').steps.join().includes('ラスター'));assert(row('EP5-004').steps.join().includes('ラスターLv350'));assert(row('EP5-005').steps.join().includes('シュテルLv355'));assert(row('EP5-002').steps.join().includes('アギラジャーマLv358'));assert(row('EP5-002').steps.join().includes('(160,159)を2回'));
 assert(row('EP3-029').steps.join().includes('ウーベルLv330'));assert(row('EP4-012').steps.join().includes('テロンLv347'));
});
test('required item lists keep existing owned IDs, distinguish advance preparation and include omitted collections',()=>{
 assert.equal(new Set(data.items.map(i=>i.id)).size,data.items.length);
 for(const id of ['EP4-ITEM-016','EP4-ITEM-017','EP4-ITEM-018'])assert.equal(data.items.find(i=>i.id===id).usedIn,'第3章 慈悲の戯言と魔女の灯');
 assert.equal(data.items.find(i=>i.ep==='EP3'&&i.name==='古びた書物').qty,2);assert.equal(data.items.find(i=>i.ep==='EP4'&&i.name==='光輝物質').qty,10);assert.equal(data.items.find(i=>i.ep==='EP4'&&i.name==='パール').qty,5);
 assert(!data.items.some(i=>['復讐の炎','コーティング油','毒蜘蛛の鋏角'].includes(i.name))); // Optional ninja skill detours are not mission requirements.
});
function ui(){const elements=new Map(),storage=new Map([['irunadb_mission_done_v1',JSON.stringify(['EP3-022','EP4-006','EP5-002'])],['irunadb_mission_owned_v1',JSON.stringify(['EP4-ITEM-016'])]]);const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},dataset:{},querySelectorAll:()=>[],addEventListener:()=>{}});return elements.get(id);};const ctx={window:{IRUNA_MISSION_DATA:data},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{getElementById:el,readyState:'complete'},console};let code=read('js/missions.js').replace('  function renderAll() {','  window.testMission={state,renderAll};\n  function renderAll() {');vm.runInNewContext(code,ctx);return {ctx,el,storage};}
test('saved completion survives reorder, review scope and EXP detail are visible, and unverified tail is not claimed verified',()=>{
 const {ctx,el,storage}=ui(),api=ctx.window.testMission,before=[...storage];api.state.ep='EP4';api.renderAll();assert.equal(el('missionProgressText').textContent,'1 / 16');assert(el('missionList').innerHTML.includes('慈悲の戯言と魔女の灯'));assert(el('missionList').innerHTML.includes('data-mission-done="EP4-006" checked'));
 api.state.ep='EP3';api.renderAll();assert(el('missionList').innerHTML.includes('途中報酬含む'));assert(el('missionList').innerHTML.includes('82,200,000＋途中1,000,000'));
 api.state.ep='EP5';api.renderAll();assert.equal(el('missionProgressText').textContent,'1 / 21');assert(el('missionList').innerHTML.includes('指定記事の掲載範囲外・未照合'));assert.deepEqual([...storage],before);
 for(const id of ['EP5-016','EP5-017','EP5-018','EP5-019']){assert(row(id).verificationStatus.includes('未照合'));assert.equal(row(id).source,'');}
 assert.equal(data.missions.filter(m=>m.verificationStatus==='指定記事と照合済み').length,62);
});
