/**
 * IrunaDB API + GitHub Static DB Publisher Ver1.1
 *
 * スクリプトプロパティに設定:
 * GITHUB_TOKEN  Fine-grained PAT（Contents: Read and write）
 * GITHUB_OWNER  GitHubユーザー名
 * GITHUB_REPO   リポジトリ名
 * GITHUB_BRANCH 公開ブランチ（通常 main）
 * GITHUB_DB_PATH data/db.json
 */

const SHEET_CONFIG = {
  items: { sheetName: 'ITEM_MASTER', idColumn: 'アイテムID' },
  effects: { sheetName: 'EFFECT_MASTER', idColumn: '効果ID' },
  conditions: { sheetName: 'CONDITION_MASTER', idColumn: '条件ID' },
  stats: { sheetName: 'STAT_MASTER', idColumn: '能力ID' },
  attributes: { sheetName: 'ATTRIBUTE_MASTER', idColumn: '属性ID' },
  attributeEffects: { sheetName: 'ATTRIBUTE_EFFECT_MASTER', idColumn: '属性相性ID' },
  jobs: { sheetName: 'JOB_MASTER', idColumn: '職業ID' },
  tags: { sheetName: 'TAG_MASTER', idColumn: 'タグID' },
  itemTags: { sheetName: 'ITEM_TAG', idColumn: 'アイテムタグID' },
  relicPatterns: { sheetName: 'RELIC_PATTERN_MASTER', idColumn: 'レリックパターンID' }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('IrunaDB')
    .addItem('公開用DBをGitHubへ更新', 'publishDatabaseToGitHub')
    .addItem('公開設定を確認', 'showGitHubPublishSettings')
    .addToUi();
}

function doGet(e) {
  try {
    const action = String(e?.parameter?.action || 'all');
    let result;
    if (action === 'all') {
      result = getAllData();
    } else {
      const config = SHEET_CONFIG[action];
      if (!config) {
        return createJsonResponse({ success: false, error: `不明なactionです: ${action}`, availableActions: [...Object.keys(SHEET_CONFIG), 'all'] });
      }
      result = readMasterSheet(config.sheetName, config.idColumn);
    }
    return createJsonResponse({ success: true, action, updatedAt: new Date().toISOString(), data: result });
  } catch (error) {
    console.error(error);
    return createJsonResponse({ success: false, error: error.message, stack: error.stack });
  }
}

function getAllData() {
  const result = {};
  Object.entries(SHEET_CONFIG).forEach(([key, config]) => {
    result[key] = readMasterSheet(config.sheetName, config.idColumn);
  });
  return result;
}

function readMasterSheet(sheetName, idColumnName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error(`シートが見つかりません: ${sheetName}`);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 3 || lastColumn < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(header => String(header).trim());
  const values = sheet.getRange(3, 1, lastRow - 2, lastColumn).getValues();
  const idIndex = headers.indexOf(idColumnName);
  const activeIndex = headers.indexOf('有効');
  if (idIndex === -1) throw new Error(`${sheetName}にID列「${idColumnName}」がありません`);

  return values.filter(row => {
    const id = String(row[idIndex] ?? '').trim();
    if (!id) return false;
    return activeIndex === -1 || toBoolean(row[activeIndex]);
  }).map(row => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = normalizeValue(row[index]);
    });
    return record;
  });
}

function normalizeValue(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (value === null || value === undefined) return '';
  return value;
}

function toBoolean(value) {
  if (value === true) return true;
  const text = String(value ?? '').trim().toUpperCase();
  return text === 'TRUE' || text === '1' || text === 'YES' || text === '有効';
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function publishDatabaseToGitHub() {
  const ui = SpreadsheetApp.getUi();
  try {
    const settings = getGitHubPublishSettings_();
    const data = getAllData();
    const counts = Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length]));
    const payload = {
      success: true,
      version: '1.0',
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      counts,
      data
    };
    const json = JSON.stringify(payload);
    const result = putGitHubFile_(settings, json);
    ui.alert('公開用DB更新完了', `data/db.jsonを更新しました。\n\nITEM: ${counts.items || 0}件\nEFFECT: ${counts.effects || 0}件\nCONDITION: ${counts.conditions || 0}件\n\nGitHub: ${result.content?.html_url || '更新完了'}`, ui.ButtonSet.OK);
  } catch (error) {
    console.error(error);
    ui.alert('公開用DB更新エラー', error.message, ui.ButtonSet.OK);
    throw error;
  }
}

function getGitHubPublishSettings_() {
  const props = PropertiesService.getScriptProperties();
  const settings = {
    token: props.getProperty('GITHUB_TOKEN'),
    owner: props.getProperty('GITHUB_OWNER'),
    repo: props.getProperty('GITHUB_REPO'),
    branch: props.getProperty('GITHUB_BRANCH') || 'main',
    path: props.getProperty('GITHUB_DB_PATH') || 'data/db.json'
  };
  const missing = [];
  if (!settings.token) missing.push('GITHUB_TOKEN');
  if (!settings.owner) missing.push('GITHUB_OWNER');
  if (!settings.repo) missing.push('GITHUB_REPO');
  if (missing.length) throw new Error(`スクリプトプロパティが未設定です: ${missing.join(', ')}`);
  return settings;
}

function putGitHubFile_(settings, jsonText) {
  const encodedPath = settings.path.split('/').map(encodeURIComponent).join('/');
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodedPath}`;
  const headers = {
    Authorization: `Bearer ${settings.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  let sha = '';
  const getResponse = UrlFetchApp.fetch(`${apiUrl}?ref=${encodeURIComponent(settings.branch)}`, {
    method: 'get', headers, muteHttpExceptions: true
  });
  if (getResponse.getResponseCode() === 200) {
    sha = JSON.parse(getResponse.getContentText()).sha || '';
  } else if (getResponse.getResponseCode() !== 404) {
    throw new Error(`GitHub既存ファイル確認失敗 (${getResponse.getResponseCode()}): ${getResponse.getContentText()}`);
  }

  const body = {
    message: `Update IrunaDB static database ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')}`,
    content: Utilities.base64Encode(jsonText, Utilities.Charset.UTF_8),
    branch: settings.branch
  };
  if (sha) body.sha = sha;

  const response = UrlFetchApp.fetch(apiUrl, {
    method: 'put', headers: { ...headers, 'Content-Type': 'application/json' },
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) throw new Error(`GitHub更新失敗 (${code}): ${text}`);
  return JSON.parse(text);
}

function showGitHubPublishSettings() {
  const props = PropertiesService.getScriptProperties();
  SpreadsheetApp.getUi().alert('GitHub公開設定', [
    `GITHUB_OWNER: ${props.getProperty('GITHUB_OWNER') || '未設定'}`,
    `GITHUB_REPO: ${props.getProperty('GITHUB_REPO') || '未設定'}`,
    `GITHUB_BRANCH: ${props.getProperty('GITHUB_BRANCH') || 'main'}`,
    `GITHUB_DB_PATH: ${props.getProperty('GITHUB_DB_PATH') || 'data/db.json'}`,
    `GITHUB_TOKEN: ${props.getProperty('GITHUB_TOKEN') ? '設定済み' : '未設定'}`
  ].join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function testApi() {
  console.log(JSON.stringify(readMasterSheet('ITEM_MASTER', 'アイテムID'), null, 2));
}

function testStaticDatabasePayload() {
  const data = getAllData();
  console.log(JSON.stringify({ success: true, generatedAt: new Date().toISOString(), counts: Object.fromEntries(Object.entries(data).map(([k,v]) => [k,v.length])), data }).slice(0, 5000));
}
