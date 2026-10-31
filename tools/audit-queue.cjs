'use strict';
// Rebuild a review queue from historical audits, never a fresh source verification.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),coverage=read('data/wiki-coverage.json'),audit=read('data/drop-audit-v3.0.67.json'),r71=read('data/reconciled-drops-v3.0.71.json');
const key=(id,name)=>id+'\0'+name,covered=new Set([...r71.rows.map(r=>key(r.monsterId,r.name)),...coverage.followUpV3072.coveredOldAuditRows.map(r=>key(r.monsterId,r.name))]);
const w={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','js/wiki-data.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),w);
const db=w.window.IrunaWikiData.mergeCatalog(w.window.IrunaCatalogModel.mergeLocations(w.window.IRUNA_CATALOG_DATA,w.window.IRUNA_LOCATION_DATA));
const maps=new Map(db.maps.map(m=>[m['マップID'],m['マップ名']])),items=new Map(db.items.map(i=>[i['アイテムID'],i]));
function reason(name,type){return /ちび雪ダルマ|ミニハニワ/.test(name)?'島オブジェクトの分類・用途を日本語資料で確認':name==='愛叫マイク'?'日本語能力説明を確認（英語説明から補完しない）':'分類・強化段階・同名ID・元出典のLvを個別照合';}
const remaining=audit.monsters.flatMap(m=>m.missing.filter(x=>!covered.has(key(m.id,x.name))).map(x=>({monsterId:m.id,monsterName:m.name,historicalLv:m.lv,sourceMonsterIds:m.sourceIds,mapNames:[...new Set(db.spawns.filter(s=>s['モンスターID']===m.id).map(s=>maps.get(s['マップID'])).filter(Boolean))],name:x.name,sourceType:x.type,candidates:x.candidateIds.map(id=>({id,name:items.get(id)?.['名前']||null,type:items.get(id)?.['分類']||null})),nextCheck:reason(x.name,x.type),status:'未照合'})));
assert.equal(remaining.length,68,'historical audit reconciliation changed; review before updating');
const data={preparedAt:'2026-10-31',baseline:'6ba76387bf96bca566e0b2d59fee21c534c65b4e',scope:'既存監査からの整理。新たな資料照合・残件解消を意味しない。22行と68行は重複しうる別集計。',legacyHeld:coverage.held.length,legacyUnmatched:coverage.unmatchedDrops.map(x=>({...x,nextCheck:reason(x.name,x.type),status:'未照合'})),historicalRemaining:remaining};
fs.writeFileSync('data/audit-queue-v3.0.86.json',JSON.stringify(data,null,2)+'\n');
console.log('Review queue: '+data.legacyUnmatched.length+' legacy rows, '+remaining.length+' historical rows; held '+data.legacyHeld);
