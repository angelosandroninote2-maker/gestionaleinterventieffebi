// Test della sezione «Controllo e pulizia» con il finto Firebase, senza puppeteer:
// pilota Chrome direttamente (DevTools Protocol, Node 22+).
// Uso: python -m http.server 8080 (dalla radice del repo), poi
//      node tools/test/controllo.js http://localhost:8080/index.html   (CHROME=percorso di Chrome se serve)
const {spawn} = require('child_process'); const fs = require('fs'); const os = require('os'); const path = require('path');
const {APP, AUTH, FS} = require('./mock-firebase.js');
const w = ms => new Promise(r => setTimeout(r, ms)); let fails = 0;
const ok = (n, c, extra) => { console.log(c ? 'PASS' : 'FAIL', n, c ? '' : (extra || '')); if (!c) fails++; };
const pad = n => String(n).padStart(2, '0'); const day = k => { const d = new Date(Date.now() - k * 864e5); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const D = {'utenti/u1': {email: 't@esempio.it', ruolo: 'titolare'}, 'utenti/u2': {email: 'lav@esempio.it', ruolo: 'lavoratore', workerId: 'wX'}, 'utenti/u3': {email: 'nuovo@esempio.it', ruolo: ''},
  'lavoratori/w1': {id: 'w1', nome: 'Mario Rossi', attivo: true, telefono: '3331234567'}, 'lavoratori/w2': {id: 'w2', nome: 'Luca Bianchi', attivo: false}, 'lavoratori/w3': {id: 'w3', nome: 'Gino', attivo: true},
  'impostazioni/azienda': {id: 'azienda', ragione: 'Effebi'},
  'clienti/c1': {id: 'c1', tipo: 'privato', nome: 'Anna', cognome: 'Ricci', via: 'Via Roma 1'}, 'clienti/c2': {id: 'c2', tipo: 'privato', nome: 'Anna', cognome: 'Ricci', via: 'via roma 1'},
  'clienti/c3': {id: 'c3', tipo: 'azienda', ragione: 'Ditta A', piva: '01234567890'}, 'clienti/c4': {id: 'c4', tipo: 'azienda', ragione: 'Ditta A srl', piva: '01234567890'},
  'prefatture/p1': {id: 'p1', numero: '1/2026', righe: [{jobId: 'j7'}]},
  'articoli/a1': {id: 'a1', descrizione: 'Motore', codici: ['111'], giacenza: -2}, 'articoli/a2': {id: 'a2', descrizione: 'Centralina', codici: ['222', '111'], giacenza: 3}};
const J = (id, o) => { D['interventi/' + id] = Object.assign({id, cliente: 'Cliente ' + id, via: 'Via X', tipo: 'Riparazione', durata: 60, workerId: 'w1', stato: 'da_fare', data: day(0)}, o); };
J('j1', {data: day(10)});                                   // aperto vecchio
J('j2', {data: day(2), stato: 'in_corso'});                 // in corso giorni passati
J('j3', {workerId: 'wZ'});                                  // lavoratore inesistente (fix)
J('j4', {workerId: 'w2'});                                  // lavoratore disattivato
J('j5', {clienteId: 'cGone', stato: 'fatto', data: day(1), prefat: true}); // cliente cancellato (fix)
J('j6', {automazione: 'cancello', priorita: 'boh', stato: 'fatto', data: day(1)}); // valori (fix)
J('j7', {stato: 'fatto', data: day(40)}); D['fatturazione/j7'] = {id: 'j7', importo: 200, prefat: true, preFatturaId: 'pGone'}; // pre-fattura mancante (fix)
J('j8', {stato: 'fatto', data: day(50)});                   // mai mandato in pre-fatturazione
J('j9', {data: day(0), cliente: 'Doppio', via: 'Via D'}); J('j10', {data: day(0), cliente: 'Doppio', via: 'Via D'}); // doppioni
D['fatturazione/jGone'] = {id: 'jGone', importo: 50};       // fatturazione orfana (fix)
D['materiali/m1'] = {id: 'm1', jobId: 'jGone2', qta: 1, descrizione: 'Fotocellula', aperto: true, annullato: false, pend: false, preFatturaId: 'pGone', rev: 0, creato: new Date().toISOString()};
let CH = null, seq = 0; const pend = new Map(), ev = [];
const send = (method, params = {}) => new Promise(res => { const id = ++seq; pend.set(id, res); CH.send(JSON.stringify({id, method, params})); });
const ev$ = async (expr) => { const r = await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };
(async () => {
  const url = process.argv[2] || 'http://localhost:8080/index.html';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ctl-'));
  const ch = spawn(process.env.CHROME || 'google-chrome', ['--headless=new', '--no-sandbox', '--remote-debugging-port=9339', '--user-data-dir=' + dir, '--window-size=1366,900', 'about:blank'], {stdio: 'ignore'});
  let list = null; for (let i = 0; i < 50 && !list; i++) { await w(200); try { list = await (await fetch('http://127.0.0.1:9339/json/list')).json(); } catch(e){} }
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
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__mock={docs:${JSON.stringify(D)},user:{uid:'u1',email:'t@esempio.it'}};`});
  await send('Page.navigate', {url}); await w(3000);
  ok('voce Controllo nel menu del titolare', await ev$(`!!document.querySelector('#menu [data-view="controllo"]')`));
  await ev$(`document.querySelector('#menu [data-view="controllo"]').click()`); await w(1200);
  const fn = await ev$(`[...document.querySelectorAll('.ctl-chip')].map(e=>e.className+' '+e.textContent)`);
  ok('prova funzioni: tutte OK', fn.length >= 8 && fn.every(x => / ok /.test(x)), JSON.stringify(fn));
  ok('pannello dispositivo', /Copia locale/.test(await ev$(`document.getElementById('app').innerText`)));
  const r0 = await ev$(`__mock.reads`);
  await ev$(`document.querySelector('[data-act="ctl-run"]').click()`); await w(3500);
  ok('chiede conferma con la stima delle letture', ev.some(m => /leggerà circa \d+ documenti/.test(m)), JSON.stringify(ev));
  const txt = await ev$(`document.getElementById('app').innerText`);
  const has = t => txt.includes(t);
  ['rimasti aperti da più di 7 giorni', '«In corso» di giorni passati', 'lavoratore che non esiste più', 'lavoratori disattivati', 'cliente cancellato', 'Valori scritti in modo non standard',
   'pre-fattura che non esiste più', 'mai mandati in pre-fatturazione', 'Possibili interventi doppi', 'Importi di interventi già cancellati', 'Clienti doppi', 'Account lavoratore collegati',
   'Account in attesa', 'senza numero di telefono', 'giacenza negativa', 'Stesso codice a barre', 'Materiale aperto di interventi cancellati', 'Materiale legato a una pre-fattura'].forEach(t => ok('trovato: ' + t, has(t)));
  if (process.env.SHOT) { await send('Emulation.setDeviceMetricsOverride', {width: 1366, height: 2600, deviceScaleFactor: 1, mobile: false}); await w(400); fs.writeFileSync(process.env.SHOT, Buffer.from((await send('Page.captureScreenshot', {format: 'png'})).data, 'base64')); await send('Emulation.clearDeviceMetricsOverride'); }
  console.log('  letture del controllo:', (await ev$(`__mock.reads`)) - r0);
  ok('niente è cambiato senza conferma', await ev$(`__mock.docs['interventi/j3'].workerId === 'wZ'`));
  const fix = async idc => { ev.length = 0; await ev$(`document.querySelector('[data-act="ctl-fix"][data-id="${idc}"]').click()`); await w(1200); };
  await fix('lav-mancante'); ok('fix: da assegnare', await ev$(`__mock.docs['interventi/j3'].workerId === ''`));
  await fix('cli-mancante'); ok('fix: collegamento cliente tolto, nome rimasto', await ev$(`__mock.docs['interventi/j5'].clienteId === '' && __mock.docs['interventi/j5'].cliente === 'Cliente j5'`));
  await fix('valori'); ok('fix: valori standard', await ev$(`__mock.docs['interventi/j6'].automazione === 'CANCELLO' && __mock.docs['interventi/j6'].priorita === 'normale' && __mock.docs['interventi/j6'].stato === 'fatto'`));
  await fix('pf-mancante'); ok('fix: pre-fattura mancante', await ev$(`__mock.docs['fatturazione/j7'].preFatturaId === '' && __mock.docs['fatturazione/j7'].importo === 200`));
  await fix('fatt-orfani'); ok('fix: fatturazione orfana segnata eliminata', await ev$(`__mock.docs['fatturazione/jGone'].eliminato === true`));
  await fix('mat-pf'); ok('fix: materiale rimesso disponibile', await ev$(`__mock.docs['materiali/m1'].preFatturaId === '' && __mock.docs['materiali/m1'].rev === 1`));
  ok('altri dati intatti', await ev$(`__mock.docs['interventi/j1'].stato === 'da_fare' && __mock.docs['clienti/c2'].nome === 'Anna'`));
  await ev$(`document.querySelector('[data-act="ctl-job"][data-id="j1"]').click()`); await w(700);
  ok('Apri intervento dalla lista', await ev$(`!!document.querySelector('#overlay') && !document.querySelector('#overlay').hidden && document.querySelector('#overlay').innerText.includes('Cliente j1')`));
  await ev$(`document.getElementById('overlay').click()`); await w(300);
  await ev$(`document.querySelector('[data-act="ctl-cli"]').click()`); await w(900);
  ok('Apri cliente in Anagrafica', await ev$(`document.getElementById('app').innerText.includes('Anna Ricci')`));
  await ev$(`throw_me_test()`).catch(() => {}); await ev$(`setTimeout(()=>{nonEsiste()},0)`); await w(300);
  await ev$(`document.querySelector('#menu [data-view="controllo"]').click()`); await w(800);
  ok('errori registrati visibili', /errori registrati su questo dispositivo/.test(await ev$(`document.getElementById('app').innerText`)));
  ok('nessun errore JavaScript dell’app', errs.filter(e => !/nonEsiste|throw_me_test/.test(e)).length === 0, JSON.stringify(errs));
  console.log(fails ? fails + ' test FALLITI' : 'Tutti i test superati'); CH.close(); ch.kill(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
