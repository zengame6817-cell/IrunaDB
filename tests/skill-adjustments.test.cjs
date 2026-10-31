'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function load(){const el={innerHTML:''},w={},c={window:w,URL,document:{getElementById:()=>el}};for(const f of ['data/skills.js','data/skill-supplement-v3.0.85.js','data/skill-quests.js','js/utils.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),c);const before=JSON.stringify(w.IRUNA_SKILL_DATA);for(const f of ['data/skill-adjustments-v3.0.86.js','js/skill-effect-guide.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),c);return {w,el,before};}
test('official changes remain informational and cover real job names without mutating build data',()=>{
 const {w,before}=load(),d=w.IRUNA_SKILL_ADJUSTMENTS;assert.equal(JSON.stringify(w.IRUNA_SKILL_DATA),before);assert.equal(d.buildApplied,false);assert.equal(d.entries.length,17);
 for(const e of d.entries)assert(w.IRUNA_SKILL_QUEST_DATA.jobs.includes(e.job),e.job);
 for(const url of d.sources)assert(w.IrunaUtils.isPublicSourceUrl(url));
});
test('changes absent from the skill master are still visible; search and quest matching stay scoped',()=>{
 const {w,el}=load();w.IrunaSkillGuide.render('ネクロマンサー');assert(el.innerHTML.includes('ネクロブリゲイド'));assert(el.innerHTML.includes('ビルド計算に反映していません'));assert(!el.innerHTML.includes('猛虎砲功'));
 w.IrunaSkillGuide.render('ニンジャ','無音');assert(el.innerHTML.includes('武器ATK'));w.IrunaSkillGuide.render('ニンジャ','存在しない');assert(!el.innerHTML.includes('公式スキル調整'));
 assert(w.IrunaSkillGuide.forQuest({job:'モンク',skill:'猛虎砲功SLv.1'}).includes('固定+10'));assert(!w.IrunaSkillGuide.forQuest({job:'モンク',skill:'チャクラ'}).includes('固定+10'));
 w.IrunaSkillGuide.render('パラディン');assert(el.innerHTML.includes('検証記事の参考値'));assert(!el.innerHTML.includes('ameblo.jp'));
});
test('historical review counts remain separate and retain candidate identities',()=>{
 const q=JSON.parse(fs.readFileSync('data/audit-queue-v3.0.86.json'));assert.equal(q.legacyHeld,582);assert.equal(q.legacyUnmatched.length,22);assert.equal(q.historicalRemaining.length,68);assert(q.historicalRemaining.every(r=>r.monsterId&&r.status==='未照合'&&Array.isArray(r.candidates)));assert(q.historicalRemaining.some(r=>r.name==='ミニハニワ'));
});
