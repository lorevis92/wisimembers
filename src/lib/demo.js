// Modalita demo: stessi metodi della versione reale, ma con dati finti in memoria.
// Si attiva da sola quando mancano VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.

const ago = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const inH = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
let seq = 100;
const nid = () => `d${seq++}`;

const ME = { id: 'u-elia', nickname: 'Elia', is_admin: true, is_finder: true, show_collection: true, public_name: true, member_no: 31 };
const PEOPLE = [
  { id: 'u-lorenzo', nickname: 'Lorenzo', is_admin: true, is_finder: true },
  { id: 'u-giulia', nickname: 'Giulia', is_admin: false, is_finder: true },
  { id: 'u-marco', nickname: 'Marco', is_admin: false, is_finder: true },
  { id: 'u-elia', nickname: 'Elia', is_admin: true, is_finder: true },
  { id: 'u-sara', nickname: 'Sara', is_admin: false, is_finder: false },
  { id: 'u-tom', nickname: 'Tom', is_admin: false, is_finder: false },
  { id: 'u-yuri', nickname: 'Yuri', is_admin: false, is_finder: false },
];
const byNick = (n) => PEOPLE.find((p) => p.nickname.toLowerCase() === String(n).toLowerCase());
const author = (id) => PEOPLE.find((p) => p.id === id) || PEOPLE[0];

const ch = (id, server_id, category, name, type, ro, topic, game = null) => ({ id, server_id, category, name, type, ro, topic, game });
const SERVERS = [
  { id: 'drop', name: 'Drop', glyph: 'D', title: 'Drop', access: 'member', chans: [
    ch('prossimi', 'drop', 'Annunci', 'prossimi-drop', 'feed', true, 'Dove e quando parte il prossimo Whiskey.'),
    ch('indizi', 'drop', 'Annunci', 'indizi', 'feed', true, 'Un indizio alla volta. Il resto è da scoprire.'),
    ch('trovato', 'drop', 'Ritrovamenti', 'ho-trovato-un-whiskey', 'found', false, 'Hai raccolto un quadro? Inizia da qui.') ] },
  { id: 'reg', name: 'Registro', glyph: 'R', title: 'Registro', access: 'member', chans: [
    ch('opere', 'reg', 'Le opere', 'opere-originali', 'registry', false, 'Ogni quadro ha la sua storia: dove è stato lasciato, chi lo ha trovato, dove vive oggi.'),
    ch('serie', 'reg', 'Le opere', 'pezzi-in-serie', 'series', false, 'T-shirt, stampe e altri pezzi: quante persone li possiedono.'),
    ch('passaggi', 'reg', 'Passaggi', 'passaggi-approvati', 'feed', true, 'Ogni passaggio di mano approvato.'),
    ch('cerca', 'reg', 'Passaggi', 'cerca-casa', 'feed', false, "Chi vuole passare un'opera e chi la cerca.") ] },
  { id: 'wisi', name: 'WiSiVERSE', glyph: 'W', title: 'WiSiVERSE', access: 'member', chans: [
    ch('benvenuto', 'wisi', 'Benvenuto', 'benvenuto', 'feed', true, 'Cosa puoi fare qui dentro.'),
    ch('presentazioni', 'wisi', 'Benvenuto', 'presentazioni', 'feed', false, 'Chi sei, dove sei, quale pezzo hai.'),
    ch('chiacchiere', 'wisi', 'Comunità', 'chiacchiere', 'feed', false, 'Tutto quello che non ha un canale.'),
    ch('pezzi', 'wisi', 'Comunità', 'i-miei-pezzi', 'feed', false, 'Foto dei pezzi WiSiVERSE nelle vostre case.'),
    ch('novita', 'wisi', 'Annunci', 'novità-dallo-studio', 'feed', true, 'Solo Lorenzo scrive qui.') ] },
  { id: 'arcade', name: 'WISI ARCADE', glyph: 'A', title: 'WISI ARCADE', access: 'member', chans: [
    ch('giochi', 'arcade', 'Sala giochi', 'tutti-i-giochi', 'games', false, 'Tutti i giochi del WiSiVERSE, un posto solo.'),
    ch('gare-inv', 'arcade', 'WISINVADERS', 'gare-aperte', 'events', false, 'Iscrizioni e regolamento.', 'wisinvaders'),
    ch('classifica-inv', 'arcade', 'WISINVADERS', 'classifica', 'board', false, 'Punteggi aggiornati.', 'wisinvaders'),
    ch('strategie', 'arcade', 'WISINVADERS', 'strategie', 'feed', false, 'Consigli, trucchi, scuse per il punteggio.'),
    ch('gare-kart', 'arcade', 'WisiKart', 'gare-aperte', 'events', false, 'Tornei e sfide a tempo.', 'wisikart'),
    ch('tempi', 'arcade', 'WisiKart', 'tempi-sul-giro', 'board', false, 'I migliori tempi.', 'wisikart'),
    ch('kart-chat', 'arcade', 'WisiKart', 'in-pista', 'feed', false, 'Scorciatoie, setup e sorpassi finiti male.'),
    ch('storia', 'arcade', 'WiSiVERSE Unbound', 'diario-di-sviluppo', 'feed', true, 'Come nasce la Story: aggiornamenti da Lorenzo.'),
    ch('feedback', 'arcade', 'WiSiVERSE Unbound', 'feedback', 'feed', false, 'Cosa funziona e cosa no, prima che esca.') ] },
  { id: 'cerchio', name: 'Circolo dei Ritrovatori', glyph: 'C', title: 'Circolo dei Ritrovatori', access: 'finder', chans: [
    ch('studio-feed', 'cerchio', 'Il Circolo', 'dal-mio-studio', 'feed', true, 'Anticipazioni e bozze, prima di tutti.'),
    ch('case', 'cerchio', 'Il Circolo', 'nelle-nuove-case', 'feed', false, 'Dove sono finiti i quadri.'),
    ch('incontri', 'cerchio', 'Il Circolo', 'incontri', 'events', false, 'Videochiamate e serate.', 'circolo') ] },
];

