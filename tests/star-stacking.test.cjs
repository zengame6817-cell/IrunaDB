"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../js/app-v3.0.55.js"),"utf8");
const first=source.indexOf("  function allSelectedSourceEntries() {");
const last=source.indexOf("\n  function allSelectedIds()",first);
assert(first>=0&&last>first);
const selectedFn=source.slice(first,last);
const keys=["weapon","body","additional","special","decoration"];
function make(levels){
  const slots=keys.map(key=>({key,label:key}));
  const items=new Map();
  for(let i=1;i<=5;i++)items.set("ST"+i,{"アイテムID":"ST"+i,"分類":"☆能力","名前":"☆生命力Lv"+i});
  const state={build:{weapon:null,body:null,additional:null,special:null,stars:Object.fromEntries(keys.map((k,i)=>[k,levels[i]?("ST"+levels[i]):null])),crystals:Object.fromEntries(keys.map(k=>[k,[]])),equipmentSettings:Object.fromEntries(keys.map(k=>[k,{slots:0}])),alCrystas:[],buildRelics:[]}};
  const ctx={state,context:{itemsById:items},SLOT_DEFS:slots,console};
  return Array.from(vm.runInNewContext(selectedFn+"\nallSelectedSourceEntries()",ctx),e=>({id:e.id,name:e.name,originalId:e.originalId||null}));
}
test("Five selected Lv5 stars act as Lv5,4,3,2,1 without changing selection",()=>{
  assert.deepEqual(make([5,5,5,5,5]).map(e=>e.id),["ST5","ST4","ST3","ST2","ST1"]);
});
test("Lv1 stars still stack",()=>{
  assert.deepEqual(make([1,1,1,1,1]).map(e=>e.id),["ST1","ST1","ST1","ST1","ST1"]);
});
test("Different nominal levels step down only on collision",()=>{
  assert.deepEqual(make([5,3,3,2,1]).map(e=>e.id),["ST5","ST3","ST2","ST1","ST1"]);
});
test("SP Codal legacy conditional rows supersede identical later additions",()=>{
  assert.match(source,/sourceEntry\.id === "CR000045" && \["CREFF001551","CREFF001552"\]/);
});
