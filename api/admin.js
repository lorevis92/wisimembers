import { randomUUID } from 'node:crypto';
import { admin, body, requireAdmin, logActivity, SITE_URL } from './_lib/supabase.js';
import { createCode } from './_lib/codes.js';
import { processOrder } from './_lib/orders.js';
import { recomputeBadges } from './_lib/badges.js';
import { closeEvent } from './_lib/events.js';
import { sendOnce } from './_lib/email.js';
import { T } from './_lib/templates.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function emailOf(userId) {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data?.user?.email || null;
}

/**
 * Azioni dello Studio (solo admin). POST { action, ... } con Authorization: Bearer <token>.
 *  overview            cosa c'e da fare: ritrovamenti, passaggi, articoli non riconosciuti, gare da chiudere
 *  approve_found / reject_found
 *  approve_transfer / reject_transfer
 *  artwork_codes       genera i codici da stampare per le buste di un quadro
 *  create_invite       invito manuale per un'email
 *  register_purchase   registra a mano un acquisto (stessa logica del webhook Printful)
 *  close_event         chiude una gara (con ordine manuale se il gioco non ha punteggi collegati)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
  try {
    const ctx = await requireAdmin(req, res);
    if (!ctx) return;
    const input = body(req);
    const siteUrl = SITE_URL();

    switch (input.action) {
      case 'overview': {
        const { data: found } = await admin
          .from('wm_found_requests')
          .select('id, user_id, piece_id, photo_path, note, created_at, wm_profiles(nickname), wm_pieces(title)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        const pendingFound = [];
        for (const f of found || []) {
          let photoUrl = null;
          if (f.photo_path) {
            const { data } = await admin.storage.from('wm-found').createSignedUrl(f.photo_path, 3600);
            photoUrl = data?.signedUrl || null;
          }
          pendingFound.push({
            id: f.id,
            nickname: f.wm_profiles?.nickname,
            pieceTitle: f.wm_pieces?.title || null,
            note: f.note,
            photoUrl,
            createdAt: f.created_at,
          });
        }
        const { data: tr } = await admin
          .from('wm_transfers')
          .select('id, note, created_at, wm_pieces(title), from:wm_profiles!from_user(nickname), to:wm_profiles!to_user(nickname)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        const pendingTransfers = (tr || []).map((t) => ({
          id: t.id,
          pieceTitle: t.wm_pieces?.title,
          from: t.from?.nickname,
          to: t.to?.nickname,
          note: t.note,
        }));
        const { data: unmatched } = await admin
          .from('wm_unmatched_items')
          .select('*')
          .eq('resolved', false)
          .order('created_at', { ascending: false })
          .limit(50);
        const { data: toClose } = await admin
          .from('wm_events')
          .select('id, title, game, ends_at')
          .is('closed_at', null)
          .lt('ends_at', new Date().toISOString());
        return res.status(200).json({ pendingFound, pendingTransfers, unmatched: unmatched || [], toClose: toClose || [] });
      }

      case 'approve_found': {
        const { data: f } = await admin.from('wm_found_requests').select('*').eq('id', input.requestId).maybeSingle();
        if (!f || f.status !== 'pending') return res.status(400).json({ error: 'Richiesta non valida.' });
        if (!f.photo_path && !input.force) return res.status(400).json({ error: 'Manca la foto del quadro.' });
        let pieceTitle = null;
        if (f.piece_id) {
          const { data: piece } = await admin.from('wm_pieces').select('title').eq('id', f.piece_id).maybeSingle();
          pieceTitle = piece?.title || null;
          const now = new Date().toISOString();
          await admin
            .from('wm_pieces')
            .update({ status: 'found', current_owner: f.user_id, owner_since: now, found_by: f.user_id, lost_note: null })
            .eq('id', f.piece_id);
          await admin.from('wm_piece_events').insert({
            piece_id: f.piece_id,
            kind: 'found',
            to_user: f.user_id,
            text: 'Raccolto e verificato con il codice della busta.',
          });
        }
        await admin.from('wm_profiles').update({ is_finder: true }).eq('id', f.user_id);
        await admin
          .from('wm_found_requests')
          .update({ status: 'approved', reviewed_at: new Date().toISOString() })
          .eq('id', f.id);
        await logActivity(f.user_id, 'found', f.piece_id);
        await recomputeBadges(f.user_id);
        const email = await emailOf(f.user_id);
        if (email) await sendOnce(`foundok:${f.id}`, email, T.foundApproved({ pieceTitle, siteUrl }));
        return res.status(200).json({ ok: true });
      }

      case 'reject_found': {
        const { data: f } = await admin.from('wm_found_requests').select('*').eq('id', input.requestId).maybeSingle();
        if (!f || f.status !== 'pending') return res.status(400).json({ error: 'Richiesta non valida.' });
        await admin
          .from('wm_found_requests')
          .update({ status: 'rejected', reject_reason: input.reason || null, reviewed_at: new Date().toISOString() })
          .eq('id', f.id);
        const email = await emailOf(f.user_id);
        if (email) await sendOnce(`foundno:${f.id}`, email, T.foundRejected({ reason: input.reason }));
        return res.status(200).json({ ok: true });
      }

      case 'approve_transfer': {
        const { data: t } = await admin.from('wm_transfers').select('*').eq('id', input.id).maybeSingle();
        if (!t || t.status !== 'pending') return res.status(400).json({ error: 'Passaggio non valido.' });
        const { data: piece } = await admin.from('wm_pieces').select('id, title, current_owner').eq('id', t.piece_id).maybeSingle();
        if (!piece || piece.current_owner !== t.from_user) {
          return res.status(409).json({ error: "L'opera non appartiene più a chi ha chiesto il passaggio." });
        }
        const now = new Date().toISOString();
        await admin.from('wm_pieces').update({ current_owner: t.to_user, owner_since: now }).eq('id', piece.id);
        await admin.from('wm_piece_events').insert({
          piece_id: piece.id,
          kind: 'passed',
          from_user: t.from_user,
          to_user: t.to_user,
          text: t.note || null,
        });
        await admin.from('wm_transfers').update({ status: 'approved', reviewed_at: now }).eq('id', t.id);
        await logActivity(t.from_user, 'transfer_out', piece.id);
        await logActivity(t.to_user, 'transfer_in', piece.id);
        await recomputeBadges(t.from_user);
        await recomputeBadges(t.to_user);
        const { data: names } = await admin.from('wm_profiles').select('id, nickname').in('id', [t.from_user, t.to_user]);
        const nick = Object.fromEntries((names || []).map((n) => [n.id, n.nickname]));
        const [ef, et] = await Promise.all([emailOf(t.from_user), emailOf(t.to_user)]);
        if (ef) await sendOnce(`tr-from:${t.id}`, ef, T.transferApproved({ pieceTitle: piece.title, role: 'from', other: nick[t.to_user], siteUrl }));
        if (et) await sendOnce(`tr-to:${t.id}`, et, T.transferApproved({ pieceTitle: piece.title, role: 'to', other: nick[t.from_user], siteUrl }));
        return res.status(200).json({ ok: true });
      }

      case 'reject_transfer': {
        const { data: t } = await admin.from('wm_transfers').select('*').eq('id', input.id).maybeSingle();
        if (!t || t.status !== 'pending') return res.status(400).json({ error: 'Passaggio non valido.' });
        await admin.from('wm_transfers').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', t.id);
        const { data: piece } = await admin.from('wm_pieces').select('title').eq('id', t.piece_id).maybeSingle();
        const ef = await emailOf(t.from_user);
        if (ef) await sendOnce(`tr-no:${t.id}`, ef, T.transferRejected({ pieceTitle: piece?.title || 'opera' }));
        return res.status(200).json({ ok: true });
      }

      case 'artwork_codes': {
        const count = Math.min(Math.max(parseInt(input.count, 10) || 1, 1), 100);
        const { data: piece } = await admin.from('wm_pieces').select('id, title').eq('id', input.pieceId).maybeSingle();
        if (!piece) return res.status(404).json({ error: 'Opera non trovata.' });
        const codes = [];
        for (let i = 0; i < count; i++) codes.push((await createCode({ kind: 'artwork', pieceId: piece.id })).code);
        return res.status(200).json({ ok: true, pieceTitle: piece.title, codes });
      }

      case 'create_invite': {
        const email = String(input.email || '').toLowerCase().trim();
        if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email non valida.' });
        const code = await createCode({ kind: 'purchase', email, orderKey: `invite:${randomUUID()}` });
        await sendOnce(`invite:${code.id}`, email, T.invite({ code: code.code, siteUrl }));
        return res.status(200).json({ ok: true, code: code.code });
      }

      case 'register_purchase': {
        const email = String(input.email || '').toLowerCase().trim();
        if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email non valida.' });
        const lines = (input.items || []).filter((i) => i.productId && Number(i.qty) > 0);
        if (!lines.length) return res.status(400).json({ error: 'Scegli almeno un prodotto.' });
        const ids = lines.map((l) => l.productId);
        const { data: products } = await admin.from('wm_products').select('id, title').in('id', ids);
        const byId = Object.fromEntries((products || []).map((p) => [p.id, p]));
        const matched = lines
          .filter((l) => byId[l.productId])
          .map((l, idx) => ({ lineIdx: idx, product: byId[l.productId], quantity: Math.min(Number(l.qty), 20) }));
        const result = await processOrder({ orderKey: `manual:${randomUUID()}`, email, matched });
        return res.status(200).json({ ok: true, ...result });
      }

      case 'close_event': {
        let order = null;
        if (Array.isArray(input.order) && input.order.length) {
          order = [];
          for (const n of input.order) {
            const { data: p } = await admin.from('wm_profiles').select('id').ilike('nickname', String(n).trim()).maybeSingle();
            if (!p) return res.status(404).json({ error: `Nickname non trovato: ${n}` });
            order.push(p.id);
          }
        }
        const r = await closeEvent(input.eventId, order);
        return res.status(200).json({ ok: true, ...r });
      }

      default:
        return res.status(400).json({ error: 'Azione sconosciuta.' });
    }
  } catch (e) {
    console.error('[admin]', e);
    return res.status(500).json({ error: e.message || 'Errore interno' });
  }
}
