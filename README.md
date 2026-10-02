# WiSiVERSE Members

Spazio riservato ai membri (members.wisiverse.com): server a sinistra (Drop, Registro, WiSiVERSE, WISI ARCADE, Circolo dei Ritrovatori), Studio per te. React + Vite, funzioni Vercel, Supabase, Resend.

Senza chiavi Supabase l'app parte in **modalità demo** con dati finti: puoi provarla subito.

```
npm install
npm run dev
```

## Come funziona, in breve

- **Acquisto su Printful → webhook → codice via email subito**, all'ordine. Il codice `WISI-XXXX-XXXX` vale una volta ed è legato all'email di chi ha comprato. Squarespace non serve per questo.
- **Entrare**: la prima volta ci si registra con codice + email + nickname + password (minimo 8 caratteri); senza codice valido non nasce nessun account. Le volte dopo: email e password. L'account Supabase è lo stesso dei giochi: chi ha già un account entra con la sua password di sempre (il codice gli crea solo il profilo membro, la password non viene mai toccata).
- **Spedizione**: gli aggiornamenti di Printful arrivano al webhook e partono le email di spedizione.
- **Ritrovamenti**: nella busta di ogni quadro c'è un codice "artwork" (lo generi dallo Studio). Chi lo inserisce carica una foto, tu approvi: diventa proprietario, Ritrovatore e si apre il Circolo.
- **Passaggi di mano**: il membro li richiede, tu approvi dallo Studio.
- **Gare e badge**: i punteggi dei giochi si leggono dallo stesso Supabase; alla chiusura della gara vincitore e badge sono automatici.

## Messa online, passo per passo

1. **Supabase** (progetto "wisinvaders"): SQL Editor → esegui in ordine `supabase/migrations/001_members.sql`, `002_seed.sql`, poi `003_first_admin.sql` dopo aver messo la tua email dentro (prima deve esistere il tuo utente, vedi punto 5). Le tabelle hanno prefisso `wm_` e non toccano quelle dei giochi.
2. **Resend**: crea la chiave API e verifica il dominio da cui mandare (`EMAIL_FROM`).
3. **GitHub + Vercel**: carica la cartella su un nuovo repo (il file `.gitignore` esclude già i segreti), importalo su Vercel, aggiungi il dominio `members.wisiverse.com`.
4. **Variabili d'ambiente su Vercel** (copia i nomi da `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SHOP_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL`, `SITE_URL`, `PRINTFUL_WEBHOOK_SECRET`, `CRON_SECRET`. Poi rifai il deploy.
   **La chiave `SUPABASE_SERVICE_ROLE_KEY` va solo qui, mai nel repo e mai in un file della cartella.**
5. **Il tuo account admin**: in Supabase → Authentication → Users → "Add user" con la tua email (se esiste già, per esempio dai giochi, salta questo passaggio). Poi esegui `003_first_admin.sql` (con la tua email). Per entrare: se l'account ha già una password usa quella; se non ne ha una, apri l'app → Accedi → **Password dimenticata**, apri il link che ricevi per email e scegli la password.
6. **Supabase Auth**:
   - Authentication → URL Configuration → Site URL `https://members.wisiverse.com`, e aggiungilo anche tra i Redirect URLs: è lì che torna il link di "Password dimenticata" (per le prove in locale aggiungi anche `http://localhost:5173`).
   - Authentication → Sign In / Providers → Email: il provider Email deve essere attivo, con lunghezza minima della password 8 (o meno). Non servono email di conferma: gli account li crea il server (`api/redeem.js`) già confermati, e solo con un codice valido.
   - L'unica email che Supabase manda è quella di recupero password (template "Reset Password"). Il servizio email incluso in Supabase ne manda poche all'ora: per l'uso reale imposta un SMTP tuo (Authentication → Emails → SMTP Settings, va bene anche Resend).
7. **Webhook Printful**: in Printful (Dashboard → Settings → API / Webhooks) oppure con `node scripts/printful-webhook.mjs` (serve `PRINTFUL_API_TOKEN`), registra:
   `https://members.wisiverse.com/api/printful-webhook?token=IL_TUO_PRINTFUL_WEBHOOK_SECRET`
   per gli eventi di ordine creato, spedizione e annullamento.

## Cose da fare nell'app (Studio)

- **Prodotti**: crea i pezzi in serie con le *parole chiave* che compaiono nel nome o nello SKU dell'articolo su Printful (es. `monna`). Gli articoli non riconosciuti compaiono in "Da approvare" e ti arriva un avviso.
- **Opere**: aggiungi i quadri con il modulo (anche la foto). Per ogni quadro genera i codici da stampare per le buste.
- **Acquisti**: se un ordine non passa da Printful puoi registrarlo o invitare qualcuno a mano.
- **Gare**: creale, e a gara finita chiudile (anche in automatico: vedi sotto).

## Logo, icona e immagini (cartella `public/`)

I file in `public/` vengono serviti così come sono. Quelli che l'app si aspetta:

```
public/logo-members.png        logo nella barra in alto, nell'accesso e negli errori (mostrato alto 32px)
public/logo-wisiverse.png      logo nel piè di pagina (mostrato alto 32px)
public/icon.png                icona: favicon, "Aggiungi a Home" su telefono (quadrata, 512×512)
public/manifest.webmanifest    nome e colori dell'app installata (WiSiVERSE Members)
public/games/wisinvaders.png   riquadri dei giochi (quadrati, es. 800×800)
public/games/wisikart.png
public/games/unbound.png
```

Se manca il logo compare il nome scritto; se manca l'immagine di un gioco compare un segnaposto.

## Cambiare le immagini

- **Quadri e prodotti**: dallo Studio, scegli un nuovo file e salva.
- **Giochi** (riquadri in "tutti-i-giochi"): copia i file in `public/games/` con questi nomi: `wisinvaders.png`, `wisikart.png`, `unbound.png` (meglio quadrati, 800×800). Titoli, descrizioni e link sono in `src/config/games.js`. Se un'immagine manca compare un segnaposto.

## Da controllare prima di usarlo davvero

1. **Punteggi dei giochi**: apri `api/_lib/scoreSources.js` e metti i nomi veri di tabella e colonne dove i giochi salvano punteggi e tempi (ora sono segnaposto). Finché non è fatto, chiudi le gare dallo Studio inserendo l'ordine a mano.
2. **Primo ordine di prova su Printful**: dopo l'ordine apri Supabase → tabella `wm_webhook_log` e guarda il contenuto: se Printful non manda l'email dell'acquirente o i nomi dei campi sono diversi, si corregge in `api/_lib/printful.js` (un solo file).
3. **Registrazione automatica del webhook** (`scripts/printful-webhook.mjs`): l'endpoint non è stato verificato. Se non funziona, registralo dal pannello Printful.
4. **Cron**: su Vercel Hobby il controllo gare parte una volta al giorno (`vercel.json`). Nel Piano Pro puoi farlo più spesso; in ogni caso puoi chiudere a mano dallo Studio.
5. **Profili degli altri membri**: ora il profilo è visibile solo a te (con l'opzione per nascondere o mostrare la collezione già pronta nelle impostazioni). Vedere il profilo altrui non è ancora collegato.

## Struttura

```
api/            funzioni Vercel (webhook Printful, riscatto codice, azioni membro e Studio, cron)
api/_lib/       codici, email, badge, gare, normalizzazione Printful
shared/         livelli e badge (usati da app e server)
src/            interfaccia (views/ = sezioni, lib/real.js = dati reali, lib/demo.js = demo)
supabase/       migrazioni SQL
public/games/   immagini dei giochi
```
