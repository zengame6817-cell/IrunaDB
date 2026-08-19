/** IrunaDB v1.5: DB + Skill DB GitHub一括公開 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('IrunaDB')
    .addItem('公開DB＋スキルDBをGitHubへ更新', 'publishAllDatabaseToGitHub')
    .addSeparator().addItem('GitHub接続テスト', 'testGitHubConnection').addToUi();
}

function publishAllDatabaseToGitHub() {
  const ui = SpreadsheetApp.getUi();
  try {
    const data = getAllData();
    const generatedAt = new Date().toISOString();
    const payload = {success:true, version:'1.5.0', generatedAt, counts:createDataCounts_(data), data};
    uploadTextFileToGitHub_('data/db.json', JSON.stringify(payload), 'Update IrunaDB public database');

    const skillData = buildSkillDataFromSheets_();
    uploadTextFileToGitHub_('data/skills.js', 'window.IRUNA_SKILL_DATA = '+JSON.stringify(skillData)+';\n', 'Update IrunaDB skill database');

    const questData = buildSkillQuestDataFromSheets_();
    if (questData.quests.length) uploadTextFileToGitHub_('data/skill-quests.js', 'window.IRUNA_SKILL_QUEST_DATA = '+JSON.stringify(questData, null, 2)+';\n', 'Update IrunaDB skill acquisition database');

    ui.alert('公開DB更新完了',
      'db.json / skills.js / skill-quests.js を更新しました。\n\n'+
      'SKILL：'+skillData.skills.length+'\nSKILL_EFFECT：'+skillData.effects.length+'\nSKILL_CONDITION：'+skillData.conditions.length+'\n取得情報：'+questData.quests.length,
      ui.ButtonSet.OK);
  } catch (error) {
    console.error(error); ui.alert('公開DB更新エラー', error.message, ui.ButtonSet.OK); throw error;
  }
}

// 旧メニュー名との互換
function publishDatabaseToGitHub(){ publishAllDatabaseToGitHub(); }

function buildSkillDataFromSheets_(){
  return {
    jobs: readSheetObjects_('JOB_MASTER', true),
    skills: readSheetObjects_('SKILL_MASTER', true),
    effects: readSheetObjects_('SKILL_EFFECT_MASTER', true),
    conditions: readSheetObjects_('SKILL_CONDITION_MASTER', true),
    unverified: readSheetObjects_('SKILL_UNVERIFIED', false)
  };
}

function buildSkillQuestDataFromSheets_(){
  const rows=readSheetObjects_('SKILL_ACQUISITION', false);
  const jobs=[]; const seen={};
  const quests=rows.map((r,i)=>{
    const job=String(r['職業名']||'').trim(); if(job&&!seen[job]){seen[job]=1;jobs.push(job);}
    const type=String(r['取得区分']||'').trim();
    const price=r['価格(万スピナ)'];
    const req=String(r['必要素材・討伐']||'').split(/[／\n]/).map(s=>s.trim()).filter(Boolean);
    return {
      id:'SK'+String(i+1).padStart(4,'0'), job:job,
      level:Number(r['必要Lv']||0), skill:String(r['スキル名']||'')+(r['SLv']?'SLv.'+r['SLv']:''),
      quest:String(r['クエスト名']||''), location:String(r['場所']||''), requirements:req,
      note:String(r['備考']||''), source:String(r['出典']||''),
      acquisitionType:type==='スキル書'?'shop':(type==='ドロップ'?'drop':'quest'),
      book:String(r['スキル書名']||''),
      price:price!==''&&price!=null ? String(price)+'万スピナ' : '',
      seller:[r['場所'],r['NPC']].filter(Boolean).join('・'), dropFrom:''
    };
  });
  return {version:'2.9.3',jobs:jobs,quests:quests};
}

function readSheetObjects_(name, required){
  const sh=SpreadsheetApp.getActive().getSheetByName(name);
  if(!sh){ if(required) throw new Error('必要シートがありません：'+name); return []; }
  const values=sh.getDataRange().getValues(); if(values.length<2)return [];
  const headers=values[0].map(v=>String(v).trim());
  return values.slice(1).filter(row=>row.some(v=>v!==''&&v!=null)).filter(row=>{
    const i=headers.indexOf('有効'); if(i<0)return true; const v=String(row[i]).toUpperCase(); return !['FALSE','0','無効'].includes(v);
  }).map(row=>{const o={}; headers.forEach((h,i)=>{if(h)o[h]=row[i]===''?null:row[i];}); return o;});
}

function testGitHubConnection() {
  const s=getGitHubSettings_(); const url=`https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}`;
  const r=UrlFetchApp.fetch(url,{method:'get',headers:createGitHubHeaders_(s.token),muteHttpExceptions:true});
  if(r.getResponseCode()!==200) throw new Error(`GitHub接続失敗 HTTP ${r.getResponseCode()}\n${r.getContentText()}`);
  const repo=JSON.parse(r.getContentText()); SpreadsheetApp.getUi().alert('GitHub接続成功',`リポジトリ：${repo.full_name}\n既定ブランチ：${repo.default_branch}\n権限：${repo.permissions?.push?'書き込み可能':'書き込み未確認'}`,SpreadsheetApp.getUi().ButtonSet.OK);
}
function uploadTextFileToGitHub_(path,text,message){
  const s=getGitHubSettings_(); const encoded=path.split('/').map(encodeURIComponent).join('/');
  const url=`https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${encoded}`;
  const old=getGitHubFile_(url,s); const body={message,content:Utilities.base64Encode(Utilities.newBlob(text,'text/plain','file').getBytes()),branch:s.branch}; if(old?.sha) body.sha=old.sha;
  const r=UrlFetchApp.fetch(url,{method:'put',contentType:'application/json',headers:createGitHubHeaders_(s.token),payload:JSON.stringify(body),muteHttpExceptions:true});
  if(![200,201].includes(r.getResponseCode())) throw new Error(`GitHub更新失敗 ${path} HTTP ${r.getResponseCode()}\n${r.getContentText()}`); return JSON.parse(r.getContentText());
}
function getGitHubFile_(url,s){const r=UrlFetchApp.fetch(`${url}?ref=${encodeURIComponent(s.branch)}`,{method:'get',headers:createGitHubHeaders_(s.token),muteHttpExceptions:true});if(r.getResponseCode()===404)return null;if(r.getResponseCode()!==200)throw new Error(`既存ファイル確認失敗 HTTP ${r.getResponseCode()}\n${r.getContentText()}`);return JSON.parse(r.getContentText());}
function getGitHubSettings_(){const p=PropertiesService.getScriptProperties().getProperties();const s={token:String(p.GITHUB_TOKEN||'').trim(),owner:String(p.GITHUB_OWNER||'').trim(),repo:String(p.GITHUB_REPO||'').trim(),branch:String(p.GITHUB_BRANCH||'main').trim()};const missing=Object.entries(s).filter(([,v])=>!v).map(([k])=>k);if(missing.length)throw new Error(`スクリプトプロパティ不足：${missing.join(', ')}`);return s;}
function createGitHubHeaders_(token){return{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};}
function createDataCounts_(data){const counts={};Object.keys(data).forEach(k=>counts[k]=Array.isArray(data[k])?data[k].length:0);return counts;}
