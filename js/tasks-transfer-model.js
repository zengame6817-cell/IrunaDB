'use strict';
((root)=>{
 const M=typeof module!=='undefined'&&module.exports?require('./tasks-model.js'):root.IrunaTasksModel;
 const backupKey='irunadb.tasks.beforeImport.v1',maxBytes=20*1024*1024;
 const bytes=text=>new TextEncoder().encode(text).length;
 function clean(data){M.validate(data);return {version:1,tasks:data.tasks.map(t=>{const copy={};for(const k of ['id','title','group','character','note','eventTitle','repeat','days','time','track','quantity','target','pace','tower'])if(Object.hasOwn(t,k))copy[k]=structuredClone(t[k]);return copy;}),history:data.history.map(h=>({taskId:h.taskId,title:h.title,character:h.character,group:h.group,period:h.period,day:h.day}))};}
 function validateFile(file){if(!file||file.format!=='IrunaDB-tasks'||file.schemaVersion!==1||typeof file.createdAt!=='string'||!Number.isFinite(Date.parse(file.createdAt))||typeof file.appVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(file.appVersion))throw Error('タスク専用の保存ファイルではありません');const data=clean(file.data),result={format:'IrunaDB-tasks',schemaVersion:1,createdAt:file.createdAt,appVersion:file.appVersion,data};if(bytes(JSON.stringify(result))>maxBytes)throw Error('ファイルは20MB以内にしてください');return result;}
 const pack=(data,appVersion,now=new Date())=>validateFile({format:'IrunaDB-tasks',schemaVersion:1,createdAt:now.toISOString(),appVersion,data});
 function parse(text){if(typeof text!=='string'||bytes(text)>maxBytes)throw Error('ファイルは20MB以内にしてください');return validateFile(JSON.parse(text));}
 function backup(storage){const raw=storage.getItem(backupKey);if(raw===null)return null;const b=JSON.parse(raw);if(!b||b.version!==1||typeof b.savedAt!=='string'||!Number.isFinite(Date.parse(b.savedAt))||b.raw!==null&&typeof b.raw!=='string')throw Error('取り込み前のバックアップを読み込めません');return b;}
 function replace(file,storage,now=new Date()){const next=validateFile(file).data,raw=storage.getItem(M.key);storage.setItem(backupKey,JSON.stringify({version:1,savedAt:now.toISOString(),raw}));storage.setItem(M.key,JSON.stringify(next));return next;}
 function restore(storage){const b=backup(storage);if(!b)throw Error('取り込み前のバックアップがありません');if(b.raw===null)storage.removeItem(M.key);else storage.setItem(M.key,b.raw);}
 const api={backupKey,maxBytes,clean,validateFile,pack,parse,backup,replace,restore};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IrunaTasksTransfer=api;
})(typeof window==='undefined'?globalThis:window);

