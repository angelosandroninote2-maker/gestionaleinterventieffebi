// mock Firebase v12 (app/auth/firestore) con contatore letture; stato condiviso in window.__mock (per pagina)
const APP = `export const initializeApp = c => ({c});`;
const AUTH = `
const M = window.__mock || (window.__mock = {});
M.authCb = []; M.user = M.user || null;
export const getAuth = () => ({});
export const onAuthStateChanged = (a, cb) => { M.authCb.push(cb); setTimeout(() => cb(M.user), 0); return () => {}; };
const login = email => { M.user = {uid: 'u1', email}; M.authCb.forEach(cb => cb(M.user)); return Promise.resolve({user: M.user}); };
export const signInWithEmailAndPassword = (a, e) => login(e);
export const createUserWithEmailAndPassword = (a, e) => login(e);
export const signOut = () => { M.user = null; M.authCb.forEach(cb => cb(null)); return Promise.resolve(); };
export const sendPasswordResetEmail = () => Promise.resolve();
`;
const FS = `
const M = window.__mock || (window.__mock = {});
M.docs = M.docs || {}; M.reads = 0; M.subs = new Set(); M.log = [];
const clone = o => JSON.parse(JSON.stringify(o));
export const initializeFirestore = () => ({}); export const getFirestore = () => ({});
export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({});
export const doc = (db, c, id) => ({t: 'doc', c, id});
export const collection = (db, c) => ({t: 'col', c, w: [], m: []});
export const where = (f, op, v) => ({k: 'w', f, op, v});
export const orderBy = (f) => ({k: 'o', f}); export const limit = n => ({k: 'l', n}); export const startAfter = d => ({k: 's', d});
export const query = (c, ...a) => ({t: 'col', c: c.c, w: c.w.concat(a.filter(x => x.k === 'w')), m: c.m.concat(a.filter(x => x.k !== 'w'))});
export const increment = n => ({__inc: n});
export const serverTimestamp = () => ({__ts: 1});
export const Timestamp = {fromMillis: n => n};
const test = (d, w) => { const v = d[w.f];
  switch (w.op) { case '==': return v === w.v; case '>': return v > w.v; case '>=': return v >= w.v; case '<': return v < w.v; case '<=': return v <= w.v; case 'in': return w.v.includes(v); case 'array-contains': return (v || []).includes(w.v); } return false; };
const run = q => { let out = Object.keys(M.docs).filter(k => k.startsWith(q.c + '/') && k.split('/').length === 2).map(k => M.docs[k]).filter(d => q.w.every(w => test(d, w)));
  const o = q.m.find(x => x.k === 'o'); if (o) out.sort((a, b) => String(a[o.f]) < String(b[o.f]) ? -1 : 1);
  const s = q.m.find(x => x.k === 's'); if (s) { const i = out.findIndex(d => d.id === s.d.id); out = out.slice(i + 1); }
  const l = q.m.find(x => x.k === 'l'); if (l) out = out.slice(0, l.n); return out; };
const snapQ = docs => ({docs: docs.map(d => ({id: d.id, data: () => clone(d)})), size: docs.length, empty: !docs.length, metadata: {fromCache: false}});
const snapD = r => { const d = M.docs[r.c + '/' + r.id]; return {id: r.id, exists: () => !!d, data: () => d ? clone(d) : undefined, metadata: {}}; };
const cnt = (n, what) => { M.reads += Math.max(1, n); M.log.push([what, Math.max(1, n)]); };
export const getDoc = r => { cnt(1, 'getDoc ' + r.c + '/' + r.id); return Promise.resolve(snapD(r)); };
export const getDocs = q => { const r = run(q); cnt(r.length, 'getDocs ' + q.c + JSON.stringify(q.w)); return Promise.resolve(snapQ(r)); };
export const getCountFromServer = q => { const r = run(q); cnt(Math.ceil(r.length / 1000), 'count ' + q.c); return Promise.resolve({data: () => ({count: r.length})}); };
export const onSnapshot = (r, fn, err) => {
  const s = {r, fn, last: null};
  const fire = () => { if (r.t === 'doc') { const d = M.docs[r.c + '/' + r.id], j = JSON.stringify(d || null); if (j === s.last) return; s.last = j; cnt(1, 'snap ' + r.c + '/' + r.id); fn(snapD(r)); }
    else { const res = run(r), sig = {}; res.forEach(d => sig[d.id] = JSON.stringify(d)); const prev = s.last || {}; let ch = 0;
      Object.keys(sig).forEach(k => { if (prev[k] !== sig[k]) ch++; }); Object.keys(prev).forEach(k => { if (!(k in sig)) ch++; });
      if (s.last && !ch) return; s.last = sig; cnt(s.lastFired ? ch : res.length, 'snap ' + r.c + JSON.stringify(r.w)); s.lastFired = true; fn(snapQ(res)); } };
  s.fire = fire; M.subs.add(s); setTimeout(fire, 0); return () => M.subs.delete(s); };
M.touch = () => M.subs.forEach(s => s.fire());
const put = (k, v, merge) => { const cur = M.docs[k] || {}; const o = merge ? Object.assign({}, cur) : {}; Object.keys(v).forEach(f => { const x = v[f]; o[f] = x && x.__inc !== undefined ? (Number(cur[f]) || 0) + x.__inc : x && x.__ts ? Date.now() : x; }); M.docs[k] = o; };
const later = () => { setTimeout(M.touch, 0); return Promise.resolve(); };
export const setDoc = (r, v, opt) => { put(r.c + '/' + r.id, v, opt && opt.merge); return later(); };
export const updateDoc = (r, v) => { if ((M.deny || []).includes(r.c)) return Promise.reject({code: 'permission-denied'}); put(r.c + '/' + r.id, v, true); return later(); };
export const deleteDoc = r => { delete M.docs[r.c + '/' + r.id]; return later(); };
export const writeBatch = () => { const ops = []; return {set: (r, v) => ops.push(() => put(r.c + '/' + r.id, v)), update: (r, v) => ops.push(() => put(r.c + '/' + r.id, v, true)), delete: r => ops.push(() => delete M.docs[r.c + '/' + r.id]), commit: () => { ops.forEach(f => f()); return later(); }}; };
`;
module.exports = {APP, AUTH, FS};
