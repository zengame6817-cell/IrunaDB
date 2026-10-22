const test=require('node:test'),assert=require('node:assert/strict'),m=require('../js/location-elements.js');
test('equipment uses explicit attribute IDs or names, including advanced and composite attributes',()=>{
 const index=m.equipmentIndex([{アイテムID:'a',分類:'武器',属性ID:'ATT006'},{アイテムID:'b',分類:'武器',属性ID:'氷・地'},{アイテムID:'c',分類:'追加',属性ID:'無属性'},{アイテムID:'d',分類:'武器',属性ID:'四元'}],[{属性ID:'ATT006',属性名:'光'}]);
 assert.deepEqual(index.get('a'),['光']);assert.deepEqual(index.get('b'),['氷','地']);assert.deepEqual(index.get('c'),['無']);assert.deepEqual(index.get('d'),['四元']);assert(!m.matchesDrop({},'d','火','equipment',index));
});
test('bonuses, resistance, magic grants, blank values and non-equipment cannot invent an element',()=>{
 const index=m.equipmentIndex([{アイテムID:'a',分類:'武器',説明文:'火属性に物理+20% 火耐性+10%'},{アイテムID:'b',分類:'素材',属性:'火'},{アイテムID:'c',分類:'クリスタ',説明文:'火属性の魔法攻撃を付与する'},{アイテムID:'d',分類:'武器',属性ID:'火',有効:false}],[]);
 assert.deepEqual(index.get('a'),[]);for(const id of ['b','c','d'])assert(!index.has(id));
 assert(!m.matchesDrop({},'a','無','equipment',index));assert(m.matchesDrop({},'a','unknown','equipment',index));assert(!m.matchesDrop({},'b','unknown','equipment',index));
});
test('both means monster OR equipment; separate scopes, unknown and unset scope behave consistently',()=>{
 const index=new Map([['a',['水']]]),mob={属性:'火'};
 assert(m.matchesDrop(mob,'a','火','monster',index));assert(!m.matchesDrop(mob,'a','火','equipment',index));assert(m.matchesDrop(mob,'a','水','both',index));assert(m.matchesDrop(mob,'a','火','',index));assert(!m.matchesDrop(mob,'a','unknown','both',index));assert(m.matchesDrop({},'x','unknown','monster',index));assert(m.matchesDrop(mob,'x','','both',index));
});
