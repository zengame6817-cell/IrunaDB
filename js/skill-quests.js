"use strict";
(() => {
  const data = window.IRUNA_SKILL_QUEST_DATA || {jobs:[],quests:[]};
  const STORE = "irunadb_skillquest_done_v1";
  const state = {
    job: data.jobs[0] || "",
    query: "",
    hideDone: false,
    maxLevel: 999,
    done: new Set(JSON.parse(localStorage.getItem(STORE)||"[]"))
  };
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=v=>String(v||"").toLowerCase().replace(/[\s　]+/g,"");
  const save=()=>localStorage.setItem(STORE,JSON.stringify([...state.done]));

  function renderJobs(){
    const el=document.getElementById("sqJobTabs"); if(!el)return;
    el.innerHTML=data.jobs.map(j=>`<button type="button" class="sq-job-tab ${j===state.job?"is-active":""}" data-job="${esc(j)}">${esc(j)}</button>`).join("");
    el.querySelectorAll("[data-job]").forEach(b=>b.addEventListener("click",()=>{state.job=b.dataset.job;renderAll();}));
  }
  function match(q){
    if(state.hideDone && state.done.has(q.id)) return false;
    if(Number(q.level||0)>state.maxLevel) return false;
    const s=norm([q.skill,q.quest,q.location,...(q.requirements||[])].join(" "));
    return !state.query || s.includes(norm(state.query));
  }
  function renderList(){
    const list=document.getElementById("sqList"), count=document.getElementById("sqCount");
    if(!list)return;
    const rows=data.quests.filter(q=>q.job===state.job && match(q)).sort((a,b)=>(a.level-b.level)||a.skill.localeCompare(b.skill,"ja"));
    if(count) count.textContent=`${rows.length}件`;
    let last=-1, out=[];
    rows.forEach(q=>{
      if(q.level!==last){last=q.level; out.push(`<div class="mission-chapter"><span>${q.level?`Lv.${q.level}`:"転職"}</span></div>`);}
      const done=state.done.has(q.id);
      out.push(`<details class="mission-card ${done?"is-complete":""}">
        <summary>
          <label class="mission-done-check" title="完了"><input type="checkbox" data-sq-done="${esc(q.id)}" ${done?"checked":""}><span></span></label>
          <div class="mission-card-title"><strong>${esc(q.skill)}</strong><small>${esc(q.quest||"スキルクエスト")} / ${esc(q.location||"")}</small></div>
          <b class="mission-chevron">＋</b>
        </summary>
        <div class="mission-card-body">
          ${(q.requirements||[]).length?`<div class="sq-requirements">${q.requirements.map((x,i)=>`<div class="mission-step"><i>${i+1}</i><p>${esc(x)}</p></div>`).join("")}</div>`:`<div class="mission-empty">必要素材・討伐の詳細は出典ページで確認してください。</div>`}
          ${q.note?`<p class="sq-note">${esc(q.note)}</p>`:""}
          <a class="sq-source-link" href="${esc(q.source)}" target="_blank" rel="noopener">出典ページを開く ↗</a>
        </div></details>`);
    });
    list.innerHTML=out.length?out.join(""):`<div class="mission-empty">条件に一致するスキルクエストはありません。</div>`;
    list.querySelectorAll("[data-sq-done]").forEach(cb=>cb.addEventListener("change",()=>{cb.checked?state.done.add(cb.dataset.sqDone):state.done.delete(cb.dataset.sqDone);save();renderProgress();}));
  }
  function renderProgress(){
    const all=data.quests.filter(q=>q.job===state.job), done=all.filter(q=>state.done.has(q.id)).length;
    const t=document.getElementById("sqProgressText"), b=document.getElementById("sqProgressBar");
    if(t)t.textContent=`${done} / ${all.length}`;
    if(b)b.style.width=`${all.length?done/all.length*100:0}%`;
  }
  function renderAll(){renderJobs();renderList();renderProgress();}
  function boot(){
    const job=document.getElementById("sqJobSelect");
    if(job){job.innerHTML=data.jobs.map(j=>`<option>${esc(j)}</option>`).join(""); job.value=state.job; job.addEventListener("change",()=>{state.job=job.value;renderAll();});}
    const search=document.getElementById("sqSearchInput"); if(search)search.addEventListener("input",()=>{state.query=search.value;renderList();});
    const hide=document.getElementById("sqHideCompleted"); if(hide)hide.addEventListener("change",()=>{state.hideDone=hide.checked;renderList();});
    const lvl=document.getElementById("sqLevelFilter"); if(lvl)lvl.addEventListener("change",()=>{state.maxLevel=Number(lvl.value)||999;renderList();});
    document.querySelectorAll("[data-mission-mode]").forEach(btn=>btn.addEventListener("click",()=>{
      const mode=btn.dataset.missionMode;
      document.querySelectorAll("[data-mission-mode]").forEach(x=>x.classList.toggle("is-active",x===btn));
      document.getElementById("missionStoryMode")?.classList.toggle("is-hidden",mode!=="ms");
      document.getElementById("skillQuestMode")?.classList.toggle("is-hidden",mode!=="sq");
    }));
    renderAll();
  }
  document.addEventListener("DOMContentLoaded",boot);
})();