'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),M=require('../js/tasks-model.js'),T=require('../js/tasks-transfer-model.js');
const now=new Date('2026-10-21T01:00:00Z');
function storage(initial={}){const map=new Map(Object.entries(initial));return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};}
function sample(){let data=M.defaults();Object.assign(data.tasks[0],{tower:'白日の閃塔',character:'テスト',note:'移行メモ',track:true,quantity:1666,target:2000,pace:59});return M.toggle(data,data.tasks[0].id,'2026-10-20');}
test('task-only roundtrip includes all known fields and deleted-task history, excluding unrelated data',()=>{
 const data=sample();data.credentials='must not export';data.tasks[0].secret='must not export';data.history.push({taskId:'deleted',title:'削除済み',character:'',group:'日課',day:'2026-10-19',period:'2026-10-19'});
 const file=T.pack(data,'3.0.78',now),copy=T.parse(JSON.stringify(file));assert.equal(copy.data.tasks[0].pace,59);assert.equal(copy.data.tasks[0].quantity,1666);assert.equal(copy.data.tasks[0].tower,'白日の閃塔');assert.equal(copy.data.history.length,2);assert(!JSON.stringify(copy).includes('must not export'));assert(!M.done(copy.data,copy.data.tasks[0],'2026-10-21'));
});
test('replacement touches only task keys and rollback restores exact destination bytes',()=>{
 const original=JSON.stringify(M.defaults(),null,2),s=storage({[M.key]:original,'irunadb.savedBuilds.v21':'build','irunadb.theme.v2':'dark'}),file=T.pack(sample(),'3.0.78',now);
 T.replace(file,s,now);assert.equal(JSON.parse(s.getItem(M.key)).tasks[0].quantity,1666);assert.equal(T.backup(s).raw,original);assert.equal(s.getItem('irunadb.savedBuilds.v21'),'build');assert.equal(s.getItem('irunadb.theme.v2'),'dark');T.restore(s);assert.equal(s.getItem(M.key),original);
 const empty=storage({'other':'keep'});T.replace(file,empty,now);T.restore(empty);assert.equal(empty.getItem(M.key),null);assert.equal(empty.getItem('other'),'keep');
});
test('bad files fail before mutation; backup or task storage failures preserve the original tasks',()=>{
 const original=JSON.stringify(M.defaults()),valid=T.pack(sample(),'3.0.78',now),s=storage({[M.key]:original});
 for(const file of [{}, {...valid,format:'IrunaDB-environment'}, {...valid,schemaVersion:2}, {...valid,data:{version:1,tasks:[],history:[{}]}}]){assert.throws(()=>T.replace(file,s,now));assert.equal(s.getItem(M.key),original);assert.equal(s.getItem(T.backupKey),null);}
 assert.throws(()=>T.parse('{broken'));assert.throws(()=>T.parse(' '.repeat(T.maxBytes+1)));
 for(const failKey of [T.backupKey,M.key]){const s=storage({[M.key]:original}),set=s.setItem;s.setItem=(k,v)=>{if(k===failKey)throw Error('quota');set(k,v);};assert.throws(()=>T.replace(valid,s,now),/quota/);assert.equal(s.getItem(M.key),original);}
});
test('old optional fields and empty task collections can move without defaults being inserted',()=>{
 const old=M.defaults();assert.equal(old.tasks[0].pace,undefined);assert.equal(old.tasks[0].tower,undefined);const s=storage();T.replace(T.pack(old,'3.0.75',now),s,now);assert.equal(JSON.parse(s.getItem(M.key)).tasks[0].tower,undefined);
 T.replace(T.pack({version:1,tasks:[],history:[]},'3.0.78',now),s,now);assert.deepEqual(JSON.parse(s.getItem(M.key)).tasks,[]);
});

