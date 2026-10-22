"use strict";
(() => {
  const facts=[
  {
    "id": "MON000041",
    "name": "アードシェック",
    "min": 376,
    "max": 376,
    "map": "ザルム湖畔",
    "element": "無",
    "url": "https://irunawiki.com/ja_JP/monster/Alderook_2633",
    "sourceLevel": 376,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000043",
    "name": "アラーニヨ",
    "min": 378,
    "max": 378,
    "map": "強欲の黄砂",
    "element": "無",
    "url": "https://irunawiki.com/ja_JP/monster/Aranijo_2655",
    "sourceLevel": 378,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000049",
    "name": "カルチャーレ",
    "min": 357,
    "max": 357,
    "map": "ゴルトーク山道",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Calcia_2425",
    "sourceLevel": 357,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000053",
    "name": "シュヴァリー",
    "min": 361,
    "max": 361,
    "map": "ラッツブルグ城",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Chivalry_2416",
    "sourceLevel": 361,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000056",
    "name": "デエスト",
    "min": 379,
    "max": 379,
    "map": "バール神殿",
    "element": "光",
    "url": "https://irunawiki.com/ja_JP/monster/D'este_2681",
    "sourceLevel": 379,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000058",
    "name": "ディネイル",
    "min": 371,
    "max": 371,
    "map": "気流の洞窟",
    "element": "闇",
    "url": "https://irunawiki.com/ja_JP/monster/Denail_2624",
    "sourceLevel": 371,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000059",
    "name": "サールヘン",
    "min": 378,
    "max": 378,
    "map": "ベルノ花原",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Deserfin_2673",
    "sourceLevel": 378,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000067",
    "name": "ジェムアント",
    "min": 356,
    "max": 356,
    "map": "アメスベルグ連峰",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Gem%20Ant_2394",
    "sourceLevel": 356,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000073",
    "name": "氷竜アイゼン",
    "min": 300,
    "max": 300,
    "map": "ミナウラの街",
    "element": "水",
    "url": "https://irunawiki.com/ja_JP/monster/Ice%20Dragon%20Eisen%20II_1220",
    "sourceLevel": 300,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000078",
    "name": "キジムー",
    "min": 372,
    "max": 372,
    "map": "星明かりの峠道",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Kijimu_2480",
    "sourceLevel": 372,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000080",
    "name": "王竜カイザー",
    "min": 242,
    "max": 242,
    "map": "クレルダン聖堂街",
    "element": "無",
    "url": "https://irunawiki.com/ja_JP/monster/Lord%20Dragon%20Kaiser_1587",
    "sourceLevel": 242,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000101",
    "name": "サウロ",
    "min": 385,
    "max": 385,
    "map": "戦士の演習場",
    "element": "無",
    "url": "https://irunawiki.com/ja_JP/monster/Sauro_2470",
    "sourceLevel": 385,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000111",
    "name": "ズグー",
    "min": 377,
    "max": 377,
    "map": "シグミ地下廃坑道",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Zugoo_2645",
    "sourceLevel": 377,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000113",
    "name": "アードシェック",
    "min": 379,
    "max": 379,
    "map": "ザルム湖畔",
    "element": "無",
    "url": "https://irunawiki.com/ja_JP/monster/Alderook_2636",
    "sourceLevel": 379,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000114",
    "name": "アラーニヨ",
    "min": 381,
    "max": 381,
    "map": "強欲の黄砂",
    "element": "無",
    "url": "https://irunawiki.com/ja_JP/monster/Aranijo_2658",
    "sourceLevel": 381,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000116",
    "name": "カルチャーレ",
    "min": 360,
    "max": 360,
    "map": "ゴルトーク山道",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Calcia_2428",
    "sourceLevel": 360,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000119",
    "name": "シュヴァリー",
    "min": 363,
    "max": 363,
    "map": "ラッツブルグ城",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Chivalry_2419",
    "sourceLevel": 363,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000125",
    "name": "ディネイル",
    "min": 374,
    "max": 374,
    "map": "気流の洞窟",
    "element": "闇",
    "url": "https://irunawiki.com/ja_JP/monster/Denail_2627",
    "sourceLevel": 374,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000126",
    "name": "サールヘン",
    "min": 381,
    "max": 381,
    "map": "ベルノ花原",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Deserfin_2676",
    "sourceLevel": 381,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000129",
    "name": "ジェムアント",
    "min": 359,
    "max": 359,
    "map": "アメスベルグ連峰",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Gem%20Ant_2397",
    "sourceLevel": 359,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000148",
    "name": "ズグー",
    "min": 380,
    "max": 380,
    "map": "シグミ地下廃坑道",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Zugoo_2648",
    "sourceLevel": 380,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000150",
    "name": "アードシェック",
    "min": 382,
    "max": 382,
    "map": "ザルム湖畔",
    "element": "無",
    "url": "https://irunawiki.com/ja_JP/monster/Alderook_2639",
    "sourceLevel": 382,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000151",
    "name": "アラーニヨ",
    "min": 384,
    "max": 384,
    "map": "強欲の黄砂",
    "element": "無",
    "url": "https://irunawiki.com/ja_JP/monster/Aranijo_2661",
    "sourceLevel": 384,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000155",
    "name": "カルチャーレ",
    "min": 363,
    "max": 363,
    "map": "ゴルトーク山道",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Calcia_2431",
    "sourceLevel": 363,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000158",
    "name": "シュヴァリー",
    "min": 364,
    "max": 364,
    "map": "ラッツブルグ城",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Chivalry_2422",
    "sourceLevel": 364,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000163",
    "name": "ディネイル",
    "min": 377,
    "max": 377,
    "map": "気流の洞窟",
    "element": "闇",
    "url": "https://irunawiki.com/ja_JP/monster/Denail_2630",
    "sourceLevel": 377,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000164",
    "name": "サールヘン",
    "min": 384,
    "max": 384,
    "map": "ベルノ花原",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Deserfin_2679",
    "sourceLevel": 384,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000166",
    "name": "ジェムアント",
    "min": 362,
    "max": 362,
    "map": "アメスベルグ連峰",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Gem%20Ant_2400",
    "sourceLevel": 362,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000190",
    "name": "ズグー",
    "min": 383,
    "max": 383,
    "map": "シグミ地下廃坑道",
    "element": "地",
    "url": "https://irunawiki.com/ja_JP/monster/Zugoo_2651",
    "sourceLevel": 383,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000238",
    "name": "火竜ブレアード",
    "min": 300,
    "max": 300,
    "map": "ミナウラの街",
    "element": "火",
    "url": "https://irunawiki.com/ja_JP/monster/Fire%20Dragon%20Blaiard%20II_1219",
    "sourceLevel": 300,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000384",
    "name": "メーバ",
    "min": 13,
    "max": 13,
    "map": "ロンファ洞窟",
    "element": "水",
    "url": "https://irunawiki.com/ja_JP/monster/Moeba_379",
    "sourceLevel": 13,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000535",
    "name": "ドラグノフ",
    "min": 18,
    "max": 18,
    "map": "ロンファ洞窟",
    "element": "風",
    "url": "https://irunawiki.com/ja_JP/monster/Dragnof_377",
    "sourceLevel": 18,
    "checkedAt": "2026-10-23"
  },
  {
    "id": "MON000536",
    "name": "ドラグノフ",
    "min": 19,
    "max": 19,
    "map": "ロンファ洞窟",
    "element": "水",
    "url": "https://irunawiki.com/ja_JP/monster/Dragnof_378",
    "sourceLevel": 19,
    "checkedAt": "2026-10-23"
  }
];
  function apply(data){
    const byId=new Map(data.monsters.map(m=>[m['モンスターID'],m])),maps=new Map(data.maps.map(m=>[m['マップID'],m['マップ名']]));
    for(const f of facts){const m=byId.get(f.id);if(!m||m['名前']!==f.name||m['Lv下限']!==f.min||m['Lv上限']!==f.max||!data.spawns.some(s=>s['モンスターID']===f.id&&maps.get(s['マップID'])===f.map))throw new Error('属性照合の対象個体が一致しません');}
    const index=new Map(facts.map(f=>[f.id,f]));return {...data,monsters:data.monsters.map(m=>{const f=index.get(m['モンスターID']);return f&&!m['属性']?{...m,'属性':f.element}:m;})};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={facts,apply};else window.IrunaMonsterAttributes={facts,apply};
})();
