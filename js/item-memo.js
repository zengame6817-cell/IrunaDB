"use strict";
(() => {
  const key = "irunadb.itemMemo.v1", env = window.IrunaEnvironment;
  const trigger = document.getElementById("itemMemoToggle");
  const dialog = document.createElement("dialog");
  dialog.id = "itemMemoDialog"; dialog.setAttribute("aria-labelledby","itemMemoTitle");
  dialog.innerHTML = `<header><h2 id="itemMemoTitle">アイテムメモ</h2><button type="button" data-memo-close aria-label="メモを閉じる">×</button></header>
    <p>必要なアイテムを一時保存。チェックは入手済みの目印です。このブラウザーに自動保存します。</p>
    <form id="itemMemoForm"><label for="itemMemoName">アイテム名</label><div class="item-memo-entry"><input id="itemMemoName" maxlength="200" required autocomplete="off" placeholder="例：赤鉄鉱"><button class="button" type="submit">追加</button></div></form>
    <p id="itemMemoMessage" role="status" aria-live="polite"></p><ul id="itemMemoList"></ul>
    <button type="button" class="button button-secondary" id="itemMemoClearDone">チェック済みを削除</button>`;
  document.body.appendChild(dialog);
  const list = dialog.querySelector("ul"), message = dialog.querySelector("[role=status]"), input = dialog.querySelector("input");
  let rows = [], writable = true;
  const normalize = s => s.normalize("NFKC").trim().toLowerCase();
  function render() {
    trigger.textContent = rows.length ? `メモ ${rows.filter(r=>!r.done).length}` : "メモ";
    trigger.setAttribute("aria-label",`アイテムメモを開く（未入手 ${rows.filter(r=>!r.done).length}件）`);
    list.replaceChildren();
    for (const row of rows) {
      const li = document.createElement("li"), label = document.createElement("label"), check = document.createElement("input"), text = document.createElement("span"), remove = document.createElement("button");
      check.type = "checkbox"; check.checked = row.done; check.disabled = !writable;
      text.textContent = row.name; label.append(check,text); li.classList.toggle("is-done",row.done);
      check.addEventListener("change",() => { if (!save(rows.map(r=>r.id===row.id?{...r,done:check.checked}:r))) check.checked = row.done; });
      remove.type = "button"; remove.textContent = "削除"; remove.disabled = !writable; remove.setAttribute("aria-label",`${row.name}をメモから削除`);
      remove.addEventListener("click",() => save(rows.filter(r=>r.id!==row.id)));
      li.append(label,remove); list.appendChild(li);
    }
    if (!rows.length) { const li = document.createElement("li");li.textContent = "まだメモはありません。名前を入力するか、レシピの素材から追加できます。";list.appendChild(li); }
    input.disabled = !writable; dialog.querySelector("[type=submit]").disabled = !writable;
    dialog.querySelector("#itemMemoClearDone").disabled = !writable || !rows.some(r=>r.done);
  }
  function read() {
    try { const raw = localStorage.getItem(key); if (raw !== null) env.validateValue(key,raw); rows = raw === null ? [] : JSON.parse(raw); writable = true; }
    catch (e) { writable = false; message.textContent = `メモを読み込めませんでした。保存内容は変更していません：${e.message}`; }
    render();
  }
  function save(next) {
    if (!writable) return false;
    try { const raw = JSON.stringify(next); env.validateValue(key,raw); localStorage.setItem(key,raw); rows = next; render(); message.textContent = "メモを保存しました。"; return true; }
    catch (e) { message.textContent = `保存できませんでした：${e.message}`; return false; }
  }
  function add(name) {
    name = String(name || "").trim(); if (!name || name.length > 200) return false;
    const match = rows.find(r=>normalize(r.name)===normalize(name));
    const next = match ? rows.map(r=>r===match?{...r,done:false}:r) : [...rows,{id:crypto.randomUUID(),name,done:false}];
    const ok = save(next); if (ok) message.textContent = `「${name}」をメモに追加しました。`; return ok;
  }
  trigger.addEventListener("click",() => { if (!dialog.open) { dialog.showModal();input.focus(); } });
  dialog.querySelector("[data-memo-close]").addEventListener("click",() => dialog.close());
  dialog.addEventListener("click",e => { if (e.target===dialog) { const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close(); } });
  dialog.querySelector("form").addEventListener("submit",e => { e.preventDefault(); if(add(input.value)){input.value="";input.focus();} });
  dialog.querySelector("#itemMemoClearDone").addEventListener("click",() => save(rows.filter(r=>!r.done)));
  document.addEventListener("click",e => {
    const button=e.target.closest("[data-memo-add]");if(!button)return;
    const ok=add(button.dataset.memoAdd);button.textContent=ok?"メモ済み":"保存できません";
    if(!ok&&!dialog.open)dialog.showModal();
  });
  window.addEventListener("storage",e => {if(e.key===key)read();});
  window.IrunaItemMemo = {add,decorate(item) {
    const button=document.createElement("button");button.type="button";button.className="button button-secondary";button.dataset.memoAdd=item["名前"];button.textContent="アイテムメモに追加";
    document.getElementById("modalEffectArea").appendChild(button);
  }};
  read();
})();
