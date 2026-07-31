"use strict";

window.IrunaModal = (() => {
  const modal = document.getElementById("detailModal");
  const title = document.getElementById("modalTitle");
  const category = document.getElementById("modalCategory");
  const details = document.getElementById("modalDetails");
  const closeButton = document.getElementById("modalCloseButton");
  const { escapeHtml, isBlank } = window.IrunaUtils;

  const hiddenFields = new Set(["有効"]);

  function open(item) {
    title.textContent = item["名前"] || "名称未設定";
    category.textContent = item["分類"] || "未分類";

    const rows = Object.entries(item)
      .filter(([key, value]) => {
        return !hiddenFields.has(key) &&
          key !== "名前" &&
          key !== "分類" &&
          !isBlank(value);
      })
      .map(([key, value]) => `
        <dt>${escapeHtml(key)}</dt>
        <dd>${escapeHtml(value)}</dd>
      `)
      .join("");

    details.innerHTML = rows || `
      <dt>情報</dt>
      <dd>詳細情報はまだ登録されていません。</dd>
    `;

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  closeButton.addEventListener("click", close);

  modal.querySelectorAll("[data-close-modal]").forEach(element => {
    element.addEventListener("click", close);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      close();
    }
  });

  return {
    open,
    close
  };
})();
