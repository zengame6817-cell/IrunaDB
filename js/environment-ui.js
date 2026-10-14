"use strict";
(() => {
  const env = window.IrunaEnvironment;
  const el = id => document.getElementById(id);
  const message = text => { el("environmentMessage").textContent = text; };
  let pending = null, readNumber = 0;
  function download(value, name) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    if (blob.size > 10 * 1024 * 1024) throw new Error("環境が10MBを超えています。不要な保存枠を整理してから保存してください。");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function live() {
    if (!window.IrunaEnvironmentBridge?.ready()) throw new Error("DBの読み込み完了後に操作してください。");
    if (env.recoveryError) throw new Error(`中断した取り込みの復元に失敗しました：${env.recoveryError.message}`);
    return window.IrunaEnvironmentBridge.capture();
  }
  function reload() {
    // A pre-import share URL must not override the newly imported draft.
    const url = new URL(location.href); url.searchParams.delete("build");
    history.replaceState({}, "", url); location.reload();
  }
  el("environmentExport").addEventListener("click", () => {
    try {
      const file = env.exportFile(live());
      download(file, `IrunaDB-environment-v${file.appVersion}-${file.createdAt.replace(/[:.]/g, "-")}.json`);
      message("環境をJSONファイルに保存しました。");
    } catch (e) { message(`保存できませんでした：${e.message}`); }
  });
  el("environmentFile").addEventListener("change", async event => {
    const number = ++readNumber; pending = null; el("environmentImport").disabled = true;
    el("environmentPreview").textContent = "";
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("ファイルは10MB以内にしてください。");
      const value = env.validate(JSON.parse(await file.text()));
      if (number !== readNumber) return;
      env.plan(value); // Also validate existing collections before enabling import.
      const count = k => value.storage[k] ? JSON.parse(value.storage[k]).filter(Boolean).length : 0;
      el("environmentPreview").textContent = `作成：${new Date(value.createdAt).toLocaleString("ja-JP")} / アプリ：v${value.appVersion}\n保存ビルド：${count("irunadb.savedBuilds.v21")}件追加\nレリック保存枠：${count("irunadb.savedRgSlots.v1")}件追加\nお気に入り：${value.storage["irunadb.favorites"] !== undefined ? count("irunadb.favorites") + "件で上書き" : "ファイルにないため現在の設定を保持"}\n編集中のビルド・ステータス・スキル・配置候補と、ファイル内のユーザー設定を反映します。同名の保存枠には連番を付けて保持します。`;
      pending = value; el("environmentImport").disabled = false; message("内容を確認して「取り込む」を押してください。");
    } catch (e) { if (number === readNumber) message(`読み込めませんでした：${e.message}。既存データは変更していません。`); }
  });
  el("environmentImport").addEventListener("click", () => {
    if (!pending) return;
    try {
      env.commit(pending, live()); pending = null; el("environmentImport").disabled = true;
      message("取り込みが完了しました。再読み込みします。"); reload();
    } catch (e) { message(`取り込みできませんでした：${e.message}。取り込み前のデータを保持しています。`); }
  });
  el("environmentRollback").addEventListener("click", () => {
    try { live(); env.rollback(); reload(); } catch (e) { message(`復元できませんでした：${e.message}`); }
  });
  el("environmentBackupExport").addEventListener("click", () => {
    try {
      const b = env.readBackup(); if (!b) throw new Error("バックアップがありません。");
      download(env.validate({ format: "IrunaDB-environment", schemaVersion: 1, createdAt: b.createdAt,
        appVersion: window.IRUNA_CONFIG.APP_VERSION, storage: { ...b.storage, [env.DRAFT]: JSON.stringify(b.current) } }), "IrunaDB-before-import.json");
      message("取り込み前の環境を保存しました。");
    } catch (e) { message(`保存できませんでした：${e.message}`); }
  });
  try {
    const b = env.readBackup();
    el("environmentRollback").disabled = !b; el("environmentBackupExport").disabled = !b;
    if (b) message(`前回の取り込み前バックアップ：${new Date(b.createdAt).toLocaleString("ja-JP")}`);
    if (env.recoveryError) message(`復元エラー：${env.recoveryError.message}`);
  } catch (e) { message(`バックアップ確認エラー：${e.message}`); }
})();
