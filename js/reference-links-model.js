'use strict';
((root)=>{
 const normalize=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/\s/g,'');
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function create(data){
  const byName=new Map(),trie=new Map(),records=new Map(),active=r=>r['有効']!==false&&String(r['有効']).toUpperCase()!=='FALSE';
  for(const [kind,rows,idKey,nameKey] of [['item',data.items,'アイテムID','名前'],['monster',data.monsters,'モンスターID','名前'],['map',data.maps,'マップID','マップ名']]){
   for(const row of rows.filter(active)){const key=normalize(row[nameKey]);if(!key)continue;const entry={kind,id:row[idKey],name:row[nameKey],row};records.set(kind+'|'+entry.id,entry);if(!byName.has(key))byName.set(key,[]);if(!byName.get(key).some(e=>e.kind===kind&&e.id===entry.id))byName.get(key).push(entry);}
  }
  for(const key of byName.keys()){let node=trie;for(const char of key){if(!node.has(char))node.set(char,new Map());node=node.get(char);}node.key=key;}
  function resolve(name,kinds=['item','monster','map']){return (byName.get(normalize(name))||[]).filter(e=>kinds.includes(e.kind));}
  function mapped(text){let normalized='',starts=[],ends=[],offset=0;for(const char of text){const n=normalize(char);for(let j=0;j<n.length;j++){starts.push(offset);ends.push(offset+char.length);}normalized+=n;offset+=char.length;}return{normalized,starts,ends};}
  function tokens(value,kinds=['item','monster','map']){
   const text=String(value??''),{normalized:s,starts,ends}=mapped(text),out=[];let cursor=0;
   for(let i=0;i<s.length;){let node=trie,best=null,j=i;
    if(i>0&&starts[i]===starts[i-1]){i++;continue;}
    const before=s.slice(0,i),beforeOK=i===0||/[・･、,。:：/／()（）「」『』→⇒【】\d]$/.test(before)||/(?:から|または|および|又は|と|を|に|で|の|は|へ|が|や)$/.test(before);
    if(!beforeOK){i++;continue;}
    while(j<s.length&&node.has(s[j])){node=node.get(s[j++]);if(!node.key)continue;const rest=s.slice(j),afterOK=!rest||/^(?:[×x\d・･、,。:：/／()（）「」『』【】]|lv\d|を|へ|に|と|が|から|で|まで|より|や|付近|入口)/.test(rest);if(!afterOK)continue;
     const candidates=resolve(node.key,kinds);if(candidates.length&&(node.key.length>1||i===0&&(!rest||/^[×x]\d/.test(rest))))best={end:j,key:node.key,candidates};
    }
    if(!best){i++;continue;}const start=starts[i],end=ends[best.end-1];if(start>cursor)out.push({text:text.slice(cursor,start)});out.push({text:text.slice(start,end),key:best.key,kinds,candidates:best.candidates});cursor=end;i=best.end;
   }if(cursor<text.length)out.push({text:text.slice(cursor)});return out;
  }
  const labels={item:'アイテム詳細・入手先',monster:'出現場所・ドロップ',map:'マップのモンスター'};
  function html(text,kinds){return tokens(text,kinds).map(t=>t.key?'<button type="button" class="reference-link" data-reference-name="'+esc(t.key)+'" data-reference-kinds="'+esc(t.kinds.join(','))+'" title="'+esc([...new Set(t.candidates.map(e=>labels[e.kind]))].join(' / '))+'">'+esc(t.text)+'</button>':esc(t.text)).join('');}
  return{resolve,tokens,html,records};
 }
 const api={create,normalize,esc};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.IrunaReferenceModel=api;
})(typeof window==='undefined'?globalThis:window);
