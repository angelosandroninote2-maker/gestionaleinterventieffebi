# Effebi Gestionale — storia, decisioni e stato (aggiornato al 26/11/2026)

Questo file sostituisce la vecchia conversazione con Claude. Contiene solo fatti verificati: se qualcosa non è scritto qui o nel codice, chiedi all'utente invece di supporre.

## Chi e come
- Utente: titolare/gestore di Effebi (automazioni: cancelli, sbarre, serrande, portoni, porte automatiche, tapparelle, allarmi, TVCC). Parla italiano, non è programmatore.
- Preferisce: spiegazioni semplici, anteprime (immagini) prima di cambi grafici, conferma con "procedi". Vuole risparmiare token: modifiche mirate, niente riscritture complete.
- Pubblicazione: GitHub Pages dal ramo `main` di `angelosandroninote2-maker/gestionaleinterventieffebi`. Dopo ogni modifica: alzare `VERSION` in `sw.js` (al 26/11 era `v20`).
- Firebase: piano gratuito Spark (50.000 letture/giorno, 20.000 scritture/giorno). Consigliato in passato: passare a Blaze con avviso di budget 5 € (lo deve fare l'utente con la carta; non risulta fatto).

## Regole Firestore
- Copia di riferimento: `docs/firestore.rules` (ricostruita: è quella pubblicata a novembre 2026 + blocco `notifLette`). La versione vera è quella nella console Firebase: in caso di dubbio chiedi all'utente di incollarla.
- Le modifiche alle regole le incolla l'utente in console (Firestore → Regole → Pubblica). Dagli sempre il blocco completo senza commenti con lettere accentate fuori da `//`.

## Funzioni realizzate (in ordine)
1. Grafica: menu laterale su computer, barra in basso su telefono (`shellSync` copia `#menu`), icone nuove (Motori = cruscotto/motore, Muletti = muletto), pulsante Esci giallo con testo nero grassetto.
2. Colori degli stati: da fare (viola/grigio `--todo`), in corso (`--run`), fatto (verde), non fatto (rosso).
3. Centro notifiche con letto/non letto, salvato in `notifLette/{uid}` (e in localStorage).
4. Anagrafica rifatta (privati, aziende, condomini con impianti e manutenzioni; avviso manutenzioni in Panoramica).
5. Da programmare (interventi senza data), stampa "intervento da fare", assegnazione rapida, filtri del Finder.
6. Chiusura lavoratore (23/11): la nota si scrive SOLO dopo "Fatto"; ore e persone obbligatorie a pulsanti (ore proposte da "In corso", persone ricordate in localStorage `gestionale-pers-<uid>`), frasi rapide per la nota, firma facoltativa con un solo pulsante "Chiudi intervento". "Non fatto" con motivi rapidi.
7. Tipi di impianto in MAIUSCOLO (lista `AUTOMAZIONI`): CANCELLO, CANCELLO SCORREVOLE, SCORREVOLI CONTRAPPOSTI, CANCELLO AD ANTE BATTENTE, CANCELLO AD ANTE INTERRATO, SBARRA, SBARRE CONTRAPPOSTE, PORTA AUTOMATICA, PORTA RAPIDA, PORTONE SEZIONALE, SERRANDA, SERRANDA AVVOLGIBILE, SERRANDA BASCULANTE, TAPPARELLA, ALLARME, TV.CC. (+ PORTONE O SERRANDA solo per vecchi interventi). Valori vecchi in minuscolo vengono normalizzati in lettura.
8. Priorità: Normale, Urgente, Urgentissimo – chiamato più volte (etichetta rossa piena; visibile anche al lavoratore; ordinamento in Assegna; scrittura veloce riconosce "urgentissimo"/"chiamato più volte").
9. Grafica 24/11 (fatta dall'utente con altro strumento): palette blu notte (#172337) + rosso (#C8102E); corrette colonna Stato tagliata in Panoramica e Esci fuori schermo.
10. Letture ridotte (25/11): copia locale IndexedDB di clienti e fatturazione con campo `agg`; prima: ~10.000 letture per apertura + Carica lavori (simulazione 5.000 clienti / 3.000 interventi), dopo: ~1.500.
11. 26/11: aggiunti TAPPARELLA e PORTA RAPIDA; rapporto PDF senza manodopera/materiale; note dei giorni precedenti (`notePrec`) con «Continua un altro giorno» e con lo spostamento di data di un intervento non finito.
12. 26/11 (v20): "Tipo di impianto 2" facoltativo (campo `automazione2`, stesse voci, vuoto = "Nessuno" e non mostrato) in Carica/modifica, scheda, lavoratore, WhatsApp ("Impianto: A + B"), stampa, PDF rapporto, pre-fatturazione, ricerca e filtro impianto del Finder. Urgenza = campo `priorita` esistente (valori salvati invariati, nessuna conversione): "Urgentissimo – chiamato più volte" rinominato "Molto urgente"; etichette Urgente arancione, Molto urgente rosso pieno, Normale grigia solo in scheda (nelle liste solo le urgenti); Assegna, messaggio WhatsApp e lista del lavoratore: nella stessa fascia prima i più urgenti (la firma `waSig` resta indipendente dall'ordine); campo "Priorità" rinominato "Urgenza" in tutto ciò che si vede (nel database resta `priorita`); Finder: filtro Urgenza (solo dati già caricati); PDF rapporto: riga Urgenza solo se urgente.

13. 28/11 (v21): sezione **Controllo** (solo titolare, menu Gestione) da lanciare a mano. Tre parti: (a) prova funzioni senza letture (costruisce schermate, PDF rapporto, link WhatsApp); (b) dispositivo: versione, copia locale IndexedDB con «Riscarica da zero», registro errori locale (`logErr`, chiave `effebi-errori`, ultimi 40: errori JS, salvataggi falliti in `enqueue`, errori di lettura in `fbSnapErr`); (c) controllo dati: prima conta i documenti (`getCountFromServer`) e chiede conferma con la stima delle letture, poi legge tutto e mostra i problemi in tre livelli (da sistemare / da guardare / pulizia). Correzioni solo a richiesta e solo dove sicure: lavoratore inesistente → da assegnare; clienteId rotto → tolto (nome resta); stato/urgenza/impianto non standard; preFatturaId di pre-fattura inesistente (fatturazione e materiali, come `pfDelete`); fatturazione orfana → `eliminato:true`; foto/firme orfane (facoltativo, lette via REST con solo pochi campi, senza immagini) → eliminate. Il resto è solo elenco con «Apri». Test: `tools/test/controllo.js` (pilota Chrome senza puppeteer).

## Cose note ma NON fatte (proposte in sospeso)
- Ridurre ancora le letture degli interventi degli ultimi 180 giorni (~1.500 per apertura): servirebbe `agg` anche sugli interventi, quindi cambiare le regole (il lavoratore può scrivere solo `W_KEYS`).
- Spostare l'hosting su Firebase Hosting (gratis, dominio `gestionale-48987.web.app`): non deciso.
- Pulsante "Backup completo" periodico.
- Icone nere `icon-512.png` / `icon-192.png` per la schermata d'avvio Android: preparate ma su GitHub risultavano ancora quelle bianche (verificare).
- Sul telefono il dettaglio intervento a caselle è lungo: offerto di tornare compatto solo su telefono, nessuna risposta.
- Questione IVA del listino "Prezzo al Pubblico" e dati azienda per i PDF: da confermare con l'utente/commercialista.

## Altri materiali consegnati in passato (non nel repo)
- PDF presentazione del gestionale e guida per i lavoratori (vecchi colori degli stati in parte): erano file scaricati dall'utente, non sono qui.
- File sorgente rubrica clienti `AnagrafeRubrica.xls` (~34.000 righe) e listini Excel luglio 2026 (prodotti e ricambi): li ha l'utente.

## Test
- `tools/test/mock-firebase.js`: finto SDK Firebase (app, auth, firestore) con contatore letture `__mock.reads`. Si serve intercettando con puppeteer le richieste che contengono `firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`.
- Esempi: `letture.js` (conta letture apertura/riapertura), `note-precedenti.js`, `sposta-data.js`.
- Uso: `npm i puppeteer`, poi in una cartella `python -m http.server 8080` dalla radice del repo e `node tools/test/letture.js http://localhost:8080/index.html`. Impostare la variabile CHROME se serve un Chrome specifico. Nei test disattivare il service worker (`setBypassServiceWorker(true)`).
