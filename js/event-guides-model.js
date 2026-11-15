"use strict";
globalThis.IrunaEventGuidesModel = (() => {
  const DONE = 'irunadb_event_done_v1', OWNED = 'irunadb_event_owned_v1';
  const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const read = (storage, key) => {
    try { const v = JSON.parse(storage.getItem(key) || '[]'); return new Set(Array.isArray(v) ? v.filter(x => typeof x === 'string') : []); }
    catch { return new Set(); }
  };
  const matches = (g, query) => norm([g.title,g.family,g.year,g.entry,g.requirement,g.unlock,...g.steps,...g.items.map(x=>x.name)].join(' ')).includes(norm(query));
  const sourceUrl = value => {
    try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'irnsnk.com' && !u.username && !u.password && !u.port && /^\/(halloween-event|valentineevent|whitedayevent)\/$/.test(u.pathname) && !u.search ? u.href : ''; }
    catch { return ''; }
  };
  return Object.freeze({DONE, OWNED, read, matches, sourceUrl});
})();
