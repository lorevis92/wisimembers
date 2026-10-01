import { admin } from './supabase.js';
import { FOUNDERS_LIMIT } from '../../shared/badges.js';

/** Conteggi che alimentano badge e livelli di un utente. */
export async function loadCounts(userId) {
  const head = { count: 'exact', head: true };
  const [series, originals, finds, events, wins] = await Promise.all([
    admin.from('wm_ownerships').select('id', head).eq('user_id', userId).eq('status', 'active'),
    admin.from('wm_pieces').select('id', head).eq('current_owner', userId),
    admin.from('wm_found_requests').select('id', head).eq('user_id', userId).eq('status', 'approved'),
    admin.from('wm_event_entries').select('event_id', head).eq('user_id', userId),
    admin.from('wm_event_results').select('event_id', head).eq('user_id', userId).eq('rank', 1),
  ]);
  return {
    series: series.count || 0,
    originals: originals.count || 0,
    finds: finds.count || 0,
    events: events.count || 0,
    wins: wins.count || 0,
  };
}

/**
 * Ricalcola i badge di un utente a partire dallo stato attuale e li salva (idempotente).
 * Chiamata dopo ogni evento: acquisto, ritrovamento, passaggio, gara chiusa.
 */
export async function recomputeBadges(userId) {
  const { data: profile } = await admin.from('wm_profiles').select('member_no').eq('id', userId).maybeSingle();
  if (!profile) return [];

  const earned = [];
  const add = (id, meta = null) => earned.push({ user_id: userId, badge_id: id, meta });

  if (profile.member_no <= FOUNDERS_LIMIT) add('fondatore', { member_no: profile.member_no });

  const { data: finds } = await admin.from('wm_found_requests').select('piece_id').eq('user_id', userId).eq('status', 'approved');
  if ((finds || []).length > 0) add('ritrovatore');

  const { data: owned } = await admin.from('wm_pieces').select('id, found_by, owner_since').eq('current_owner', userId);
  if ((owned || []).some((p) => p.found_by === userId)) add('primo-proprietario');
  const yearAgo = Date.now() - 365 * 24 * 3600 * 1000;
  if ((owned || []).some((p) => p.owner_since && new Date(p.owner_since).getTime() <= yearAgo)) add('custode');

  const { data: wins } = await admin.from('wm_event_results').select('event_id').eq('user_id', userId).eq('rank', 1);
  if ((wins || []).length > 0) {
    add('vincitore');
    const ids = wins.map((w) => w.event_id);
    const { data: cups } = await admin.from('wm_events').select('id').in('id', ids).eq('is_cup', true);
    if ((cups || []).length > 0) add('coppa');
  }

  if (earned.length) {
    await admin.from('wm_user_badges').upsert(earned, { onConflict: 'user_id,badge_id', ignoreDuplicates: true });
  }
  return earned.map((e) => e.badge_id);
}
