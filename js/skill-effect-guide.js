'use strict';
(()=>{
 const esc=window.IrunaUtils.escapeHtml,norm=s=>String(s||'').normalize('NFKC').replace(/(?:SLv|Lv)[\s.]*\d+/gi,'').replace(/\s/g,'');
 function rows(job){const d=window.IRUNA_SKILL_DATA||{},j=(d.jobs||[]).find(j=>j['職業名']===job);return j?(d.skills||[]).filter(s=>s['職業ID']===j['職業ID']&&s['カテゴリ']!=='ペットスキル'&&String(s['有効']).toUpperCase()!=='FALSE'):[];}
 function effects(skill){return (window.IRUNA_SKILL_DATA?.effects||[]).filter(e=>e['スキルID']===skill['スキルID']&&String(e['有効']).toUpperCase()!=='FALSE');}
 function card(name,list){const sources=[...new Set(list.flatMap(s=>String(s['出典']||'').match(/https?:\/\/[^\s]+/g)||[]))].filter(window.IrunaUtils.isPublicSourceUrl);
  return '<article class="skill-effect-card"><h4>'+esc(name)+'</h4>'+list.map(s=>{const es=effects(s),text=[...new Set(es.map(e=>e['表示文']||(e['能力ID']?e['能力ID']+' '+(e['値']??e['数式']??'')+(e['単位']||''):'')))].filter(Boolean).join(' ／ ');return '<div class="skill-effect-level"><strong>'+esc(s['選択肢名']||'')+'</strong><p>'+esc(text||s['説明文']||s['特殊効果']||'効果の詳しい数値は未登録です。')+'</p>'+(text&&s['説明文']?'<small>'+esc(s['説明文'])+'</small>':'')+'<small>'+(es.some(e=>String(e['ビルド反映']).toUpperCase()==='TRUE'&&e['能力ID'])?'ビルド用効果あり':'説明のみ')+(s['検証状態']==='検証記事の参考値'?' · 検証記事の参考値':'')+'</small></div>';}).join('')+(sources.length?'<p class="skill-effect-sources">'+sources.slice(0,3).map((url,i)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">効果の資料'+(sources.length>1?' '+(i+1):'')+' ↗</a>').join(' ')+'</p>':'')+'</article>';
 }
 function adjustments(job,query='',skill=''){
  const d=window.IRUNA_SKILL_ADJUSTMENTS;if(!d)return '';
  const entries=d.entries.filter(e=>e.job===job&&(!skill||norm(e.skill)===norm(skill))&&(!query||norm(e.skill+' '+e.summary).includes(norm(query))));
  if(!entries.length)return '';
  const sources=d.sources.filter(window.IrunaUtils.isPublicSourceUrl);
  return '<article class="skill-effect-card skill-adjustment-notice"><h4>2026/10/28 公式スキル調整</h4><p>公式で実施確認済み。変更後の数値・式は未照合のため、この案内はビルド計算に反映していません。</p>'+entries.map(e=>'<p><strong>'+esc(e.skill)+'</strong>：'+esc(e.summary)+'</p>').join('')+'<small>資料確認日：'+esc(d.checkedAt)+'</small><p class="skill-effect-sources">'+sources.map((url,i)=>'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+(i===0?'調整の事前告知':'実施・追加変更のお知らせ')+' ↗</a>').join(' ')+'</p></article>';
 }
 function render(job,query=''){const el=document.getElementById('sqEffects');if(!el)return;const groups=new Map();for(const s of rows(job)){if(query&&!norm([s['スキル名'],s['説明文'],...effects(s).map(e=>e['表示文'])].join(' ')).includes(norm(query)))continue;const name=s['スキル名'];if(!groups.has(name))groups.set(name,[]);groups.get(name).push(s);}el.innerHTML=(adjustments(job,query)+[...groups].map(([name,list])=>card(name,list)).join(''))||'<p>この条件の効果情報は未登録です。</p>';}
 function forQuest(q){const list=rows(q.job).filter(s=>norm(s['スキル名'])===norm(q.skill));return adjustments(q.job,'',q.skill)+(list.length?card(list[0]['スキル名'],list):'');}
 window.IrunaSkillGuide={render,forQuest};
})();
