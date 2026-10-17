"use strict";
window.IrunaWikiData = (() => {
  const data=window.IRUNA_WIKI_DATA;
  if(!data)return null;
  const allowed=new Set(['アイテムID','説明文','備考','入手区分','入手先','マップ']);
  const updates=new Map(),evidence=new Map();
  const catalogOnly=new Set(data.items.filter(row=>row['計算対象']===false).map(row=>row['アイテムID']));
  const isCatalogOnly=item=>catalogOnly.has(item['アイテムID']);
  const prefixes=new Map();
  for(const row of data.namePrefixes||[]){if(!row.id||prefixes.has(row.id)||!['◇','◆'].includes(row.prefix)||!row.url)throw new Error('クリスタ記号の照合が不正です');prefixes.set(row.id,row.prefix);}
  const itemName=item=>{
    const name=String(item['名前']||'');
    if(item['分類']==='アルクリスタ')return '▲'+name.replace(/^[◇◆▲△]+/,'');
    if(item['分類']==='クリスタ')return (prefixes.get(item['アイテムID'])||(name.startsWith('◆')?'◆':'◇'))+name.replace(/^[◇◆▲△]+/,'');
    return name;
  };
  if(data.schemaVersion!==1)throw new Error('Wiki補足データの形式が未対応です');
  for(const row of data.itemUpdates){
    const id=row['アイテムID'];
    if(!id||updates.has(id)||Object.keys(row).some(k=>!allowed.has(k)))throw new Error('Wiki照合の更新項目が不正です');
    updates.set(id,row);
  }
  for(const row of data.evidence){if(!row.id||evidence.has(row.id))throw new Error('Wiki照合IDが重複しています');evidence.set(row.id,row);}
  const verifiedReferences=new Map();
  for(const row of data.verifiedReferences||[]){
    if(verifiedReferences.has(row.id)||!/^REF\d{6}$/.test(row.id)||row.name!==`◇AGI+${row.value}`||![1,2,3].includes(row.value)||!row.url?.startsWith('https://wikiwiki.jp/iruna-online/')||!evidence.has(row.id))throw new Error('参照アイテムの能力照合が不正です');
    verifiedReferences.set(row.id,row);
  }
  const isVerifiedReference=item=>{
    const row=verifiedReferences.get(item['アイテムID']);
    return Boolean(row&&item['分類']==='クリスタ'&&itemName(item)===row.name);
  };
  const isPlaceholder=value=>!value||/^(?:生産素材|名称参照|参照データ|調理品|回復$|一時強化アイテム$|状態異常回復アイテム$|移動アイテム$)/.test(value);
  const overlayItem=item=>{
    if(isVerifiedReference(item)){
      const row=verifiedReferences.get(item['アイテムID']);
      return {...item,'名前':row.name,'表示分類':'クリスタ','タグ概要':`AGI+${row.value}`,'説明文':`AGI+${row.value}`,'入手区分':row.acquisitionType,'入手先':row.acquisition,'マップ':row.maps,'備考':row.notes};
    }
    const patch=updates.get(item['アイテムID']),name=itemName(item);if(!patch)return name===item['名前']?item:{...item,'名前':name};
    const next={...item,...patch,'名前':name};
    if(!isPlaceholder(item['説明文']))next['説明文']=item['説明文'];
    return next;
  };
  function mergeCatalog(base){const next=window.IrunaCatalogModel.mergeLocations(base,data);next.items=next.items.map(overlayItem);next.itemAliases=data.itemAliases||[];return window.IrunaCatalogModel.validate(next);}
  function mergeEffects(rows){
    const ids=new Map(rows.map(r=>[r['効果ID'],r]));
    const itemIds=new Set(data.items.map(r=>r['アイテムID']));
    // Only unconditional AGI/DEX additions written explicitly in Japanese.
    const simpleCrystals=new Map();
    for(const item of data.items){
      if(!/^JP\d{6}$/.test(item['アイテムID'])||item['分類']!=='クリスタ')continue;
      const proof=evidence.get(item['アイテムID']),description=String(item['説明文']||'').normalize('NFKC').trim();
      const match=/^AGI\+([1-7])(?:\s+DEX\+([1-5]))?$/.exec(description);
      if(!match||!proof?.url?.startsWith('https://irunawiki.com/ja_JP/item/')||proof.description.normalize('NFKC').trim()!==description)continue;
      simpleCrystals.set(item['アイテムID'],{AGI:+match[1],...(match[2]?{DEX:+match[2]}:{})});
    }
    for(const row of data.effects){
      const ref=verifiedReferences.get(row['アイテムID']);
      const verifiedAgi=ref&&row['効果ID']===ref.effectId&&row['能力ID']==='AGI'&&row['値']===ref.value&&row['単位']==='';
      const original=!ref&&itemIds.has(row['アイテムID'])&&['絶対回避','クリティカル率'].includes(row['能力ID'])&&Number.isFinite(row['値'])&&row['単位']==='%';
      const simple=simpleCrystals.get(row['アイテムID']);
      const verifiedSimple=simple&&Object.hasOwn(simple,row['能力ID'])&&row['効果ID']===`JPEFF${row['アイテムID'].slice(2)}_${row['能力ID']}`&&row['値']===simple[row['能力ID']]&&row['単位']===''&&row['数式']===''&&row['丸め処理']==='';
      if((!verifiedAgi&&!original&&!verifiedSimple)||row['条件グループID']!==''||row['効果種類']!=='加算')throw new Error('Wiki追加能力が不正です');
      const old=ids.get(row['効果ID']);
      if(old&&['アイテムID','条件グループID','能力ID','値','単位'].some(k=>old[k]!==row[k]))throw new Error('Wiki追加能力のIDが競合しています');
      if(!old)ids.set(row['効果ID'],row);
    }
    return [...ids.values()];
  }
  return {overlayItem,mergeCatalog,mergeEffects,evidence,itemName,isVerifiedReference,isCatalogOnly};
})();