const m = (channel, user, h, body, reactions = []) => ({
  id: nid(), channel_id: channel, user_id: user, created_at: ago(h), body,
  reactions: reactions.flatMap(([emoji, n]) => Array.from({ length: n }, (_, i) => ({ emoji, user_id: `x${emoji}${i}` }))),
});
let MESSAGES = [
  m('prossimi', 'u-lorenzo', 3, 'Tre Whiskey partono per Milano sabato 4 ottobre, quartiere Isola, primo pomeriggio.', [['👀', 41], ['🔥', 23]]),
  m('prossimi', 'u-lorenzo', 2.9, 'Non sono tutti uguali: uno è un Bacco, uno è una Monna, il terzo lo scoprite quando lo trovate.', [['🎨', 17]]),
  m('prossimi', 'u-lorenzo', 26, 'Zurigo chiuso: il Viandante è stato raccolto in Langstrasse. Grazie a chi ha cercato.', [['❤️', 38]]),
  m('indizi', 'u-lorenzo', 1, 'Indizio 1 di 3 (Milano): cercate dove i binari passano sopra le teste.', [['🧩', 29]]),
  m('passaggi', 'u-lorenzo', 30, "Registro aggiornato: l'Orecchino di perla resta a Elia, primo ritrovatore del Registro.", [['📜', 6]]),
  m('cerca', 'u-yuri', 20, 'Cerco casa per un posto vuoto sullo scaffale: se qualcuno vuole passare una Monna, scrivetemi.', [['🙋', 3]]),
  m('benvenuto', 'u-lorenzo', 700, "Benvenuto nel WiSiVERSE. Hai un pezzo, quindi sei dentro. Presentati in presentazioni, poi dai un'occhiata a WISI ARCADE: la Coppa d'autunno è aperta.", [['👋', 64]]),
  m('presentazioni', 'u-giulia', 24, "Ciao! Sono di Zurigo, ho trovato il Viandante in Langstrasse. Non ho dormito per l'emozione.", [['👋', 12], ['🎉', 9]]),
  m('presentazioni', 'u-marco', 70, 'Lugano. Il mio Bacco è già sopra il camino.', [['🍷', 8]]),
  m('presentazioni', 'u-sara', 71, 'Ho la t-shirt Monna. Sono qui per WISINVADERS, preparatevi.', [['⚔️', 6]]),
  m('chiacchiere', 'u-marco', 28, 'Qualcuno di voi viene al drop di Milano? Ci si trova prima?', [['🙋', 5]]),
  m('chiacchiere', 'u-tom', 27.5, 'Io ci sono, arrivo da Varese. Io dico il bar di fronte alla stazione.'),
  m('chiacchiere', 'u-giulia', 5, 'Guardate che luce ha il Viandante sul mio scaffale.', [['😍', 14]]),
  m('pezzi', 'u-sara', 48, 'La t-shirt Monna, dopo il primo lavaggio. Tiene.', [['👕', 7]]),
  m('novita', 'u-lorenzo', 48, 'Sto dipingendo il Whiskey col panciotto verde. Lo vedrete prima nel Circolo, poi nel mondo.', [['🟢', 19]]),
  m('strategie', 'u-yuri', 4, 'Ondata 7, tenete la sinistra e sparate solo quando scendono.', [['💡', 4]]),
  m('strategie', 'u-sara', 3.8, 'Il power-up orologio vale più di quanto sembri.'),
  m('kart-chat', 'u-tom', 4, 'Lago di Retah, terza curva: tagliando a destra si guadagnano due decimi.', [['🏁', 6]]),
  m('storia', 'u-lorenzo', 6, 'Il Niaboc ora si esplora a piedi, con il Whiskey base come punto di partenza. Le altre forme arrivano più avanti.', [['🎮', 22]]),
  m('feedback', 'u-marco', 26, 'Mi piacerebbe poter mutare la musica dal menu in qualsiasi momento.', [['👍', 9]]),
  m('studio-feed', 'u-lorenzo', 8, 'Foto del tavolo da lavoro: tre bozze del panciotto verde. Quale vi sembra più Whiskey?', [['1️⃣', 3], ['2️⃣', 8], ['3️⃣', 5]]),
  m('case', 'u-giulia', 6, 'Il Viandante guarda il lago dalla cucina, ora.', [['❤️', 9]]),
];

