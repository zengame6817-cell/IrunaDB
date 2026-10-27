"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../js/app-v3.0.55.js"),"utf8");
const st=source.indexOf("    state.conditions.forEach(condition =>");
const ed=source.indexOf("    state.stats.forEach(stat =>",st);
assert(st>=0&&ed>st,"Unable to locate effect indexer");
const snippet=source.slice(st,ed);
function apply(effects){
  const conditions=[
    {条件グループID:"old",条件項目:"装備箇所",演算子:"=",比較値ID:"特殊",論理結合:"AND"},
    {条件グループID:"same",条件項目:"装備箇所",演算子:"=",比較値ID:"特殊",論理結合:"AND"},
    {条件グループID:"distinct",条件項目:"装備箇所",演算子:"=",比較値ID:"体",論理結合:"AND"}
  ];
  const ctx={state:{effects,conditions},context:{conditionMap:new Map(),effectsByItem:new Map()}};
  vm.runInNewContext(snippet,ctx);
  return Array.from(ctx.context.effectsByItem.get("CR000234")||[]);
}
const base={効果ID:"old",アイテムID:"CR000234",能力ID:"オートスキル発動",値:3,単位:"%",効果種類:"加算",数式:"",条件グループID:"old",有効:true};
test("same condition even under another ID does not stack Studio additions",()=>{
  const newer={...base,効果ID:"new",能力ID:"更にオートスキル発動",条件グループID:"same",備考:"Studio能力差分修正"};
  assert.deepEqual(apply([base,newer]).map(x=>x.効果ID),["old"]);
});
test("different equipment condition is retained",()=>{
  const newer={...base,効果ID:"new",条件グループID:"distinct",備考:"Studio能力差分修正"};
  assert.deepEqual(apply([base,newer]).map(x=>x.効果ID),["old","new"]);
});
test("EFFECT_MASTER 有効 FALSE is excluded regardless of value representation",()=>{
  assert.deepEqual(apply([{...base,有効:false},{...base,効果ID:"a",有効:"FALSE"}]),[]);
});
