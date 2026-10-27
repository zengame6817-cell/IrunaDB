'use strict';
((root)=>{
 const source='https://ameblo.jp/pdhegaud/entry-12802072305.html',wiki='https://wikiwiki.jp/iruna-online/スキル/騎士見習い・ナイト';
 function apply(data){
  const addedSkills=[1,2].map(lv=>({'スキルID':'PALSK0000'+(10+lv),'職業ID':'JOB003','スキル名':'ウォークライ','選択肢名':'Lv'+lv,'カテゴリ':'自己強化','選択方式':'LEVEL','最大Lv':2,'初期選択':'FALSE','説明文':(lv===1?'2':'3')+'分間、ATK・MaxHP各+'+(lv===1?8:12)+'%。自身と周囲のPTメンバーが対象。','特殊効果':'効果発動中のみビルドへ反映。','表示順':10+lv,'出典':wiki,'検証状態':'日本語Wiki資料確認','備考':'ナイトから引き継ぐスキル。ゲーム内未検証。','有効':'TRUE'}));
  const addedEffects=[];let order=1;
  for(const skill of addedSkills)for(const stat of ['ATK','MaxHP'])addedEffects.push({'スキル効果ID':'JPSE08500'+order++,'スキルID':skill['スキルID'],'適用Lv':Number(skill['選択肢名'].slice(2)),'条件グループID':null,'能力ID':stat,'値':skill['選択肢名']==='Lv1'?8:12,'単位':'%','効果種類':'加算','数式':null,'上限値':null,'表示文':stat+'+'+(skill['選択肢名']==='Lv1'?8:12)+'%','表示順':order,'ビルド反映':'TRUE','検証状態':'日本語Wiki資料確認','備考':wiki,'有効':'TRUE'});
  addedEffects.push({'スキル効果ID':'JPSE085005','スキルID':'PALSK000006','適用Lv':1,'条件グループID':null,'能力ID':'MaxHP','値':15,'単位':'%','効果種類':'加算','数式':null,'上限値':null,'表示文':'MaxHP+15%（検証記事の参考値）','表示順':1,'ビルド反映':'TRUE','検証状態':'検証記事の参考値','備考':source+' 日本語Wikiでは数値未記載。ヘイト・発動率は計算しない。','有効':'TRUE'});
  const skills=data.skills.map(row=>row['スキルID']==='PALSK000006'?{...row,'説明文':'発動中のMaxHP+15%（検証記事の参考値）。ディボーションの効果対象を広げる。','特殊効果':'日本語WikiはHP数値未記載。ヘイト増加量・発動率は計算対象外。ソリッドシュライン単独の十字架と区別。','出典':source,'検証状態':'検証記事の参考値'}:row);
  for(const row of addedSkills){const old=skills.find(s=>s['スキルID']===row['スキルID']);if(!old)skills.push(row);else if(old['スキル名']!=='ウォークライ'||old['職業ID']!=='JOB003')throw Error('スキルID重複');}
  const effects=[...data.effects];for(const row of addedEffects){const old=effects.find(e=>e['スキル効果ID']===row['スキル効果ID']);if(!old)effects.push(row);else if(old['スキルID']!==row['スキルID']||old['値']!==row['値']||old['能力ID']!==row['能力ID'])throw Error('スキル効果ID重複');}
  return {...data,skills,effects};
 }
 const api={apply,source,wiki};if(typeof module!=='undefined'&&module.exports)module.exports=api;else {root.IrunaSkillSupplement=api;if(root.IRUNA_SKILL_DATA)root.IRUNA_SKILL_DATA=apply(root.IRUNA_SKILL_DATA);}
})(typeof window==='undefined'?globalThis:window);