let PIECES = [
  { id: 'p1', title: 'Whiskey viandante', city: 'Zurigo', description: 'Il primo Whiskey lasciato in Svizzera tedesca.', image_url: null, status: 'found', left_at: ago(30), lost_note: null, owner_label: 'Un membro', is_mine: false, created_at: ago(40) },
  { id: 'p2', title: 'La Monna Whiskey', city: 'Berna', description: 'Sorride, ma non dice perché.', image_url: null, status: 'left', left_at: ago(24 * 14), lost_note: null, owner_label: null, is_mine: false, created_at: ago(24 * 14) },
  { id: 'p3', title: 'Il Bacco', city: 'Lugano', description: 'Con il calice sempre pieno.', image_url: null, status: 'found', left_at: ago(24 * 48), lost_note: null, owner_label: 'Marco', is_mine: false, created_at: ago(24 * 48) },
  { id: 'p4', title: 'Col panciotto', city: 'Briga', description: null, image_url: null, status: 'left', left_at: ago(24 * 31), lost_note: null, owner_label: null, is_mine: false, created_at: ago(24 * 31) },
  { id: 'p5', title: 'Orecchino di perla', city: 'Milano', description: 'Ai Navigli, accanto all’acqua.', image_url: null, status: 'found', left_at: ago(24 * 72), lost_note: null, owner_label: 'Elia', is_mine: true, created_at: ago(24 * 73) },
  { id: 'p6', title: 'Whiskey che divora', city: 'Milano', description: null, image_url: null, status: 'upcoming', left_at: inH(70), lost_note: null, owner_label: null, is_mine: false, created_at: ago(2) },
];
let TIMELINE = {
  p1: [{ id: 't1', kind: 'left', text: 'Lasciato in Langstrasse, Zurigo.', happened_at: ago(30) }, { id: 't2', kind: 'found', text: 'Raccolto dopo 11 ore.', happened_at: ago(19), to_label: 'Un membro' }],
  p2: [{ id: 't3', kind: 'left', text: 'Lasciato vicino alla Zytglogge, Berna.', happened_at: ago(24 * 14) }],
  p3: [{ id: 't4', kind: 'left', text: 'Lasciato sul lungolago di Lugano.', happened_at: ago(24 * 48) }, { id: 't5', kind: 'found', text: 'Raccolto la mattina dopo.', happened_at: ago(24 * 47), to_label: 'Marco' }],
  p4: [{ id: 't6', kind: 'left', text: 'Lasciato davanti alla stazione di Briga.', happened_at: ago(24 * 31) }],
  p5: [{ id: 't7', kind: 'left', text: 'Lasciato ai Navigli, Milano.', happened_at: ago(24 * 72) }, { id: 't8', kind: 'found', text: 'Primo ritrovatore del Registro.', happened_at: ago(24 * 71), to_label: 'Elia' }],
  p6: [{ id: 't9', kind: 'upcoming', text: 'Parte da Milano, quartiere Isola.', happened_at: inH(70) }],
};
let PRODUCTS = [
  { id: 'pr1', title: 'T-shirt Monna', description: 'Cotone organico, stampa su richiesta.', image_url: null, match_keys: ['monna'], active: true, owners: 212, mine: [37], created_at: ago(500) },
  { id: 'pr2', title: 'T-shirt Bacco', description: null, image_url: null, match_keys: ['bacco'], active: true, owners: 148, mine: [], created_at: ago(400) },
  { id: 'pr3', title: 'Stampa Viandante', description: null, image_url: null, match_keys: ['viandante'], active: true, owners: 96, mine: [], created_at: ago(300) },
];
let EVENTS = [
  { id: 'e1', game: 'wisinvaders', title: "Coppa d'autunno", description: 'Miglior punteggio in tre partite. Il vincitore riceve un Whiskey firmato.', prize: 'Whiskey firmato', is_cup: true, starts_at: ago(48), ends_at: inH(120), closed_at: null, entries: 14, joined: false },
  { id: 'e2', game: 'wisinvaders', title: 'Sfida lampo · Ondata 10', description: "Chi arriva più in alto in una sola vita. Un'ora, stasera.", prize: null, is_cup: false, starts_at: inH(20), ends_at: inH(21), closed_at: null, entries: 6, joined: false },
  { id: 'e3', game: 'wisikart', title: 'Time attack · Lago di Retah', description: 'Il giro più veloce vince.', prize: null, is_cup: false, starts_at: ago(24), ends_at: inH(48), closed_at: null, entries: 9, joined: true },
  { id: 'e4', game: 'circolo', title: 'Videochiamata con Lorenzo', description: 'Dal tavolo di lavoro: si guarda il panciotto verde e si decide dove lasciarlo.', prize: null, is_cup: false, starts_at: inH(24 * 11), ends_at: inH(24 * 11 + 2), closed_at: null, entries: 30, joined: false },
];
const BOARDS = {
  wisinvaders: { event: { id: 'e1', title: "Coppa d'autunno", closed: false }, rows: [['Sara', 48250], ['Yuri', 44900], ['Tom', 39120], ['Marco', 31600], ['Giulia', 27340]] },
  wisikart: { event: { id: 'e3', title: 'Time attack · Lago di Retah', closed: false }, rows: [['Tom', 72400], ['Sara', 72950], ['Elia', 74080], ['Marco', 75620]] },
};
let TRANSFERS = [{ id: 'tr1', piece_id: 'p3', pieceTitle: 'Il Bacco', from: 'Marco', to: 'Tom', note: 'Regalo di compleanno.', status: 'pending' }];
let FOUND_PENDING = [{ id: 'f1', nickname: 'Anna', pieceTitle: 'La Monna Whiskey', note: 'Trovata a Berna sotto i portici.', photoUrl: null, createdAt: ago(5) }];

