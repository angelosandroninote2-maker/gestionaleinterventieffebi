const puppeteer=require('puppeteer'); const {APP,AUTH,FS}=require('./mock-firebase.js');
const w=ms=>new Promise(r=>setTimeout(r,ms));
const pad=n=>String(n).padStart(2,'0'); const day=k=>{const d=new Date(Date.now()-k*864e5);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const D={'utenti/u1':{email:'t@esempio.it',ruolo:'titolare'},'lavoratori/w1':{id:'w1',nome:'Mario Rossi',attivo:true,colore:0},
 'interventi/j1':{id:'j1',data:day(1),cliente:'Anna Ricci',via:'Via Roma 1',durata:60,tipo:'Riparazione',workerId:'w1',stato:'non_fatto',causale:'Cliente assente',noteLavoratore:'Suonato due volte'}};
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox'],executablePath:process.env.CHROME||undefined});
 const p=await (await b.createBrowserContext()).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
 await p.evaluateOnNewDocument(D=>{window.__mock={docs:D,user:{uid:'u1',email:'t@esempio.it'}};},D);
 await p.setBypassServiceWorker(true); await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();const m=/firebase-(app|auth|firestore)\.js/.exec(u); if(m) r.respond({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:{app:APP,auth:AUTH,firestore:FS}[m[1]]}); else if(/localhost/.test(u)) r.continue(); else r.abort();});
 await p.goto((process.argv[2]||'http://localhost:8080/index.html')); await w(2500);
 await p.evaluate(()=>{const e=document.createElement('button'); e.dataset.act='edit-job'; e.dataset.id='j1'; document.body.appendChild(e); e.click();}); await w(700);
 await p.evaluate(d=>{const i=document.querySelector('#jobForm [name=data]'); i.value=d; document.querySelector('#jobForm').requestSubmit();},day(-1)); await w(800);
 console.log(JSON.stringify(await p.evaluate(()=>__mock.docs['interventi/j1']))); console.log('errori',errs); await b.close();})();
