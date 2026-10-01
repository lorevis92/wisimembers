import { admin, logActivity, SITE_URL } from './supabase.js';
import { SOURCES } from './scoreSources.js';
import { recomputeBadges } from './badges.js';
import { sendOnce, notifyAdmin } from './email.js';
import { T } from './templates.js';

/**
 * Classifica di una gara: per ogni iscritto il suo miglior risultato dentro la finestra della gara.
 * Ritorna [{ user_id, value }] ordinata dal migliore.
 */
export async function computeRanking(event) {
  const src = SOURCES[event.game];
  if (!src) return null; // nessuna sorgente: serve l'ordine manuale

  const { data: entries } = await admin.from('wm_event_entries').select('user_id').eq('event_id', event.id);
  const ids = (entries || []).map((e) => e.user_id);
  if (!ids.length) return [];

  const best = new Map();
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await admin
      .from(src.table)
      .select(`${src.userCol}, ${src.valueCol}`)
      .in(src.userCol, ids)
      .gte(src.dateCol, event.starts_at)
      .lte(src.dateCol, event.ends_at)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Lettura punteggi (${src.table}): ${error.message}`);
    for (const row of data || []) {
      const uid = row[src.userCol];
      const v = Number(row[src.valueCol]);
      if (!Number.isFinite(v)) continue;
      const cur = best.get(uid);
      if (cur == null || (src.best === 'max' ? v > cur : v < cur)) best.set(uid, v);
    }
    if (!data || data.length < PAGE) break;
  }
  const rows = [...best.entries()].map(([user_id, value]) => ({ user_id, value }));
  rows.sort((a, b) => (src.best === 'max' ? b.value - a.value : a.value - b.value));
  return rows;
}

/**
 * Chiude una gara: scrive i risultati, assegna badge, avvisa il vincitore.
 * manualOrder (opzionale): array di user id in ordine di arrivo, per i giochi senza sorgente punteggi.
 */
export async function closeEvent(eventId, manualOrder = null) {
  const { data: event } = await admin.from('wm_events').select('*').eq('id', eventId).maybeSingle();
  if (!event) throw new Error('Gara non trovata.');
  if (event.closed_at) return { already: true };

  let rows = manualOrder ? manualOrder.map((user_id) => ({ user_id, value: null })) : await computeRanking(event);
  if (rows == null) {
    await notifyAdmin(`manual:${event.id}`, 'Gara da chiudere a mano', [
      `La gara "${event.title}" è finita ma per "${event.game}" non c'è una sorgente punteggi collegata.`,
      'Chiudila dallo Studio indicando l\'ordine di arrivo.',
    ]);
    return { needsManual: true };
  }

  await admin.from('wm_event_results').delete().eq('event_id', event.id);
  if (rows.length) {
    await admin
      .from('wm_event_results')
      .insert(rows.map((r, i) => ({ event_id: event.id, user_id: r.user_id, rank: i + 1, value: r.value })));
  }
  await admin.from('wm_events').update({ closed_at: new Date().toISOString() }).eq('id', event.id);

  const winner = rows[0];
  if (winner) {
    await logActivity(winner.user_id, 'win', event.id);
    await recomputeBadges(winner.user_id);
    const { data: u } = await admin.auth.admin.getUserById(winner.user_id);
    const email = u?.user?.email;
    if (email) await sendOnce(`won:${event.id}`, email, T.eventWon({ eventTitle: event.title, prize: event.prize, siteUrl: SITE_URL() }));
    await notifyAdmin(`closed:${event.id}`, `Gara chiusa: ${event.title}`, [
      `Vincitore: ${u?.user?.email || winner.user_id}${event.prize ? ` · premio: ${event.prize}` : ''}`,
    ]);
  }
  return { closed: true, winners: rows.slice(0, 3) };
}

/** Classifica provvisoria (gara aperta) o finale (gara chiusa) con i nickname. */
export async function boardFor(game) {
  const { data: events } = await admin
    .from('wm_events')
    .select('*')
    .eq('game', game)
    .order('starts_at', { ascending: false })
    .limit(5);
  const list = events || [];
  const event = list.find((e) => !e.closed_at) || list[0];
  if (!event) return { event: null, rows: [] };

  let rows;
  if (event.closed_at) {
    const { data } = await admin
      .from('wm_event_results')
      .select('user_id, rank, value')
      .eq('event_id', event.id)
      .order('rank', { ascending: true })
      .limit(20);
    rows = data || [];
  } else {
    const ranking = (await computeRanking(event).catch(() => null)) || [];
    rows = ranking.slice(0, 20).map((r, i) => ({ ...r, rank: i + 1 }));
  }
  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = ids.length ? await admin.from('wm_profiles').select('id, nickname').in('id', ids) : { data: [] };
  const nick = Object.fromEntries((profiles || []).map((p) => [p.id, p.nickname]));
  return {
    event: { id: event.id, title: event.title, closed: !!event.closed_at, ends_at: event.ends_at },
    rows: rows.map((r) => ({ rank: r.rank, nickname: nick[r.user_id] || 'Membro', value: r.value })),
  };
}
