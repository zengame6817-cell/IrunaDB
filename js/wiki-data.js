"use strict";
window.IrunaWikiData = (() => {
  const data=window.IRUNA_WIKI_DATA;
  if(!data)return null;
  const allowed=new Set(['アイテムID','説明文','備考','入手区分','入手先','マップ']);
  const updates=new Map(),evidence=new Map();
  if(data.schemaVersion!==1)throw new Error('Wiki補足データの形式が未対応です');
  for(const row of data.itemUpdates){
    const id=row['アイテムID'];
    if(!id||updates.has(id)||Object.keys(row).some(k=>!allowed.has(k)))throw new Error('Wiki照合の更新項目が不正です');
    updates.set(id,row);
  }
  for(const row of data.evidence){if(!row.id||evidence.has(row.id))throw new Error('Wiki照合IDが重複しています');evidence.set(row.id,row);}
  const isPlaceholder=value=>!value||/^(?:生産素材|名称参照|参照データ|調理品|回復$|一時強化アイテム$|状態異常回復アイテム$|移動アイテム$)/.test(value);
  const overlayItem=item=>{
    const patch=updates.get(item['アイテムID']);if(!patch)return item;
    const next={...item,...patch};
    if(!isPlaceholder(item['説明文']))next['説明文']=item['説明文'];
    return next;
  };
  function mergeCatalog(base){const next=window.IrunaCatalogModel.mergeLocations(base,data);next.items=next.items.map(overlayItem);return window.IrunaCatalogModel.validate(next);}
  function mergeEffects(rows){
    const ids=new Map(rows.map(r=>[r['効果ID'],r]));
    const itemIds=new Set(data.items.map(r=>r['アイテムID']));
    for(const row of data.effects){
      if(!itemIds.has(row['アイテムID'])||row['条件グループID']!==''||row['効果種類']!=='加算'||!['絶対回避','クリティカル率'].includes(row['能力ID'])||!Number.isFinite(row['値'])||row['単位']!=='%')throw new Error('Wiki追加能力が不正です');
      const old=ids.get(row['効果ID']);
      if(old&&['アイテムID','条件グループID','能力ID','値','単位'].some(k=>old[k]!==row[k]))throw new Error('Wiki追加能力のIDが競合しています');
      if(!old)ids.set(row['効果ID'],row);
    }
    return [...ids.values()];
  }
  return {overlayItem,mergeCatalog,mergeEffects,evidence};
})();
