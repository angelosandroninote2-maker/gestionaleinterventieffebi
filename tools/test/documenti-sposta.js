// Test: spostando un intervento i documenti allegati lo seguono anche se le regole vietano di modificarli con il finto Firebase, senza puppeteer:
// pilota Chrome direttamente (DevTools Protocol, Node 22+).
// Uso: python -m http.server 8080 (dalla radice del repo), poi
//      node tools/test/controllo.js http://localhost:8080/index.html   (CHROME=percorso di Chrome se serve)
const {spawn} = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const {APP, AUTH, FS} = require('./mock-firebase.js');
const w = ms => new Promise(r => setTimeout(r, ms)); let fails = 0;
const ok = (n, c, extra) => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra || '')); if (!c) fails++; };
const pad = n => String(n).padStart(2, '0'); const day = k => { const d = new Date(Date.now() - k * 864e5); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const D = {'utenti/u1': {email: 't@esempio.it', ruolo: 'titolare'}, 'lavoratori/w1': {id: 'w1', nome: 'Mario', attivo: true}, 'lavoratori/w3': {id: 'w3', nome: 'Gino', attivo: true},
  'interventi/j1': {id: 'j1', cliente: 'Anna Ricci', via: 'Via Roma 1', tipo: 'Riparazione', durata: 60, workerId: 'w1', stato: 'da_fare', data: day(0)},
  'foto/f1': {id: 'f1', jobId: 'j1', workerId: 'w1', giorno: day(0), doc: true, nome: 'schema.pdf', mime: 'application/pdf', size: 10, data: 'QUJD'}};
let CH = null, seq = 0; const pend = new Map(), ev = [];
const send = (method, params = {}) => new Promise(res => { const id = ++seq; pend.set(id, res); CH.send(JSON.stringify({id, method, params})); });
const ev$ = async (expr) => { const r = await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
(async () => {
  const url = process.argv[2] || 'http://localhost:8080/index.html';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-'));
  const ch = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--remote-debugging-port=9340', '--user-data-dir=' + dir, '--window-size=1366,900', 'about:blank'], {stdio: 'ignore'});
  let list = null; for (let i = 0; i < 50 && !list; i++) { await w(200); try { list = await (await fetch('http://127.0.0.1:9340/json/list')).json(); } catch(e){} }
  CH = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => CH.onopen = r);
  const errs = [];
  CH.onmessage = async m => { const x = JSON.parse(m.data); if (x.id && pend.has(x.id)) { pend.get(x.id)(x.result || x); pend.delete(x.id); return; }
    if (x.method === 'Runtime.exceptionThrown') errs.push(x.params.exceptionDetails.exception ? x.params.exceptionDetails.exception.description : x.params.exceptionDetails.text);
    if (x.method === 'Page.javascriptDialogOpening') { ev.push(x.params.message); send('Page.handleJavaScriptDialog', {accept: true}); }
    if (x.method === 'Fetch.requestPaused') { const u = x.params.request.url, f = /firebase-(app|auth|firestore)\.js/.exec(u);
      if (f) send('Fetch.fulfillRequest', {requestId: x.params.requestId, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: 'application/javascript'}, {name: 'Access-Control-Allow-Origin', value: '*'}], body: Buffer.from({app: APP, auth: AUTH, firestore: FS}[f[1]]).toString('base64')});
      else if (/localhost|127\.0\.0\.1/.test(u)) send('Fetch.continueRequest', {requestId: x.params.requestId}); else send('Fetch.failRequest', {requestId: x.params.requestId, errorReason: 'BlockedByClient'}); } };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable'); await send('Network.setBypassServiceWorker', {bypass: true});
  await send('Fetch.enable', {patterns: [{urlPattern: '*'}]});
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__mock={docs:${JSON.stringify(D)},user:{uid:'u1',email:'t@esempio.it'},deny:['foto']};`});
  await send('Page.navigate', {url}); await w(3000);
  await ev$(`(()=>{const e=document.createElement('button'); e.dataset.act='edit-job'; e.dataset.id='j1'; document.body.appendChild(e); e.click();})()`); await w(700);
  await ev$(`(()=>{const f=document.querySelector('#jobForm'); f.querySelector('[name=data]').value='${day(-1)}'; f.requestSubmit();})()`); await w(1500);
  const fo = await ev$(`Object.keys(__mock.docs).filter(k=>k.startsWith('foto/')).map(k=>__mock.docs[k])`);
  ok('documento spostato al nuovo giorno anche con modifica vietata', fo.length === 1 && fo[0].giorno === day(-1) && fo[0].jobId === 'j1' && fo[0].data === 'QUJD' && fo[0].id !== 'f1', JSON.stringify(fo));
  ok('intervento spostato', await ev$(`__mock.docs['interventi/j1'].data`) === day(-1));
  ok('nessun errore JavaScript', errs.length === 0, JSON.stringify(errs));
  console.log(fails ? fails + ' test FALLITI' : 'Tutti i test superati'); CH.close(); ch.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
