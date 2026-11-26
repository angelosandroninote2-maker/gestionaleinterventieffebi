# Effebi Gestionale — note per Claude Code

Rispondi sempre in italiano, in modo semplice (l'utente non è programmatore). Prima di modifiche grafiche importanti proponi un'anteprima.

## Struttura
- App a file unico: `index.html` (HTML + CSS + JS, nessuna libreria, nessun build). PWA con `manifest.webmanifest` e `sw.js` (network-first).
- Online su GitHub Pages: https://angelosandroninote2-maker.github.io/gestionaleinterventieffebi/
- Database: Firebase (progetto `gestionale-48987`, Firestore eur3), SDK modulare v12.7.0 caricato con `import()` dentro `bootFirebase()` → oggetto globale `fb`.
- Le regole di Firestore NON sono nel repo: le incolla l'utente nella console Firebase. Se una modifica richiede regole nuove, preparale e spiegagli dove incollarle.

## Regola fissa a ogni modifica
1. Modifica `index.html`.
2. Alza di uno `const VERSION = 'vN'` in `sw.js` (altrimenti i telefoni non si aggiornano).
3. Commit con messaggio in italiano e push su `main`.

## Ruoli (campo `utenti/{uid}.ruolo`)
- `titolare`: tutto (unico che riapre interventi chiusi).
- `ufficio`: carica, assegna, anagrafica, pre-fatturazione, magazzino.
- `lavoratore` (con `workerId`): vede solo i propri interventi; può cambiare solo stato, noteLavoratore, causale, inizioIl, esitoIl, esitoDa, firma* (vedi `W_KEYS`). Aggiungere campi scritti dal lavoratore richiede di cambiare le regole.

## Dati principali
- `interventi`: data (YYYY-MM-DD o vuota = "Da programmare"), fascia, cliente/clienteId, via, tipo, durata, stato (da_fare/in_corso/fatto/non_fatto), priorita (= urgenza: normale/urgente/urgentissimo, mostrate come Normale/Urgente/Molto urgente, vedi `PRIO`; mancante = normale), automazione e automazione2 (tipo impianto e "Tipo di impianto 2" facoltativo, MAIUSCOLO, lista `AUTOMAZIONI`, normalizzati con `autoNorm`, vedi `impiantiOf`), noteLavoratore, causale (per i "fatto" contiene `ORE=x;PERS=y`), notePrec (note dei giorni precedenti, vedi `notePrecDi`). `rip:true` = motori/centraline, `mul:true` = muletti.
- `fatturazione/{idIntervento}`: importo, prefat, preFatturaId, noteFatt (separati dagli interventi per i permessi).
- `clienti`, `prefatture`, `articoli`, `listino`, `materiali`, `movimenti`, `foto`, `firme`, `tipi`, `impostazioni` (doc `azienda`, `clientiEliminati`), `notifLette`, `lavoratori`, `utenti`, `catalogo`.

## Letture Firebase (piano Spark: 50.000 letture/giorno) — ATTENZIONE
- Clienti e fatturazione sono in copia locale IndexedDB (`cachedLoad`, `fattLoad`, `ensureClientiLoaded`): si scaricano solo i documenti con `agg` (serverTimestamp) più recente; riscarico completo ogni 7 giorni. Ogni scrittura su `clienti` e `fatturazione` deve impostare `agg`; le eliminazioni dei clienti vanno in `impostazioni/clientiEliminati`, quelle di fatturazione come `{eliminato:true}`.
- Ufficio: interventi ultimi 180 giorni + aperti + mul + rip (`startSubs`); sezioni pesanti caricate solo all'apertura (`activateLazySection`, `sectionSub`, `ensureMagData`).
- Non aggiungere listener su intere collezioni grandi né `getDocs` completi senza motivo.

## Flussi utili
- Chiusura lavoratore: `openClose` / `confirmClose` (ore e persone obbligatorie a pulsanti, nota con frasi rapide, firma facoltativa). "Non fatto": `wStatoHtml` con motivi rapidi `NF_QUICK`.
- Lavoro non finito: «Continua un altro giorno» (`dup-job`) e lo spostamento di data in `saveJob` portano le note in `notePrec`.
- PDF rapporto di intervento: `buildJobPdf` (senza manodopera/materiale). Pre-fattura: funzione dedicata più sopra.
- Il menu `#menu` è la fonte; barra laterale e barra in basso sono copie (`shellSync`).

## Test
Non c'è una suite nel repo. Per verificare: aprire `index.html` con un server locale e controllare la console; per prove serie usare puppeteer con un finto SDK Firebase che intercetta le richieste a `firebasejs/12.7.0/*`.

## Altri documenti
- `docs/STORIA_E_DECISIONI.md`: cosa è stato fatto, decisioni prese, proposte in sospeso. Leggilo prima di lavori importanti.
- `docs/firestore.rules`: copia di riferimento delle regole (la versione vera è nella console Firebase).
- `tools/test/`: finto Firebase e test con puppeteer.
- Non inventare: se un dato (prezzi, regole pubblicate, scelte dell'utente) non è nei file, chiedi.
