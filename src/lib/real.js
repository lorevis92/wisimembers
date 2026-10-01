// Implementazione reale: Supabase (database, auth, storage) + funzioni /api su Vercel.
import { supabase } from './supabase.js';
import { shrinkImage } from './util.js';

async function post(path, payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const r = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Errore ${r.status}`);
  return j;
}

const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

async function uid() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

async function uploadPublic(file, folder = '') {
  const blob = await shrinkImage(file);
  const path = `${folder}${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('wm-art').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  return supabase.storage.from('wm-art').getPublicUrl(path).data.publicUrl;
}

const toIso = (d) => (d ? new Date(d).toISOString() : null);

export const real = {
  isDemo: false,

  /* ---------- accesso ---------- */
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },
  onAuth(cb) {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => cb(s));
    return () => data.subscription.unsubscribe();
  },
  async signInEmail(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    // Per non rivelare quali email esistono, un errore "utente non trovato" viene trattato come successo.
    if (error && !/signups? not allowed|not found|invalid/i.test(error.message)) throw new Error(error.message);
  },
  async signOut() {
    await supabase.auth.signOut();
  },
  async redeem({ code, email, nickname }) {
    return post('/api/redeem', { code, email, nickname });
  },

  /* ---------- io ---------- */
  async loadMe() {
    const id = await uid();
    if (!id) return null;
    const profile = must(await supabase.from('wm_profiles').select('*').eq('id', id).maybeSingle());
    if (!profile) return { profile: null };
    const head = { count: 'exact', head: true };
    const [badges, series, originals, finds, events, wins, found] = await Promise.all([
      supabase.from('wm_user_badges').select('badge_id').eq('user_id', id),
      supabase.from('wm_ownerships').select('id', head).eq('user_id', id).eq('status', 'active'),
      supabase.from('wm_pieces_public').select('id', head).eq('is_mine', true),
      supabase.from('wm_found_requests').select('id', head).eq('user_id', id).eq('status', 'approved'),
      supabase.from('wm_event_entries').select('event_id', head).eq('user_id', id),
      supabase.from('wm_event_results').select('event_id', head).eq('user_id', id).eq('rank', 1),
      supabase.from('wm_found_requests').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(1),
    ]);
    return {
      profile,
      badges: (badges.data || []).map((b) => b.badge_id),
      counts: {
        series: series.count || 0,
        originals: originals.count || 0,
        finds: finds.count || 0,
        events: events.count || 0,
        wins: wins.count || 0,
      },
      found: found.data?.[0] || null,
    };
  },
  async refreshBadges() {
    return post('/api/member', { action: 'refresh' }).catch(() => null);
  },
  async updateProfile(patch) {
    const id = await uid();
    const { error } = await supabase.from('wm_profiles').update(patch).eq('id', id);
    if (error) {
      if (error.code === '23505') throw new Error('Questo nickname è già preso.');
      throw new Error(error.message);
    }
  },
  async myCollection() {
    const id = await uid();
    const series = must(
      await supabase
        .from('wm_ownerships')
        .select('id, serial, status, ship_status, tracking_url, eta, product:wm_products(id, title, image_url)')
        .eq('user_id', id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
    );
    const originals = must(await supabase.from('wm_pieces_public').select('*').eq('is_mine', true));
    return { series, originals };
  },

  /* ---------- struttura e chat ---------- */
  async loadStructure() {
    const servers = must(await supabase.from('wm_servers').select('*').order('position'));
    const channels = must(await supabase.from('wm_channels').select('*').order('position'));
    return servers.map((s) => {
      const cats = [];
      channels
        .filter((c) => c.server_id === s.id)
        .forEach((c) => {
          let cat = cats.find((x) => x.name === c.category);
          if (!cat) cats.push((cat = { name: c.category, channels: [] }));
          cat.channels.push(c);
        });
      return { ...s, categories: cats };
    });
  },
  async listMessages(channelId) {
    return must(
      await supabase
        .from('wm_messages')
        .select('id, body, created_at, user_id, author:wm_profiles(nickname, is_admin, is_finder), reactions:wm_reactions(emoji, user_id)')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })
        .limit(200),
    );
  },
  async postMessage(channelId, text) {
    const id = await uid();
    must(await supabase.from('wm_messages').insert({ channel_id: channelId, user_id: id, body: text }));
  },
  async toggleReaction(messageId, emoji, has) {
    const id = await uid();
    if (has) must(await supabase.from('wm_reactions').delete().match({ message_id: messageId, user_id: id, emoji }));
    else must(await supabase.from('wm_reactions').insert({ message_id: messageId, user_id: id, emoji }));
  },
  subscribeMessages(channelId, cb) {
    const ch = supabase
      .channel(`msgs-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wm_messages', filter: `channel_id=eq.${channelId}` }, () => cb())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wm_reactions' }, () => cb())
      .subscribe();
    return () => supabase.removeChannel(ch);
  },
  async listPeople() {
    return must(
      await supabase
        .from('wm_profiles')
        .select('id, nickname, is_admin, is_finder')
        .order('is_admin', { ascending: false })
        .order('is_finder', { ascending: false })
        .order('nickname'),
    );
  },

  /* ---------- registro ---------- */
  async listPieces() {
    return must(await supabase.from('wm_pieces_public').select('*').order('created_at', { ascending: false }));
  },
  async getTimeline(pieceId) {
    return must(await supabase.from('wm_piece_timeline').select('*').eq('piece_id', pieceId).order('happened_at'));
  },
  async savePiece(piece, file) {
    let image_url = piece.image_url || null;
    if (file) image_url = await uploadPublic(file, 'pieces/');
    const row = {
      title: piece.title.trim(),
      city: piece.city?.trim() || null,
      description: piece.description?.trim() || null,
      status: piece.status,
      left_at: toIso(piece.left_at),
      lost_note: piece.lost_note?.trim() || null,
      image_url,
    };
    if (piece.id) {
      must(await supabase.from('wm_pieces').update(row).eq('id', piece.id));
      if (piece.prevStatus && piece.prevStatus !== piece.status && piece.status === 'left') {
        must(
          await supabase.from('wm_piece_events').insert({
            piece_id: piece.id,
            kind: 'left',
            text: row.city ? `Lasciato a ${row.city}.` : 'Lasciato per strada.',
            happened_at: row.left_at || new Date().toISOString(),
          }),
        );
      }
      return piece.id;
    }
    const created = must(await supabase.from('wm_pieces').insert(row).select('id').single());
    must(
      await supabase.from('wm_piece_events').insert({
        piece_id: created.id,
        kind: row.status === 'left' ? 'left' : 'upcoming',
        text: row.status === 'left' ? (row.city ? `Lasciato a ${row.city}.` : 'Lasciato per strada.') : row.city ? `Parte da ${row.city}.` : null,
        happened_at: row.left_at || new Date().toISOString(),
      }),
    );
    return created.id;
  },

  /* ---------- prodotti in serie ---------- */
  async listProducts() {
    const id = await uid();
    const products = must(await supabase.from('wm_products').select('*').order('created_at', { ascending: false }));
    const stats = must(await supabase.from('wm_product_stats').select('*'));
    const mine = must(
      await supabase.from('wm_ownerships').select('product_id, serial').eq('user_id', id).eq('status', 'active'),
    );
    const owners = Object.fromEntries(stats.map((s) => [s.product_id, Number(s.owners)]));
    return products.map((p) => ({
      ...p,
      owners: owners[p.id] || 0,
      mine: mine.filter((m) => m.product_id === p.id).map((m) => m.serial),
    }));
  },
  async saveProduct(product, file) {
    let image_url = product.image_url || null;
    if (file) image_url = await uploadPublic(file, 'products/');
    const row = {
      title: product.title.trim(),
      description: product.description?.trim() || null,
      image_url,
      match_keys: (product.match_keys || '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
      active: product.active !== false,
    };
    if (product.id) must(await supabase.from('wm_products').update(row).eq('id', product.id));
    else must(await supabase.from('wm_products').insert(row));
  },

  /* ---------- gare ---------- */
  async listEvents(game) {
    const id = await uid();
    const rows = must(
      await supabase.from('wm_events').select('*, entries:wm_event_entries(user_id)').eq('game', game).order('starts_at', { ascending: false }),
    );
    return rows.map((e) => ({ ...e, entries: e.entries.length, joined: e.entries.some((x) => x.user_id === id) }));
  },
  async joinEvent(eventId) {
    const id = await uid();
    must(await supabase.from('wm_event_entries').insert({ event_id: eventId, user_id: id }));
  },
  async leaveEvent(eventId) {
    const id = await uid();
    must(await supabase.from('wm_event_entries').delete().match({ event_id: eventId, user_id: id }));
  },
  async createEvent(ev) {
    must(
      await supabase.from('wm_events').insert({
        game: ev.game,
        title: ev.title.trim(),
        description: ev.description?.trim() || null,
        prize: ev.prize?.trim() || null,
        is_cup: !!ev.is_cup,
        starts_at: toIso(ev.starts_at),
        ends_at: toIso(ev.ends_at),
      }),
    );
  },
  async listAllEvents() {
    return must(await supabase.from('wm_events').select('*').order('starts_at', { ascending: false }).limit(30));
  },
  async getBoard(game) {
    return post('/api/member', { action: 'board', game });
  },

  /* ---------- passaggi ---------- */
  async requestTransfer({ pieceId, toNickname, note }) {
    return post('/api/member', { action: 'transfer_request', pieceId, toNickname, note });
  },
  async cancelTransfer(id) {
    return post('/api/member', { action: 'transfer_cancel', id });
  },
  async myTransfers() {
    const id = await uid();
    return must(
      await supabase
        .from('wm_transfers')
        .select('id, piece_id, status, note, to_profile:wm_profiles!to_user(nickname)')
        .eq('from_user', id)
        .eq('status', 'pending'),
    );
  },

  /* ---------- ritrovamenti ---------- */
  async claimFoundCode(code) {
    return post('/api/member', { action: 'claim_found_code', code });
  },
  async myFoundRequest() {
    const id = await uid();
    const rows = must(
      await supabase.from('wm_found_requests').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(1),
    );
    return rows[0] || null;
  },
  async uploadFoundPhoto(requestId, file, note) {
    const id = await uid();
    const blob = await shrinkImage(file);
    const path = `${id}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from('wm-found').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    must(await supabase.from('wm_found_requests').update({ photo_path: path, note: note || null }).eq('id', requestId));
    await post('/api/member', { action: 'found_submitted', requestId });
  },

  /* ---------- Studio ---------- */
  async adminOverview() {
    return post('/api/admin', { action: 'overview' });
  },
  async adminAction(action, payload = {}) {
    return post('/api/admin', { action, ...payload });
  },
};
