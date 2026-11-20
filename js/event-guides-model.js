"use strict";
globalThis.IrunaEventGuidesModel = (() => {
  const DONE = 'irunadb_event_done_v1', OWNED = 'irunadb_event_owned_v1';
  const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const read = (storage, key) => {
    try { const v = JSON.parse(storage.getItem(key) || '[]'); return new Set(Array.isArray(v) ? v.filter(x => typeof x === 'string') : []); }
    catch { return new Set(); }
  };
  const matches = (g, query) => norm([g.title,g.family,g.year,g.entry,g.requirement,g.unlock,...g.steps,...g.items.filter(x=>!x.archived).map(x=>x.name+" "+(x.obtain||""))].join(' ')).includes(norm(query));
  const sourceUrl = value => {
    try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'irnsnk.com' && !u.username && !u.password && !u.port && /^\/(halloween-event|valentineevent|whitedayevent)\/$/.test(u.pathname) && !u.search ? u.href : ''; }
    catch { return ''; }
  };
  const lootMatches = (x, query, guides) => norm([x.name,x.family,x.method,x.place,x.target,x.condition,...guides.filter(g=>x.guideIds.includes(g.id)).map(g=>g.title+" "+(g.year||""))].join(" ")).includes(norm(query));
  const seasonalFamily = title => ['ハロウィン', 'クリスマス'].find(family => String(title).includes(family)) || '';
  const years = guides => [...new Set(guides.map(g => g.year).filter(Number.isInteger))].sort((a,b) => b-a);
  function dropGroups(loot, guideId) {
    const groups = new Map();
    for (const row of loot) {
      if (row.method !== 'ドロップ' || !row.guideIds.includes(guideId)) continue;
      const key = JSON.stringify([row.target, row.place]);
      if (!groups.has(key)) groups.set(key, {target:row.target, place:row.place, drops:[]});
      groups.get(key).drops.push(row);
    }
    return [...groups.values()];
  }
  function dropSlots(drops) {
    const slots = Array.from({length:4}, () => ({status:'unknown'}));
    const unplaced = [];
    for (const row of drops) {
      for (const slot of row.emptySlots || []) slots[slot-1] = {status:'empty'};
      for (const slot of row.slots || []) slots[slot-1] = {status:'item', name:row.name};
      if (!(row.slots || []).length) unplaced.push(row);
    }
    return {slots, unplaced};
  }
  return Object.freeze({DONE, OWNED, read, matches, lootMatches, sourceUrl, seasonalFamily, years, dropGroups, dropSlots});
})();
