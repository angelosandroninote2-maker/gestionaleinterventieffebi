const puppeteer=require('puppeteer'); const {APP,AUTH,FS}=require('./mock-firebase.js');
const w=ms=>new Promise(r=>setTimeout(r,ms)); const ok=(n,c)=>console.log(c?'PASS':'FAIL',n);
const pad=n=>String(n).padStart(2,'0'); const day=k=>{const d=new Date(Date.now()-k*864e5);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const D={'utenti/u1':{email:'t@esempio.it',ruolo:'titolare'},'lavoratori/w1':{id:'w1',nome:'Mario Rossi',attivo:true,colore:0},'impostazioni/azienda':{id:'azienda',ragione:'Effebi'},
 'clienti/c1':{id:'c1',tipo:'privato',nome:'Anna',cognome:'Ricci',via:'Via Roma 1'},
 'interventi/j1':{id:'j1',data:day(1),cliente:'Anna Ricci',clienteId:'c1',via:'Via Roma 1',durata:60,tipo:'Riparazione',automazione:'TAPPARELLA',workerId:'w1',stato:'fatto',noteLavoratore:'Smontato motore, manca il pezzo',causale:'ORE=2;PERS=1'},
 'fatturazione/j1':{id:'j1',importo:200}};
(async()=>{const b=await puppeteer.launch({headless:'new',args:['--no-sandbox'],executablePath:process.env.CHROME||undefined});
 const ctx=await b.createBrowserContext(); const errs=[];
 const p=await ctx.newPage(); await p.setViewport({width:1366,height:900}); p.on('pageerror',e=>errs.push(e.message));
 await p.evaluateOnNewDocument(D=>{window.__mock={docs:D,user:{uid:'u1',email:'t@esempio.it'}}; window.__blobs=[]; const o=URL.createObjectURL; URL.createObjectURL=b=>{window.__blobs.push(b);return o.call(URL,b);};},D);
 await p.setBypassServiceWorker(true); await p.setRequestInterception(true);
 p.on('request',r=>{const u=r.url();const m=/firebase-(app|auth|firestore)\.js/.exec(u); if(m) r.respond({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:{app:APP,auth:AUTH,firestore:FS}[m[1]]}); else if(/localhost/.test(u)) r.continue(); else r.abort();});
 await p.goto((process.argv[2]||'http://localhost:8080/index.html')); await w(2500);
 await p.evaluate(()=>{const b=document.querySelector('#menu [data-view="carica"]'); b&&b.click();}); await w(800);
 const imp=await p.evaluate(()=>[...document.querySelectorAll('select[name=automazione] option')].map(o=>o.text));
 ok('TAPPARELLA e PORTA RAPIDA nel menu', imp.includes('TAPPARELLA')&&imp.includes('PORTA RAPIDA'));
 await p.evaluate(()=>{const e=document.createElement('button'); e.dataset.act='open-job'; e.dataset.id='j1'; document.body.appendChild(e); e.click();}); await w(600);
 await p.evaluate(()=>{const e=[...document.querySelectorAll('[data-act="job-pdf"],[data-act="pdf-job"]')][0]; e&&e.click();}); await w(1500);
 const pdf=await p.evaluate(async()=>{const bl=__blobs.filter(x=>/pdf/.test(x.type)); return bl.length? await bl[bl.length-1].text():'';});
 ok('PDF senza manodopera/materiale', pdf && !/MANODOPERA|TOTALE \(IVA/.test(pdf) && /RAPPORTO DI INTERVENTO/.test(pdf));
 await p.evaluate(()=>{const e=document.querySelector('#overlay [data-act="dup-job"]'); e.click();}); await w(800);
 const np=await p.evaluate(()=>{const t=document.querySelector('textarea[name=notePrec]'); return t&&t.value;});
 console.log('   note portate:', np); ok('note del giorno prima nel modulo', /Smontato motore/.test(np||'') && /Mario Rossi/.test(np));
 await p.evaluate(()=>{const f=document.querySelector('#jobForm'); f.requestSubmit();}); await w(800);
 const nj=await p.evaluate(()=>Object.values(__mock.docs).find(d=>d.cliente==='Anna Ricci'&&d.id!=='j1'&&d.data));
 ok('nuovo intervento salvato con notePrec', nj && /Smontato/.test(nj.notePrec||''));
 await p.evaluate(id=>{const e=document.createElement('button'); e.dataset.act='open-job'; e.dataset.id=id; document.body.appendChild(e); e.click();},nj.id); await w(600);
 await p.evaluate(()=>{const e=[...document.querySelectorAll('[data-act="job-pdf"],[data-act="pdf-job"]')][0]; e&&e.click();}); await w(1500);
 const pdf2=await p.evaluate(async()=>{const bl=__blobs.filter(x=>/pdf/.test(x.type)); return bl.length? await bl[bl.length-1].text():'';});
 ok('PDF del giorno dopo con le note precedenti', /Note dei giorni precedenti/.test(pdf2) || /giorni precedenti/.test(pdf2));
 await p.screenshot({path:'/home/claude/t/np.png'});
 console.log('errori',errs); await b.close();})();
