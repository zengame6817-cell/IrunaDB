const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),root=path.resolve(__dirname,'..');
const M=require('../js/reference-links-model.js'),S=require('../data/skill-supplement-v3.0.85.js');
test('public source links allow only Iruna Wiki and official hosts; blog evidence remains internal',()=>{
 const w=load(),el={innerHTML:''},c={window:w,URL,document:{getElementById:()=>el}};w.IRUNA_SKILL_DATA=S.apply(w.IRUNA_SKILL_DATA);
 for(const f of ['js/utils.js','js/skill-effect-guide.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),c);
 const valid=w.IrunaUtils.isPublicSourceUrl;
 for(const url of ['https://wikiwiki.jp/iruna-online/スキル','https://irunawiki.com/ja_JP/skill/x','https://android.iruna.jp/info?no=1','https://iphone.iruna.jp/info','https://irunablog.iruna.jp/'])assert(valid(url),url);
 for(const url of ['https://ameblo.jp/pdhegaud/entry-12802072305.html','https://irnsnk.com/','https://wikiwiki.jp/other/','https://android.iruna.jp.example.org/','https://android.iruna.jp@evil.test/','javascript:alert(1)','https://android.iruna.jp:8080/'])assert(!valid(url),url);
 w.IrunaSkillGuide.render('パラディン');assert(el.innerHTML.includes('MaxHP+15%'));assert(el.innerHTML.includes('検証記事の参考値'));assert(!el.innerHTML.includes('ameblo.jp'));assert(!el.innerHTML.includes('irnsnk.com'));assert(el.innerHTML.includes('https://wikiwiki.jp/iruna-online/'));
});
function load(){const c={window:{}};for(const f of ['js/catalog-model.js','data/catalog.js','data/locations.js','data/wiki.js','js/wiki-data.js','data/skills.js'])vm.runInNewContext(fs.readFileSync(path.join(root,f),'utf8'),c);return c.window;}
test('name links retain ambiguous item and monster identities, crystal symbols and text safety',()=>{
 const d={items:[{'アイテムID':'a','名前':'記憶の欠片'},{'アイテムID':'b','名前':'記憶の欠片'},{'アイテムID':'c','名前':'◇プロボーグ'},{'アイテムID':'d','名前':'◆プロボーグ'},{'アイテムID':'off','名前':'無効','有効':'FALSE'}],monsters:[{'モンスターID':'m1','名前':'ゴースト'},{'モンスターID':'m2','名前':'ゴースト'}],maps:[{'マップID':'p','マップ名':'ロココの街'}]},m=M.create(d);
 assert.equal(m.resolve('記憶の欠片',['item']).length,2);assert.equal(m.resolve('ゴースト',['monster']).length,2);assert.equal(m.resolve('◇プロボーグ',['item'])[0].id,'c');assert.equal(m.resolve('◆プロボーグ',['item'])[0].id,'d');assert.equal(m.resolve('無効').length,0);
 assert.equal(m.tokens('記憶の欠片×30',['item']).filter(x=>x.key).length,1);assert.equal(m.tokens('ゴーストLv50×3体',['monster']).filter(x=>x.key).length,1);assert.equal(m.tokens('スーパーゴースト',['monster']).filter(x=>x.key).length,0);assert.equal(m.tokens('ロココの街･アレン',['map']).filter(x=>x.key).length,1);
 assert(!m.html('<img src=x onerror=alert(1)>',['item']).includes('<img'));assert(!m.html('ロココの街･アレン',['monster']).includes('<button'));
});
test('registered skill-quest names resolve to existing DB items; unknown maps stay plain',()=>{
 const w=load(),d=w.IrunaWikiData.mergeCatalog(w.IrunaCatalogModel.mergeLocations(w.IRUNA_CATALOG_DATA,w.IRUNA_LOCATION_DATA)),m=M.create(d);
 assert(m.resolve('小悪魔の角',['item']).some(x=>x.id==='MAT001329'));assert(m.resolve('記憶の欠片',['item']).length>=2);assert(!m.html('存在しないマップ',['map']).includes('<button'));
});
test('supplement is idempotent and preserves original skill effects and default selections',()=>{
 const w=load(),before=JSON.stringify(w.IRUNA_SKILL_DATA),d=S.apply(w.IRUNA_SKILL_DATA),again=S.apply(d);
 assert.equal(JSON.stringify(w.IRUNA_SKILL_DATA),before);assert.equal(JSON.stringify(d),JSON.stringify(again));assert.equal(d.skills.length,w.IRUNA_SKILL_DATA.skills.length+2);assert.equal(d.effects.length,w.IRUNA_SKILL_DATA.effects.length+5);
 for(const row of w.IRUNA_SKILL_DATA.effects)assert.equal(JSON.stringify(d.effects.find(e=>e['スキル効果ID']===row['スキル効果ID'])),JSON.stringify(row));
 assert.equal(d.skills.find(s=>s['スキルID']==='PALSK000006')['初期選択'],'FALSE');for(const id of ['PALSK000011','PALSK000012'])assert.equal(d.skills.find(s=>s['スキルID']===id)['初期選択'],'FALSE');
 assert.equal(d.effects.find(e=>e['スキル効果ID']==='JPSE085005')['検証状態'],'検証記事の参考値');
});
test('build uses selected levels only and includes HP reference only when Grand Crusade is selected',()=>{
 const d=S.apply(load().IRUNA_SKILL_DATA),code=fs.readFileSync(path.join(root,'js/app-v3.0.55.js'),'utf8').match(/function collectSelectedSkillEffects\(\) \{[\s\S]*?\n  \}/)[0],skills=d.skills.filter(s=>s['職業ID']==='JOB003'),bySkill=new Map();for(const e of d.effects){const id=e['スキルID'];if(!bySkill.has(id))bySkill.set(id,[]);bySkill.get(id).push(e);}
 const c={context:{skillsByJob:new Map([['JOB003',skills]]),skillEffectsBySkill:bySkill},state:{status:{jobId:'JOB003'},selectedSkills:new Set()},skillEffectConditionsPass:()=>true,evaluateSkillFormula:()=>NaN};vm.runInNewContext(code,c);
 const sum=stat=>c.collectSelectedSkillEffects().rows.filter(r=>r.statId===stat&&r.unit==='%').reduce((n,r)=>n+r.value,0),baseHP=sum('MaxHP'),baseATK=sum('ATK');
 c.state.selectedSkills.add('PALSK000012');assert.equal(sum('MaxHP')-baseHP,12);assert.equal(sum('ATK')-baseATK,12);
 c.state.selectedSkills.add('PALSK000006');assert.equal(sum('MaxHP')-baseHP,27);assert.equal(sum('ATK')-baseATK,12);
 c.state.selectedSkills.delete('PALSK000012');c.state.selectedSkills.add('PALSK000011');assert.equal(sum('MaxHP')-baseHP,23);assert.equal(sum('ATK')-baseATK,8);
 c.state.selectedSkills.clear();assert.equal(sum('MaxHP'),baseHP);
});