export const demo = {
  isDemo: true,

  async getSession() { return { demo: true, user: { id: ME.id } }; },
  onAuth() { return () => {}; },
  recovery: { pending: false, expired: false },
  async signIn() {},
  async signOut() { window.location.reload(); },
  async sendPasswordReset() {},
  async setPassword() {},
  async changePassword() {},
  async redeem() { return { ok: true, kind: 'purchase' }; },

  async loadMe() {
    await wait();
    return {
      profile: { ...ME },
      badges: ['fondatore', 'ritrovatore', 'primo-proprietario', 'vincitore'],
      counts: { series: 1, originals: 1, finds: 1, events: 2, wins: 1 },
      found: { id: 'fr0', status: 'approved', photo_path: 'x' },
    };
  },
  async refreshBadges() {},
  async updateProfile(patch) { Object.assign(ME, patch); const p = PEOPLE.find((x) => x.id === ME.id); if (patch.nickname && p) p.nickname = patch.nickname; },
  async myCollection() {
    await wait();
    return {
      series: [{ id: 's1', serial: 37, status: 'active', ship_status: 'shipped', tracking_url: 'https://example.com/tracking', eta: '8 ott', product: { id: 'pr1', title: 'T-shirt Monna', image_url: null } }],
      originals: PIECES.filter((p) => p.is_mine),
    };
  },

  async loadStructure() {
    await wait();
    return SERVERS.map((s) => {
      const cats = [];
      s.chans.forEach((c) => {
        let cat = cats.find((x) => x.name === c.category);
        if (!cat) cats.push((cat = { name: c.category, channels: [] }));
        cat.channels.push(c);
      });
      return { id: s.id, name: s.name, glyph: s.glyph, title: s.title, access: s.access, categories: cats };
    });
  },
  async listMessages(channelId) {
    await wait(80);
    return MESSAGES.filter((x) => x.channel_id === channelId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((x) => ({ ...x, author: author(x.user_id) }));
  },
  async postMessage(channelId, body) { MESSAGES.push({ id: nid(), channel_id: channelId, user_id: ME.id, created_at: new Date().toISOString(), body, reactions: [] }); },
  async toggleReaction(messageId, emoji, has) {
    const msg = MESSAGES.find((x) => x.id === messageId);
    if (!msg) return;
    if (has) msg.reactions = msg.reactions.filter((r) => !(r.user_id === ME.id && r.emoji === emoji));
    else msg.reactions.push({ emoji, user_id: ME.id });
  },
  async listPeople() { return PEOPLE; },

  async listPieces() { await wait(); return PIECES.map((p) => ({ ...p })); },
  async getTimeline(id) { return (TIMELINE[id] || []).map((t) => ({ ...t })); },
  async savePiece(piece, file) {
    const image_url = file ? URL.createObjectURL(file) : piece.image_url || null;
    const row = { title: piece.title, city: piece.city || null, description: piece.description || null, status: piece.status, left_at: piece.left_at ? new Date(piece.left_at).toISOString() : null, lost_note: piece.lost_note || null, image_url };
    if (piece.id) { Object.assign(PIECES.find((p) => p.id === piece.id), row); return piece.id; }
    const id = nid();
    PIECES.unshift({ id, ...row, owner_label: null, is_mine: false, created_at: new Date().toISOString() });
    TIMELINE[id] = [{ id: nid(), kind: row.status === 'left' ? 'left' : 'upcoming', text: row.city ? `Parte da ${row.city}.` : null, happened_at: new Date().toISOString() }];
    return id;
  },

  async listProducts() { await wait(); return PRODUCTS.map((p) => ({ ...p })); },
  async saveProduct(product, file) {
    const image_url = file ? URL.createObjectURL(file) : product.image_url || null;
    const keys = String(product.match_keys || '').split(',').map((k) => k.trim()).filter(Boolean);
    if (product.id) Object.assign(PRODUCTS.find((p) => p.id === product.id), { title: product.title, description: product.description, image_url, match_keys: keys, active: product.active !== false });
    else PRODUCTS.unshift({ id: nid(), title: product.title, description: product.description || null, image_url, match_keys: keys, active: true, owners: 0, mine: [], created_at: new Date().toISOString() });
  },

  async listEvents(game) { await wait(); return EVENTS.filter((e) => e.game === game).map((e) => ({ ...e })); },
  async joinEvent(id) { const e = EVENTS.find((x) => x.id === id); e.joined = true; e.entries++; },
  async leaveEvent(id) { const e = EVENTS.find((x) => x.id === id); e.joined = false; e.entries--; },
  async createEvent(ev) { EVENTS.unshift({ id: nid(), ...ev, closed_at: null, entries: 0, joined: false, starts_at: new Date(ev.starts_at).toISOString(), ends_at: new Date(ev.ends_at).toISOString() }); },
  async listAllEvents() { return EVENTS.map((e) => ({ ...e })); },
  async getBoard(game) {
    await wait();
    const b = BOARDS[game];
    if (!b) return { event: null, rows: [] };
    return { event: b.event, rows: b.rows.map(([nickname, value], i) => ({ rank: i + 1, nickname, value })) };
  },

  async requestTransfer({ pieceId, toNickname, note }) {
    const to = byNick(toNickname);
    if (!to) throw new Error('Non trovo nessun membro con questo nickname.');
    if (to.id === ME.id) throw new Error('Non puoi passare un’opera a te stesso.');
    const p = PIECES.find((x) => x.id === pieceId);
    TRANSFERS.push({ id: nid(), piece_id: pieceId, pieceTitle: p.title, from: ME.nickname, to: to.nickname, note, status: 'pending' });
  },
  async cancelTransfer(id) { TRANSFERS = TRANSFERS.filter((t) => t.id !== id); },
  async myTransfers() { return TRANSFERS.filter((t) => t.from === ME.nickname && t.status === 'pending').map((t) => ({ id: t.id, piece_id: t.piece_id, status: t.status, note: t.note, to_profile: { nickname: t.to } })); },

  async claimFoundCode() { throw new Error('In modalità demo il codice non viene verificato.'); },
  async myFoundRequest() { return null; },
  async uploadFoundPhoto() {},

  async adminOverview() {
    await wait();
    return {
      pendingFound: FOUND_PENDING,
      pendingTransfers: TRANSFERS.filter((t) => t.status === 'pending').map((t) => ({ id: t.id, pieceTitle: t.pieceTitle, from: t.from, to: t.to, note: t.note })),
      unmatched: [{ id: 'un1', name: 'Poster Whiskey 50x70', sku: 'POS-5070', email: 'cliente@esempio.com', created_at: ago(30) }],
      toClose: [],
    };
  },
  async adminAction(action, payload = {}) {
    await wait();
    if (action === 'approve_transfer') {
      const t = TRANSFERS.find((x) => x.id === payload.id);
      const p = PIECES.find((x) => x.id === t.piece_id);
      const to = byNick(t.to);
      p.owner_label = to.nickname; p.is_mine = to.id === ME.id;
      TIMELINE[p.id].push({ id: nid(), kind: 'passed', text: t.note, happened_at: new Date().toISOString(), from_label: t.from, to_label: t.to });
      TRANSFERS = TRANSFERS.filter((x) => x.id !== t.id);
    } else if (action === 'reject_transfer') {
      TRANSFERS = TRANSFERS.filter((x) => x.id !== payload.id);
    } else if (action === 'approve_found' || action === 'reject_found') {
      FOUND_PENDING = FOUND_PENDING.filter((x) => x.id !== payload.requestId);
    } else if (action === 'artwork_codes') {
      const p = PIECES.find((x) => x.id === payload.pieceId);
      return { ok: true, pieceTitle: p?.title, codes: Array.from({ length: Number(payload.count) || 1 }, (_, i) => `WISI-DEMO-${String(1000 + i)}`) };
    } else if (action === 'create_invite') {
      return { ok: true, code: 'WISI-DEMO-INVT' };
    } else if (action === 'register_purchase') {
      return { ok: true, member: false, code: 'WISI-DEMO-ORDR' };
    } else if (action === 'close_event') {
      const e = EVENTS.find((x) => x.id === payload.eventId);
      if (e) e.closed_at = new Date().toISOString();
      return { ok: true, closed: true };
    }
    return { ok: true };
  },
};
