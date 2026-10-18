'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),M=require('../js/tasks-model.js');
test('weekend visibility and Japanese midnight resets preserve quantities and previous-day history',()=>{
 let s=M.defaults(),t=s.tasks[0];t.track=true;t.quantity=1666;t.target=2000;
 assert(M.visible(t,'2026-10-18'));assert(M.visible(t,'2026-10-17'));assert(!M.visible(t,'2026-10-19'));
 s=M.toggle(s,t.id,'2026-10-18');assert(M.done(s,t,'2026-10-18'));assert(!M.done(s,t,'2026-10-19'));assert.equal(s.tasks[0].quantity,1666);assert.equal(s.history[0].day,M.shift('2026-10-19',-1));
 assert.equal(M.date(new Date('2026-10-18T14:59:59Z')),'2026-10-18');assert.equal(M.date(new Date('2026-10-18T15:00:00Z')),'2026-10-19');
 s=M.toggle(s,t.id,'2026-10-18');assert.equal(s.history.length,0);s=M.toggle(s,t.id,'2026-10-18');assert.equal(s.history.length,1);
});
test('weekly reset crosses year boundaries on Monday and once-only completion remains',()=>{
 let s=M.defaults(),t=s.tasks[0];t.repeat='weekly';s=M.toggle(s,t.id,'2026-12-31');assert(M.done(s,t,'2027-01-03'));assert(!M.done(s,t,'2027-01-04'));
 t.repeat='once';s.tasks[0].repeat='once';s=M.toggle(s,t.id,'2027-01-04');assert(M.done(s,t,'2028-04-01'));
});
test('invalid tasks, duplicate completion tokens and impossible dates are rejected',()=>{
 for(const patch of [{days:[]},{days:[6,6]},{quantity:-1},{quantity:1.2},{time:'24:00'},{repeat:'bad'},{target:Infinity},{title:''}]){const s=M.defaults();Object.assign(s.tasks[0],patch);assert.throws(()=>M.validate(s));}
 let s=M.toggle(M.defaults(),'weekend-dark-crystal','2026-10-18');s.history.push({...s.history[0]});assert.throws(()=>M.validate(s));s.history.pop();s.history[0].day='2026-02-30';assert.throws(()=>M.validate(s));
});
test('task settings join existing environment backup validation without changing unrelated keys',()=>{
 const sandbox={window:{},localStorage:{getItem:()=>null},structuredClone};vm.createContext(sandbox);
 for(const path of ['js/tasks-model.js','js/environment.js'])vm.runInContext(fs.readFileSync(path,'utf8'),sandbox);
 const E=sandbox.window.IrunaEnvironment;assert(E.isAllowed(M.key));E.validateValue(M.key,JSON.stringify(M.defaults()));assert.throws(()=>E.validateValue(M.key,'{}'));assert(!E.isAllowed('irunadb.credentials'));
 const html=fs.readFileSync('index.html','utf8'),sw=fs.readFileSync('service-worker.js','utf8');for(const p of ['js/tasks-model.js','js/tasks.js','css/tasks.css']){assert(html.includes(p));assert(sw.includes(p));}new vm.Script(fs.readFileSync('js/tasks.js','utf8'));
});

