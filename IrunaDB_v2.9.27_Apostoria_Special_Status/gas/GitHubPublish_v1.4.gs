/** IrunaDB v1.4 GitHub公開機能（既存APIコードへ追加） */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('IrunaDB')
    .addItem('公開用DBをGitHubへ更新', 'publishDatabaseToGitHub')
    .addSeparator().addItem('GitHub接続テスト', 'testGitHubConnection').addToUi();
}
function publishDatabaseToGitHub() {
  const ui = SpreadsheetApp.getUi();
  try {
    const data = getAllData();
    const generatedAt = new Date().toISOString();
    const payload = { success:true, version:'1.4.0', generatedAt, counts:createDataCounts_(data), data };
    uploadTextFileToGitHub_('data/db.json', JSON.stringify(payload), 'Update IrunaDB public database');
    ui.alert('公開DB更新完了', `GitHubの data/db.json を更新しました。\n\nITEM：${payload.counts.items||0}\nEFFECT：${payload.counts.effects||0}\nCONDITION：${payload.counts.conditions||0}`, ui.ButtonSet.OK);
  } catch (error) { console.error(error); ui.alert('公開DB更新エラー', error.message, ui.ButtonSet.OK); throw error; }
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
  const old=getGitHubFile_(url,s); const body={message,content:Utilities.base64Encode(Utilities.newBlob(text,'application/json').getBytes()),branch:s.branch}; if(old?.sha) body.sha=old.sha;
  const r=UrlFetchApp.fetch(url,{method:'put',contentType:'application/json',headers:createGitHubHeaders_(s.token),payload:JSON.stringify(body),muteHttpExceptions:true});
  if(![200,201].includes(r.getResponseCode())) throw new Error(`GitHub更新失敗 HTTP ${r.getResponseCode()}\n${r.getContentText()}`); return JSON.parse(r.getContentText());
}
function getGitHubFile_(url,s){const r=UrlFetchApp.fetch(`${url}?ref=${encodeURIComponent(s.branch)}`,{method:'get',headers:createGitHubHeaders_(s.token),muteHttpExceptions:true});if(r.getResponseCode()===404)return null;if(r.getResponseCode()!==200)throw new Error(`既存ファイル確認失敗 HTTP ${r.getResponseCode()}\n${r.getContentText()}`);return JSON.parse(r.getContentText());}
function getGitHubSettings_(){const p=PropertiesService.getScriptProperties().getProperties();const s={token:String(p.GITHUB_TOKEN||'').trim(),owner:String(p.GITHUB_OWNER||'').trim(),repo:String(p.GITHUB_REPO||'').trim(),branch:String(p.GITHUB_BRANCH||'main').trim()};const missing=Object.entries(s).filter(([,v])=>!v).map(([k])=>k);if(missing.length)throw new Error(`スクリプトプロパティ不足：${missing.join(', ')}`);return s;}
function createGitHubHeaders_(token){return{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};}
function createDataCounts_(data){const counts={};Object.keys(data).forEach(k=>counts[k]=Array.isArray(data[k])?data[k].length:0);return counts;}
