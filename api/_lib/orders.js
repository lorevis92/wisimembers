import { admin, userIdByEmail, getProfile, logActivity, SITE_URL } from './supabase.js';
import { createCode } from './codes.js';
import { sendOnce } from './email.js';
import { T } from './templates.js';
import { recomputeBadges } from './badges.js';

/**
 * Registra un ordine (da Printful o inserito a mano dallo Studio).
 * - crea una riga "proprieta" per ogni pezzo (con numero progressivo per i pezzi in serie)
 * - se l'email ha gia un account membro: aggancia i pezzi e avvisa
 * - altrimenti: crea (o riusa) un codice invito monouso legato all'email e lo spedisce subito
 * E idempotente: la stessa orderKey non crea mai doppioni.
 */
export async function processOrder({ orderKey, email, matched }) {
  email = String(email || '').toLowerCase().trim();
  if (!email) throw new Error('Ordine senza email del cliente.');

  const userId = await userIdByEmail(email);
  const profile = userId ? await getProfile(userId) : null;
  const memberId = profile ? userId : null;

  const titles = [];
  let created = 0;
  for (const m of matched) {
    for (let unit = 0; unit < m.quantity; unit++) {
      const { data: existing } = await admin
        .from('wm_ownerships')
        .select('id')
        .eq('order_key', orderKey)
        .eq('line_idx', m.lineIdx)
        .eq('unit_idx', unit)
        .maybeSingle();
      titles.push(m.product.title);
      if (existing) continue;
      const { data: serial } = await admin.rpc('wm_next_serial', { p: m.product.id });
      const { error } = await admin.from('wm_ownerships').insert({
        user_id: memberId,
        email,
        product_id: m.product.id,
        serial: serial ?? null,
        order_key: orderKey,
        line_idx: m.lineIdx,
        unit_idx: unit,
      });
      if (error && error.code !== '23505') throw error;
      if (!error) created++;
    }
  }

  const siteUrl = SITE_URL();
  if (memberId) {
    if (created > 0) {
      await logActivity(memberId, 'purchase', orderKey);
      await recomputeBadges(memberId);
    }
    await sendOnce(`piece:${orderKey}`, email, T.pieceAdded({ titles, siteUrl }));
    return { member: true, created };
  }

  // Non ancora membro: un solo codice acquisto non usato per email.
  let { data: code } = await admin
    .from('wm_codes')
    .select('*')
    .eq('kind', 'purchase')
    .eq('email', email)
    .eq('status', 'unused')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!code) code = await createCode({ kind: 'purchase', email, orderKey });
  await sendOnce(`welcome:${orderKey}`, email, T.welcomeOrder({ code: code.code, titles, siteUrl }));
  return { member: false, created, code: code.code };
}

/** Annullamento ordine: pezzi tolti, codice non usato revocato. */
export async function cancelOrder({ orderKey, email }) {
  const { data: rows } = await admin
    .from('wm_ownerships')
    .update({ status: 'canceled' })
    .eq('order_key', orderKey)
    .select('user_id, wm_products(title)');
  await admin.from('wm_codes').update({ status: 'revoked' }).eq('order_key', orderKey).eq('status', 'unused');
  for (const uid of new Set((rows || []).map((r) => r.user_id).filter(Boolean))) await recomputeBadges(uid);
  const titles = (rows || []).map((r) => r.wm_products?.title).filter(Boolean);
  if (email && titles.length) await sendOnce(`canceled:${orderKey}`, email, T.canceled({ titles }));
  return { canceled: (rows || []).length };
}
