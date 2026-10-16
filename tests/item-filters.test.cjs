const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data/item-effects.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(root,'js/item-filters.js'),'utf8'),ctx);
const filters=ctx.window.IrunaItemFilters;
test('all 448 consumable descriptions use existing catalog IDs and exact names',()=>{
 vm.runInNewContext(fs.readFileSync(path.join(root,'data/catalog.js'),'utf8'),ctx);
 const data=ctx.window.IRUNA_CATALOG_DATA,rows=Object.entries(ctx.window.IRUNA_ITEM_EFFECTS);
 assert.equal(rows.length,448);
 for(const [id,r] of rows){const item=data.items.find(i=>i['アイテムID']===id);assert(item);assert.equal(item['名前'],r.name);assert.equal(item['分類'],'消費');assert(r.text.length>0);}
});
test('recovery matching distinguishes HP from MP and MaxHP buffs',()=>{
 const hp={'アイテムID':'MAT000169','分類':'消費'},mp={'アイテムID':'MAT000172','分類':'消費'};
 assert(filters.matches(hp,'hp'));assert(!filters.matches(hp,'mp'));
 assert(filters.matches(mp,'mp'));assert(!filters.matches(mp,'hp'));
 assert(!filters.matches({'説明文':'MaxHP+500。MPを20回復'},'hp'));
 assert(!filters.matches({'説明文':'HPを消費してMPを回復'},'hp'));
 assert(filters.matches({'説明文':'HP・MPを回復'},'hp'));assert(filters.matches({'説明文':'HP・MPを回復'},'mp'));
 assert.equal(filters.kind(hp),'recovery');assert.equal(filters.kind({'分類':'素材'}),'material');
 assert.equal(filters.kind({'分類':'武器'}),'equipment');
});
test('missing efficacy stays unknown and text is searched without guessing from names',()=>{
 const unknown={'名前':'HP回復のような名前','説明文':'生産レシピ用の参照データ。効果未照合'};
 assert(filters.matches(unknown,'unknown'));assert(!filters.matches(unknown,'hp'));
 assert(filters.matches({'説明文':'魔法耐性+7%'},'defense','魔法耐性'));
 assert(!filters.matches({'説明文':'魔法耐性+7%'},'defense','HP回復'));
});
