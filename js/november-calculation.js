"use strict";
window.IrunaNovemberCalculation = (() => {
  const definitions = [
    ['JP000037','サフィエクラル','武器','水属性 ATK+25% 物理耐性+10% 出血発生+10% 出血ダメージ+25%', [['ATK',25,'%'],['物理耐性',10,'%'],['出血発生',10,'%'],['出血ダメージ',25,'%']], []],
    ['JP000038','氷晶のブローチ','特殊','水魔法威力+10% オートスキル発動+5% 攻撃時、確率で魔法攻撃', [['水魔法威力',10,'%'],['オートスキル発動率',5,'%']], ['攻撃時の魔法追撃（発動率・威力）','個体ごとのDEF']],
    ['JP000039','レジストハイド','特殊','出血時間-5秒 VIT+5 防御時、確率で被害軽減', [['出血時間',-5,'秒'],['VIT',5,'']], ['防御時の確率軽減（発動率・軽減量）','個体ごとのDEF']],
    ['JP000040','リーフィピアス','追加','MATK+20% ブリザード威力+20% 詠唱時間-20% スペルバースト率+10%', [['MATK',20,'%'],['ブリザード威力',20,'%'],['詠唱時間',-20,'%'],['スペルバースト率',10,'%']], ['個体ごとのDEF']],
    ['JP000041','◇シャープネスⅣ','クリスタ','クリティカルダメージ+10%', [['クリティカルダメージ',10,'%']], []],
    ['JP000042','◇DEX+30','クリスタ','DEX+30', [['DEX',30,'']], []]
  ];
  const normalize = s => String(s || '').normalize('NFKC').replace(/\s/g,'');
  const originals = new Map((window.IRUNA_LATEST_ITEMS_3094 || []).map(i => [i['アイテムID'],i]));
  const supported = new Map(), effects = [], notes = new Map();
  // Explicitly verified image facts only. Never infer effects from arbitrary prose.
  for (const [id,name,category,description,values,unknown] of definitions) {
    const item = originals.get(id);
    if (!item || normalize(item['名前']) !== normalize(name) || item['分類'] !== category || normalize(item['説明文']) !== normalize(description)) throw Error('新装備の計算データと確認済み性能が一致しません：'+id);
    const incomplete = unknown.length ? '未計算：'+unknown.join('、')+'。数値が判明している効果だけを合計します。' : '';
    supported.set(id,{...item,'計算対象':true,'特殊性能':[item['特殊性能'],incomplete].filter(Boolean).join(' ')});
    notes.set(id,unknown.map(text=>'未計算：'+name+'／'+text));
    values.forEach(([stat,value,unit],index) => effects.push({
      '効果ID':`NOV3095_${id}_${index}`,'アイテムID':id,'条件グループID':'','能力ID':stat,
      '値':value,'単位':unit,'効果種類':'加算','数式':'','丸め処理':'',
      '表示文':`${stat}${value>0?'+':''}${value}${unit}`,'表示順':index+1,
      '備考':'2026-11-11 ゲーム内アイテム画像照合。data/latest-items-evidence-v3.0.94.json','有効':true
    }));
  }
  const isSupported = item => {
    const expected = supported.get(String(item?.['アイテムID'] || ''));
    return Boolean(expected && item['分類'] === expected['分類'] && normalize(item['名前']) === normalize(expected['名前']));
  };
  const overlayItem = item => isSupported(item) ? {...item,...supported.get(item['アイテムID'])} : item;
  function mergeEffects(rows) {
    const result = new Map(rows.map(row=>[row['効果ID'],row]));
    for (const effect of effects) {
      const old = result.get(effect['効果ID']);
      if (old && Object.keys(effect).some(key=>old[key]!==effect[key])) throw Error('新装備の効果IDが競合しています');
      result.set(effect['効果ID'],{...effect});
    }
    return [...result.values()];
  }
  const uncalculatedNotes = entries => [...new Set(entries.flatMap(entry=>notes.get(entry.id)||[]))];
  return {isSupported,overlayItem,mergeEffects,uncalculatedNotes};
})();
