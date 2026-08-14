"use strict";
(() => {
  const data = window.IRUNA_SKILL_QUEST_DATA || {jobs:[],quests:[]};
  const STORE = "irunadb_skillquest_done_v1";
  const state = {
    job: data.jobs[0] || "",
    query: "",
    hideDone: false,
    maxLevel: 999,
    acquisition: "all",
    done: new Set(JSON.parse(localStorage.getItem(STORE)||"[]"))
  };
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=v=>String(v||"").toLowerCase().replace(/[\s　]+/g,"");
  const save=()=>localStorage.setItem(STORE,JSON.stringify([...state.done]));
  const acqLabel=t=>({quest:"クエスト",shop:"スキル書購入",drop:"ドロップ・その他",transfer:"転職時入手"}[t]||"その他");

  function renderJobs(){
    const el=document.getElementById("sqJobTabs"); if(!el)return;
    el.innerHTML=data.jobs.map(j=>`<button type="button" class="sq-job-tab ${j===state.job?"is-active":""}" data-job="${esc(j)}">${esc(j)}</button>`).join("");
    el.querySelectorAll("[data-job]").forEach(b=>b.addEventListener("click",()=>{state.job=b.dataset.job; const sel=document.getElementById("sqJobSelect");if(sel)sel.value=state.job;renderAll();}));
  }
  function match(q){
    if(state.hideDone && state.done.has(q.id)) return false;
    if(Number(q.level||0)>state.maxLevel) return false;
    if(state.acquisition!=="all" && (q.acquisitionType||"quest")!==state.acquisition) return false;
    const s=norm([q.skill,q.quest,q.location,q.book,q.seller,q.dropFrom,q.note,...(q.requirements||[])].join(" "));
    return !state.query || s.includes(norm(state.query));
  }
  function renderBooks(){
    const list=document.getElementById("skBookList"), title=document.getElementById("skBookTitle"), count=document.getElementById("skBookCount");
    if(!list)return;
    if(title) title.textContent=`${state.job} スキル本まとめ`;
    const rows=data.quests.filter(q=>q.job===state.job && q.book && ["shop","drop"].includes(q.acquisitionType)).sort((a,b)=>(a.level-b.level)||a.skill.localeCompare(b.skill,"ja"));
    if(count)count.textContent=`${rows.length}件`;
    list.innerHTML=rows.length?rows.map(q=>`<div class="sk-book-row"><div><strong>${esc(q.book)}</strong><small>Lv.${esc(q.level||"-")} / ${esc(q.skill)}</small></div><div class="sk-book-meta"><span class="sk-acq-badge sk-${esc(q.acquisitionType)}">${esc(acqLabel(q.acquisitionType))}</span><b>${esc(q.price||q.dropFrom||"")}</b><small>${esc(q.seller||q.location||"")}</small></div></div>`).join(""):`<div class="mission-empty">登録済みのスキル本はありません。</div>`;
  }
  function detailBlock(q){
    const t=q.acquisitionType||"quest";
    if(t==="shop") return `<div class="sk-detail-grid"><div><span>スキル書</span><strong>${esc(q.book||"-")}</strong></div><div><span>販売場所</span><strong>${esc(q.seller||q.location||"-")}</strong></div><div><span>価格</span><strong>${esc(q.price||"-")}</strong></div></div>`;
    if(t==="drop") return `<div class="sk-detail-grid"><div><span>スキル書</span><strong>${esc(q.book||"-")}</strong></div><div><span>入手場所</span><strong>${esc(q.location||q.seller||"-")}</strong></div><div><span>ドロップ元</span><strong>${esc(q.dropFrom||"-")}</strong></div></div>`;
    if(t==="transfer") return `<div class="sk-detail-grid"><div><span>入手方法</span><strong>転職時に習得・入手</strong></div>${q.book?`<div><span>スキル書</span><strong>${esc(q.book)}</strong></div>`:""}</div>`;
    return `${(q.requirements||[]).length?`<div class="sq-requirements">${q.requirements.map((x,i)=>`<div class="mission-step"><i>${i+1}</i><p>${esc(x)}</p></div>`).join("")}</div>`:`<div class="mission-empty">追加の収集・討伐条件はありません。</div>`}`;
  }
  function renderList(){
    const list=document.getElementById("sqList"), count=document.getElementById("sqCount");
    if(!list)return;
    const rows=data.quests.filter(q=>q.job===state.job && match(q)).sort((a,b)=>(a.level-b.level)||a.skill.localeCompare(b.skill,"ja"));
    if(count) count.textContent=`${rows.length}件`;
    let last=-1, out=[];
    rows.forEach(q=>{
      if(q.level!==last){last=q.level; out.push(`<div class="mission-chapter"><span>${q.level?`Lv.${q.level}`:"転職"}</span></div>`);}
      const done=state.done.has(q.id), t=q.acquisitionType||"quest";
      out.push(`<details class="mission-card ${done?"is-complete":""}">
        <summary>
          <label class="mission-done-check" title="習得済み"><input type="checkbox" data-sq-done="${esc(q.id)}" ${done?"checked":""}><span></span></label>
          <div class="mission-card-title"><strong>${esc(q.skill)}</strong><small><span class="sk-acq-badge sk-${esc(t)}">${esc(acqLabel(t))}</span>${esc(q.quest||q.book||q.location||"")}</small></div>
          <b class="mission-chevron">＋</b>
        </summary>
        <div class="mission-card-body">
          ${q.location?`<div class="sk-location"><span>場所</span><strong>${esc(q.location)}</strong></div>`:""}
          ${detailBlock(q)}
          ${q.note?`<p class="sq-note">${esc(q.note)}</p>`:""}
        </div></details>`);
    });
    list.innerHTML=out.length?out.join(""):`<div class="mission-empty">条件に一致するスキル習得情報はありません。</div>`;
    list.querySelectorAll("[data-sq-done]").forEach(cb=>{cb.addEventListener("click",e=>e.stopPropagation());cb.addEventListener("change",()=>{cb.checked?state.done.add(cb.dataset.sqDone):state.done.delete(cb.dataset.sqDone);save();renderProgress();});});
  }
  function renderProgress(){
    const all=data.quests.filter(q=>q.job===state.job), done=all.filter(q=>state.done.has(q.id)).length;
    const t=document.getElementById("sqProgressText"), b=document.getElementById("sqProgressBar");
    if(t)t.textContent=`${done} / ${all.length}`;
    if(b)b.style.width=`${all.length?done/all.length*100:0}%`;
  }
  function renderAll(){renderJobs();renderBooks();renderList();renderProgress();}
  function boot(){
    const job=document.getElementById("sqJobSelect");
    if(job){job.innerHTML=data.jobs.map(j=>`<option>${esc(j)}</option>`).join(""); job.value=state.job; job.addEventListener("change",()=>{state.job=job.value;renderAll();});}
    const search=document.getElementById("sqSearchInput"); if(search){let t=0;search.addEventListener("input",()=>{state.query=search.value;clearTimeout(t);t=setTimeout(renderList,120);});}
    const hide=document.getElementById("sqHideCompleted"); if(hide)hide.addEventListener("change",()=>{state.hideDone=hide.checked;renderList();});
    const lvl=document.getElementById("sqLevelFilter"); if(lvl)lvl.addEventListener("change",()=>{state.maxLevel=Number(lvl.value)||999;renderList();});
    const acq=document.getElementById("sqAcqFilter"); if(acq)acq.addEventListener("change",()=>{state.acquisition=acq.value;renderList();});
    renderAll();
  }
  document.addEventListener("DOMContentLoaded",boot);
})();
