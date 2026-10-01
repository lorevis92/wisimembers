import { admin, body, requireMember } from './_lib/supabase.js';
import { normalizeCode, tooManyAttempts, recordAttempt } from './_lib/codes.js';
import { claimArtworkCode } from './_lib/found.js';
import { recomputeBadges } from './_lib/badges.js';
import { boardFor } from './_lib/events.js';
import { notifyAdmin } from './_lib/email.js';

/**
 * Azioni dei membri loggati. POST { action, ... } con header Authorization: Bearer <token>.
 *  refresh            ricalcola i miei badge
 *  claim_found_code   riscatta il codice della busta di un quadro (ritrovamento)
 *  found_submitted    avviso a Lorenzo: ho caricato la foto del ritrovamento
 *  transfer_request   chiedo di passare un'opera a un altro membro
 *  transfer_cancel    annullo una richiesta ancora in attesa
 *  board              classifica di un gioco
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
  try {
    const input = body(req);
    const ctx = await requireMember(req, res);
    if (!ctx) return;
    const { user, profile } = ctx;

    switch (input.action) {
      case 'refresh': {
        const badges = await recomputeBadges(user.id);
        return res.status(200).json({ ok: true, badges });
      }

      case 'claim_found_code': {
        const idents = [`user:${user.id}`];
        if (await tooManyAttempts(idents)) return res.status(429).json({ error: 'Troppi tentativi. Riprova tra qualche minuto.' });
        await recordAttempt(idents);
        const code = normalizeCode(input.code);
        if (!code) return res.status(400).json({ error: 'Il codice non è nel formato giusto (WISI-XXXX-XXXX).' });
        const { data: row } = await admin.from('wm_codes').select('*').eq('code', code).maybeSingle();
        if (!row || row.status !== 'unused' || row.kind !== 'artwork') {
          return res.status(400).json({ error: 'Codice non valido o già utilizzato.' });
        }
        try {
          const request = await claimArtworkCode(user.id, profile.nickname, row);
          return res.status(200).json({ ok: true, requestId: request.id });
        } catch (e) {
          if (e.status === 409) return res.status(400).json({ error: 'Codice non valido o già utilizzato.' });
          throw e;
        }
      }

      case 'found_submitted': {
        const { data: r } = await admin
          .from('wm_found_requests')
          .select('id, photo_path, status')
          .eq('id', input.requestId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (!r || !r.photo_path) return res.status(400).json({ error: 'Carica prima una foto.' });
        await notifyAdmin(`foundphoto:${r.id}`, 'Foto di un ritrovamento pronta', [
          `${profile.nickname} ha caricato la foto del suo ritrovamento.`,
        ]);
        return res.status(200).json({ ok: true });
      }

      case 'transfer_request': {
        const { pieceId, toNickname, note } = input;
        const { data: piece } = await admin.from('wm_pieces').select('id, title, current_owner').eq('id', pieceId).maybeSingle();
        if (!piece || piece.current_owner !== user.id) return res.status(403).json({ error: 'Questa opera non è tua.' });
        const nick = String(toNickname || '').trim();
        if (!nick) return res.status(400).json({ error: 'Scrivi il nickname di chi riceve l’opera.' });
        const { data: to } = await admin.from('wm_profiles').select('id, nickname').ilike('nickname', nick).maybeSingle();
        if (!to) return res.status(404).json({ error: 'Non trovo nessun membro con questo nickname.' });
        if (to.id === user.id) return res.status(400).json({ error: 'Non puoi passare un’opera a te stesso.' });
        const { count } = await admin
          .from('wm_transfers')
          .select('id', { count: 'exact', head: true })
          .eq('piece_id', piece.id)
          .eq('status', 'pending');
        if (count) return res.status(409).json({ error: 'C’è già un passaggio in attesa per questa opera.' });
        const { data: tr, error } = await admin
          .from('wm_transfers')
          .insert({ piece_id: piece.id, from_user: user.id, to_user: to.id, note: String(note || '').slice(0, 300) })
          .select()
          .single();
        if (error) throw error;
        await notifyAdmin(`transfer:${tr.id}`, 'Passaggio da approvare', [
          `${profile.nickname} vuole passare "${piece.title}" a ${to.nickname}.`,
          note ? `Nota: ${note}` : '',
        ].filter(Boolean));
        return res.status(200).json({ ok: true, id: tr.id });
      }

      case 'transfer_cancel': {
        const { error } = await admin
          .from('wm_transfers')
          .update({ status: 'canceled', reviewed_at: new Date().toISOString() })
          .eq('id', input.id)
          .eq('from_user', user.id)
          .eq('status', 'pending');
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      case 'board': {
        const game = String(input.game || '');
        return res.status(200).json(await boardFor(game));
      }

      default:
        return res.status(400).json({ error: 'Azione sconosciuta.' });
    }
  } catch (e) {
    console.error('[member]', e);
    return res.status(500).json({ error: 'Qualcosa è andato storto. Riprova tra poco.' });
  }
}
