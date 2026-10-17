'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),P=require('../tools/calendar-parser.cjs'),M=require('../js/calendar-model.js'),{collect,dayBeforeYear}=require('../tools/update-calendar.cjs'),root=path.resolve(__dirname,'..');
const source={url:'https://android.iruna.jp/information',title:'公式イベント',kind:'notice',publishedAt:'2026-10-16'};
const event=(extra={})=>({id:'test',title:'テストイベント',category:'イベント',startDate:'2026-10-17',startTime:'00:00',startNote:'',endDate:'2026-10-18',endTime:'23:59',endNote:'',kind:'range',sources:[source],...extra});
test('daily calendar counts continuing events but names only starts and ends on that date',()=>{
 const ongoing=event({startDate:'2026-10-01',endDate:'2026-10-31'}),start=event({endDate:'2026-10-30'}),end=event({startDate:'2026-10-01',endDate:'2026-10-17'}),point=event({kind:'point',endDate:'2026-10-17'});
 const day=M.daySummary([ongoing,start,end,point],'2026-10-17');assert.equal(day.count,4);assert.deepEqual(day.starts,[start,point]);assert.deepEqual(day.ends,[end]);assert(!day.starts.includes(ongoing));assert(!day.ends.includes(ongoing));assert.equal(M.daySummary([ongoing],'2026-11-01').count,0);
});
test('Japanese dates retain maintenance qualifiers, year rollover and unknown boundaries',()=>{
 assert.deepEqual(P.period('12月30日(水)メンテナンス後～1月6日(水)13:59まで',2026,12),{startDate:'2026-12-30',startTime:null,startNote:'メンテナンス後',endDate:'2027-01-06',endTime:'13:59',endNote:'',kind:'range'});
 const end=P.period('11月4日(水)13:59まで',2026,10);assert.equal(end.startDate,null);assert.equal(end.endDate,'2026-11-04');assert.equal(P.period('10月17日(土)',2026,10).kind,'point');assert.equal(P.dates('2026年2月30日',2026).length,0);assert.equal(P.dates('2026年10月17日25:00',2026).length,0);assert.equal(dayBeforeYear('2024-02-29'),'2023-02-28');
});
test('monthly schedules register only calendar facts and keep individual item periods',()=>{
 const r=P.monthly({title:'2026年10月アップデート＆イベント情報！',url:'http://irunablog.iruna.jp/?p=49321',publishedAt:'2026-09-29',html:'<p class="subtitle">10月14日(水)メンテナンス後〜10月21日(水)13:59まで</p><ul><li>取得経験値+50%アップキャンペーン</li></ul><p class="subtitle">10月28日(水)</p><ul><li>装備強化を追加</li></ul>'});assert.equal(r.events.length,1);assert.equal(r.events[0].startDate,'2026-10-14');assert.equal(r.events[0].endDate,'2026-10-21');assert.equal(r.events[0].startTime,null);
});
test('official notices separate shop sales, weekly grants and the next day raid occurrence',()=>{
 const body='▼イベント内容\n■開催日時\n開始:毎週月曜20:00〜\n終了:毎週月曜21:59まで';const r=P.archive({heading:'2時間限定!経験値アップキャンペーン開催!(10月12日 15:00)',html:body,body},'2026-10-12',source.url);assert.equal(r.events.length,1);assert.equal(r.events[0].startTime,'20:00');assert.equal(r.events[0].endTime,'21:59');assert.equal(r.events[0].startDate,'2026-10-12');
 const raid=P.archive({heading:'金曜24時間限定!レイドバトル「ツチノコ・ブレイク」(10月15日 22:00)',html:'',body:'毎週金曜日0:00～23:59'},'2026-10-15',source.url).events[0];assert.equal(raid.startDate,'2026-10-16');assert.equal(raid.endTime,'23:59');assert.equal(raid.scheduledByRule,true);
 assert.equal(P.archive({heading:'ガチャ販売キャンペーン(10月12日 15:00)',html:body,body},'2026-10-12',source.url).events.length,0);
});
test('duplicate notices merge without erasing unknowns or conflating yearly occurrences',()=>{
 const a=event({id:'',title:'4日間限定!精錬成功確率1.5倍キャンペーン開催!',startTime:null}),b=event({id:'',title:'精錬成功確率1.5倍キャンペーン'});assert.equal(P.mergeEvents([a,b]).length,1);assert.equal(P.mergeEvents([a,b])[0].startTime,'00:00');assert.equal(P.mergeEvents([a,event({...b,startDate:'2025-10-17',endDate:'2025-10-18'})]).length,2);
 const slots=P.mergeEvents([b,event({...b,startTime:'20:00'})]);assert.equal(slots.length,2);assert.equal(new Set(slots.map(e=>e.id)).size,2);
});
test('Japanese-time status respects times and does not keep missing end dates active forever',()=>{
 const at=s=>new Date(s+'+09:00');assert.equal(M.status(event(),at('2026-10-16T23:59:00')),'予定');assert.equal(M.status(event(),at('2026-10-17T00:00:00')),'開催中');assert.equal(M.status(event(),at('2026-10-18T23:59:30')),'開催中');assert.equal(M.status(event(),at('2026-10-19T00:00:00')),'終了');assert.equal(M.status(event({endDate:null,endTime:null}),at('2026-10-20T00:00:00')),'終了日未記載');assert.equal(M.status(event({startDate:null,startTime:null}),at('2026-10-17T00:00:00')),'開始日未記載');assert(!M.onDay(event({startDate:null,startTime:null}),'2026-10-17'));assert(M.onDay(event(),'2026-10-18'));assert.equal(M.monthDays('2026-02').filter(Boolean).length,28);
});
test('source failures stop collection before any data is replaced',async()=>{await assert.rejects(collect({fetchText:async()=>{throw Error('offline');}}),/offline/);});
test('stored year coverage and calendar shell validate, with no arbitrary source URLs',()=>{
 const data=JSON.parse(fs.readFileSync(path.join(root,'data/calendar.json')));assert.equal(M.validate(data),data);assert(data.events.length>300);assert(data.monthlyCoverage.length>=13);assert(data.scan.notices>1000||data.scan.mode==='incremental');assert(data.events.some(e=>e.category==='レイド'));assert(data.events.some(e=>!e.startTime));assert.equal(new Set(data.events.map(e=>e.id)).size,data.events.length);
 const bad=structuredClone(data);bad.events[0].sources[0].url='javascript:alert(1)';assert.throws(()=>M.validate(bad));for(const f of ['js/calendar.js','js/calendar-model.js'])new vm.Script(fs.readFileSync(path.join(root,f),'utf8'));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');assert(html.includes('data-view="calendar"'));for(const f of ['js/calendar.js','js/calendar-model.js','css/calendar.css']){assert(html.includes(f));assert(sw.includes(f));}
});

test('single-event official content is retained and survives merging',()=>{
 const body='取得経験値が50%増加します。\n▼イベント内容\nNPCと会話してください。\n■開催日時\n開始:10月17日20:00~\n終了:10月17日21:59まで\n▼イベントスケジュール\n別の予定';
 const e=P.archive({heading:'取得経験値50%アップキャンペーン(10月17日 15:00)',html:body,body},'2026-10-17',source.url).events[0];assert(e.description.includes('50%'));assert(!e.description.includes('別の予定'));
 assert.equal(P.mergeEvents([event({title:e.title,startTime:e.startTime,endDate:e.endDate,endTime:e.endTime}),e])[0].description,e.description);
});
