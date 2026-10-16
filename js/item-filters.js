"use strict";
(() => {
  const root = typeof window === "undefined" ? {} : window;
  const normalize = s => String(s || "").normalize("NFKC").toLowerCase().replace(/\s+/g,"");
  const record = item => root.IRUNA_ITEM_EFFECTS?.[item["アイテムID"]];
  let effects = new Map();
  function textFor(item,extra = "") {
    let description = String(item["説明文"] || "");
    if (/参照データ|名称参照|^生産素材|^調理品$|^回復$|^一時強化アイテム$|^状態異常回復アイテム$|^移動アイテム$/.test(description)) description = "";
    return [record(item)?.text || description,item["特殊性能"],effects.get(String(item["アイテムID"])),extra].filter(Boolean).join(" ");
  }
  function kind(item) {
    if (["武器","体","追加","特殊","クリスタ","アルクリスタ","☆能力","レリック"].includes(item["分類"])) return "equipment";
    const sub = record(item)?.category || item["サブ分類"];
    if (["回復","状態異常回復アイテム"].includes(sub)) return "recovery";
    if (item["分類"] === "消費") return "consumable";
    if (sub === "島アプリ用アイテム" || /^Avatar/.test(sub || "")) return "other";
    if (["素材","収集品"].includes(item["分類"])) return "material";
    return "other";
  }
  const options = [["","すべての効能"],["hp","HP回復"],["mp","MP回復"],["status","状態異常回復"],["offense","攻撃・魔法関連"],["defense","防御・耐性関連"],["stats","ステータス上昇"],["exp","経験値関連"],["move","移動"],["unknown","効能の記載なし"]];
  function matches(item,effect = "",query = "",extra = "") {
    if (!effect && !String(query).trim()) return true;
    const text = normalize(textFor(item,extra));
    const predicates = {
      hp:() => /(^|[^a-z])hp[^。a-z]{0,24}回復/.test(text.replace(/hp[・/]mp/g,"hp")),
      mp:() => /(^|[^a-z])mp[^。a-z]{0,24}回復/.test(text),
      status:() => (record(item)?.category || item["サブ分類"]) === "状態異常回復アイテム" || /(?:毒|麻痺|暗闇|出血|凍結|気絶|状態異常)(?:状態)?(?:を|が)?(?:回復|治療|解除)/.test(text),
      offense:() => /atk|matk|魔法威力|物理威力|クリティカル|貫通/.test(text),
      defense:() => /def|耐性|軽減|回避/.test(text),
      stats:() => /(?:str|int|vit|agi|dex|crt|能力).{0,12}(?:\+|上昇|増加)/.test(text),
      exp:() => /経験値/.test(text), move:() => /移動/.test(text),
      unknown:() => !/hp|mp|atk|matk|def|str|int|vit|agi|dex|crt|耐性|軽減|回避|回復|移動|経験値|能力|威力|クリティカル|貫通/.test(text)
    };
    return (!effect || Boolean(predicates[effect]?.())) && String(query).trim().split(/\s+/).filter(Boolean).every(word => text.includes(normalize(word)));
  }
  function populate(select) { select.replaceChildren(...options.map(([value,text]) => { const o=document.createElement("option");o.value=value;o.textContent=text;return o; })); }
  function overlay(item) { const r=record(item);return r && item["分類"]==="消費" ? {...item,"サブ分類":r.category,"説明文":r.text} : item; }
  function setContext(context) {
    effects=new Map([...context.effectsByItem].map(([id,rows]) => [String(id),rows.map(r=>[context.statMap.get(String(r["能力ID"]))?.["表示名"],r["表示文"]].filter(Boolean).join(" ")).join(" ")]));
    if (typeof document !== "undefined") document.dispatchEvent(new Event("iruna-item-effects-ready"));
  }
  const api={kind,textFor,matches,populate,overlay,setContext};
  if (typeof module !== "undefined" && module.exports) module.exports=api;
  else root.IrunaItemFilters=api;
})();
