
"use strict";
(() => {
  const data = window.IRUNA_MISSION_DATA || { episodes: [], missions: [], items: [] };
  if (!data.missions?.length) {
    console.error("IrunaDB MS: mission data is empty.");
  }
  const STORAGE_DONE = "irunadb_mission_done_v1";
  const STORAGE_OWNED = "irunadb_mission_owned_v1";
  const state = {
    ep: data.episodes[0] || "EP1",
    query: "",
    hideCompleted: false,
    hideOwned: false,
    done: new Set(JSON.parse(localStorage.getItem(STORAGE_DONE) || "[]")),
    owned: new Set(JSON.parse(localStorage.getItem(STORAGE_OWNED) || "[]"))
  };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));

  const save = () => {
    localStorage.setItem(STORAGE_DONE, JSON.stringify([...state.done]));
    localStorage.setItem(STORAGE_OWNED, JSON.stringify([...state.owned]));
  };

  const normalize = s => String(s || "").toLowerCase().replace(/\s+/g, "");

  function renderEpTabs() {
    const el = document.getElementById("missionEpTabs");
    if (!el) return;
    el.innerHTML = data.episodes.map(ep =>
      `<button type="button" class="mission-ep-tab ${ep===state.ep?"is-active":""}" data-ep="${esc(ep)}">${esc(ep)}</button>`
    ).join("");
    el.querySelectorAll("[data-ep]").forEach(btn => btn.addEventListener("click", () => {
      state.ep = btn.dataset.ep;
      renderAll();
    }));
  }

  function renderProgress() {
    const rows = data.missions.filter(m => m.ep === state.ep);
    const completed = rows.filter(m => state.done.has(m.id)).length;
    const text = document.getElementById("missionProgressText");
    const bar = document.getElementById("missionProgressBar");
    if (text) text.textContent = `${completed} / ${rows.length}`;
    if (bar) bar.style.width = `${rows.length ? completed / rows.length * 100 : 0}%`;
  }

  function renderItems() {
    const title = document.getElementById("missionItemTitle");
    const list = document.getElementById("missionItemList");
    if (!list) return;
    if (title) title.textContent = `${state.ep} 必要アイテムまとめ`;

    const rows = data.items.filter(x => x.ep === state.ep && (!state.hideOwned || !state.owned.has(x.id)));
    list.innerHTML = rows.length ? rows.map(x => `
      <label class="mission-item ${state.owned.has(x.id) ? "is-owned" : ""}">
        <input type="checkbox" data-item-owned="${esc(x.id)}" ${state.owned.has(x.id) ? "checked" : ""}>
        <span class="mission-item-main">
          <strong>${esc(x.name)} <b>×${esc(x.qty)}</b></strong>
          <small>${esc(x.region)} / ${esc(x.usedIn)}</small>
          <em>${esc(x.note)}</em>
        </span>
      </label>
    `).join("") : `<div class="mission-empty">表示するアイテムはありません。</div>`;

    list.querySelectorAll("[data-item-owned]").forEach(cb => cb.addEventListener("change", () => {
      cb.checked ? state.owned.add(cb.dataset.itemOwned) : state.owned.delete(cb.dataset.itemOwned);
      save(); renderItems();
    }));
  }

  function missionMatches(m) {
    if (state.hideCompleted && state.done.has(m.id)) return false;
    const q = normalize(state.query);
    if (!q) return true;
    return normalize([
      m.title, m.chapter, m.region, m.rewards,
      ...(m.steps || [])
    ].join(" ")).includes(q);
  }

  function renderMissions() {
    const list = document.getElementById("missionList");
    const count = document.getElementById("missionResultCount");
    if (!list) return;

    const rows = data.missions.filter(m => m.ep === state.ep && missionMatches(m));
    if (count) count.textContent = `${rows.length}件`;

    let lastChapter = "";
    const blocks = [];
    rows.forEach(m => {
      if (m.chapter !== lastChapter) {
        lastChapter = m.chapter;
        blocks.push(`<div class="mission-chapter"><span>${esc(m.chapter)}</span></div>`);
      }
      const done = state.done.has(m.id);
      blocks.push(`
        <details class="mission-card ${done ? "is-complete" : ""}">
          <summary>
            <label class="mission-done-check" title="完了">
              <input type="checkbox" data-mission-done="${esc(m.id)}" ${done ? "checked" : ""}>
              <span></span>
            </label>
            <div class="mission-card-title">
              <strong>${esc(m.title)}</strong>
              <small>${m.exp ? `${m.exp.toLocaleString("ja-JP")} EXP` : ""}${m.rewards ? ` / ${esc(m.rewards)}` : ""}</small>
            </div>
            <b class="mission-chevron">＋</b>
          </summary>
          <div class="mission-card-body">
            ${m.steps.map((step, idx) => `<div class="mission-step"><i>${idx+1}</i><p>${esc(step)}</p></div>`).join("")}
          </div>
        </details>
      `);
    });
    list.innerHTML = blocks.length ? blocks.join("") : `<div class="mission-empty">条件に一致するミッションはありません。</div>`;

    list.querySelectorAll("[data-mission-done]").forEach(cb => {
      cb.addEventListener("click", e => e.stopPropagation());
      cb.addEventListener("change", () => {
        cb.checked ? state.done.add(cb.dataset.missionDone) : state.done.delete(cb.dataset.missionDone);
        save(); renderProgress(); renderMissions();
      });
    });
  }

  function renderAll() {
    renderEpTabs(); renderProgress(); renderItems(); renderMissions();
  }

  
  function initMissionUI() {
    const search = document.getElementById("missionSearchInput");
    const hideDone = document.getElementById("missionHideCompleted");
    const hideOwned = document.getElementById("missionHideOwned");
    if (!search || !hideDone || !hideOwned) return;

    if (!search.dataset.missionBound) {
      search.dataset.missionBound = "1";
      search.addEventListener("input", e => {
        state.query = e.target.value;
        renderMissions();
      });
      hideDone.addEventListener("change", e => {
        state.hideCompleted = e.target.checked;
        renderMissions();
      });
      hideOwned.addEventListener("change", e => {
        state.hideOwned = e.target.checked;
        renderItems();
      });
    }
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMissionUI, { once: true });
  } else {
    initMissionUI();
  }
})();