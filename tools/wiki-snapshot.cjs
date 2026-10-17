'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function unpack(text){const context={window:{}};vm.runInNewContext(text,context,{timeout:10000});if(context.window.IRUNA_WIKI_DATA?.schemaVersion!==1)throw Error('Unsupported Wiki schema');return JSON.parse(JSON.stringify(context.window.IRUNA_WIKI_DATA));}
function pack(data){
  if(data.schemaVersion!==1)throw Error('Unsupported Wiki schema');
  const strings=[],ids=new Map(),tables={};
  const encode=v=>{if(typeof v==='string'){if(!ids.has(v)){ids.set(v,strings.length);strings.push(v);}return ids.get(v);}return typeof v==='number'?[v]:v;};
  const table=rows=>{const cols=[...new Set(rows.flatMap(row=>Object.keys(row)))];return{cols,rows:rows.map(row=>cols.map(k=>Object.hasOwn(row,k)?encode(row[k]):null))};};
  for(const name of ['items','maps','monsters','spawns','drops','itemUpdates','evidence','effects',...(data.itemAliases?['itemAliases']:[]),...(data.namePrefixes?['namePrefixes']:[])])tables[name]=table(data[name]);
  for(const name of ['maps','monsters','drops'])tables['updates.'+name]=table(data.updates[name]||[]);
  return '"use strict";\n// Japanese-source snapshot; scope: docs/RELEASE_v3.0.61.md.\nwindow.IRUNA_WIKI_DATA = (() => {\n  const packed='+JSON.stringify({strings,tables})+';\n  const decode=v=>typeof v==="number"?packed.strings[v]:Array.isArray(v)?v[0]:v;\n  const result={schemaVersion:1,updatedAt:'+JSON.stringify(data.updatedAt)+',updates:{}};\n  for(const [name,table] of Object.entries(packed.tables)){const rows=table.rows.map(values=>Object.fromEntries(table.cols.flatMap((key,i)=>values[i]===null?[]:[[key,decode(values[i])]])));if(name.startsWith("updates."))result.updates[name.slice(8)]=rows;else result[name]=rows;}\n  return result;\n})();\n';
}
module.exports={pack,unpack};
if(require.main===module){
  const root=path.resolve(__dirname,'..'),mode=process.argv[2],file=path.resolve(process.argv[3]||path.join(root,'.wiki-work/wiki.json'));
  if(mode==='unpack'){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(unpack(fs.readFileSync(path.join(root,'data/wiki.js'),'utf8')),null,2));console.log(file);}
  else if(mode==='pack'){const input=JSON.parse(fs.readFileSync(file,'utf8')),output=pack(input);require('node:assert/strict').deepEqual(unpack(output),input);fs.writeFileSync(path.join(root,'data/wiki.js'),output);console.log('Saved data/wiki.js; run node --test tests/*.test.cjs');}
  else console.log('node tools/wiki-snapshot.cjs unpack [json-path]\nnode tools/wiki-snapshot.cjs pack [json-path]');
}
