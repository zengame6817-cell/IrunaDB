"use strict";
(() => {
  const labels=['無','火','水','風','地','光','闇','炎','氷','雷','岩','四元','万能'];
  const equipmentCategories=new Set(['武器','防具','体','追加','特殊','装飾']);
  const active=row=>row?.['有効']!==false&&String(row?.['有効']).toUpperCase()!=='FALSE';
  // Only explicit attribute fields are used. Damage bonuses, resistance and descriptions are not attributes.
  function values(value,attributes=new Map()) {
    const raw=String(value??'').normalize('NFKC').trim();
    const resolved=attributes.get(raw)??raw;
    return [...new Set(String(resolved).split(/[・、,／/→]/).map(v=>v.trim().replace(/属性$/,'')).filter(v=>labels.includes(v)))];
  }
  function equipmentIndex(items,attributes) {
    const names=new Map(attributes.filter(active).map(a=>[String(a['属性ID']),a['属性名']]));
    return new Map(items.filter(active).filter(i=>equipmentCategories.has(i['分類'])).map(i=>[String(i['アイテムID']),values(i['属性ID']||i['属性'],names)]));
  }
  const matches=(values,element)=>element==='unknown'?values.length===0:values.includes(element);
  function matchesDrop(monster,itemId,element,scope,index) {
    if(!element)return true;
    const mob=matches(values(monster?.['属性']),element),equipment=index.has(itemId)&&matches(index.get(itemId),element);
    return scope==='monster'?mob:scope==='equipment'?equipment:mob||equipment;
  }
  const api={labels,values,equipmentIndex,matchesDrop};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else window.IrunaLocationElements=api;
})();
