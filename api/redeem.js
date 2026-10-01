import { admin, body, userIdByEmail, getProfile, logActivity } from './_lib/supabase.js';
import { normalizeCode, tooManyAttempts, recordAttempt, burnCode } from './_lib/codes.js';
import { claimArtworkCode } from './_lib/found.js';
import { recomputeBadges } from './_lib/badges.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function uniqueNickname(base) {
  const clean = String(base || 'membro').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 20) || 'membro';
  for (let i = 0; i < 20; i++) {
    const nick = i === 0 ? clean : `${clean}${Math.floor(100 + Math.random() * 900)}`;
    const { data } = await admin.from('wm_profiles').select('id').ilike('nickname', nick).maybeSingle();
    if (!data) return nick;
  }
  return `${clean}${Date.now() % 100000}`;
}

/**
 * Riscatto di un codice (pubblico: serve anche a chi non ha ancora un account).
 *  - codice acquisto: legato all'email del cliente; crea l'account membro e aggancia i pezzi gia ordinati
 *  - codice opera (busta del quadro): crea l'account e una richiesta di ritrovamento da approvare
 * Dopo la risposta ok, il browser invia il link di accesso via email (Supabase magic link).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
  try {
    const { code: rawCode, email: rawEmail, nickname } = body(req);
    const email = String(rawEmail || '').toLowerCase().trim();
    const code = normalizeCode(rawCode);
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Inserisci un indirizzo email valido.' });
    if (!code) return res.status(400).json({ error: 'Il codice non è nel formato giusto (WISI-XXXX-XXXX).' });

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const idents = [`ip:${ip}`, `email:${email}`];
    if (await tooManyAttempts(idents)) {
      return res.status(429).json({ error: 'Troppi tentativi. Riprova tra qualche minuto.' });
    }
    await recordAttempt(idents);

    const { data: codeRow } = await admin.from('wm_codes').select('*').eq('code', code).maybeSingle();
    // Stessa risposta per codice inesistente, usato o revocato: non si deve capire quali esistono.
    const invalid = () => res.status(400).json({ error: 'Codice non valido o già utilizzato.' });
    if (!codeRow || codeRow.status !== 'unused') return invalid();
    if (codeRow.kind === 'purchase' && codeRow.email && codeRow.email !== email) {
      return res.status(400).json({ error: "Questo codice è legato a un altro indirizzo email: usa quello dell'ordine." });
    }

    // Trova o crea l'utente di autenticazione.
    let userId = await userIdByEmail(email);
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: false });
      if (error) throw error;
      userId = data.user.id;
    }

    let profile = await getProfile(userId);

    if (codeRow.kind === 'purchase') {
      const burned = await burnCode(codeRow.id, userId);
      if (!burned) return invalid();
      if (!profile) {
        const nick = await uniqueNickname(nickname || email.split('@')[0]);
        const { data, error } = await admin.from('wm_profiles').insert({ id: userId, nickname: nick }).select().single();
        if (error) throw error;
        profile = data;
      }
      // Aggancia i pezzi ordinati prima di avere l'account.
      const { data: linked } = await admin
        .from('wm_ownerships')
        .update({ user_id: userId })
        .ilike('email', email)
        .is('user_id', null)
        .select('id');
      if ((linked || []).length) await logActivity(userId, 'purchase', codeRow.order_key);
      await recomputeBadges(userId);
      return res.status(200).json({ ok: true, kind: 'purchase' });
    }

    // Codice busta di un quadro
    if (!profile) {
      const nick = await uniqueNickname(nickname || email.split('@')[0]);
      const { data, error } = await admin.from('wm_profiles').insert({ id: userId, nickname: nick }).select().single();
      if (error) throw error;
      profile = data;
    }
    try {
      await claimArtworkCode(userId, profile.nickname, codeRow);
    } catch (e) {
      if (e.status === 409) return invalid();
      throw e;
    }
    await recomputeBadges(userId);
    return res.status(200).json({ ok: true, kind: 'artwork' });
  } catch (e) {
    console.error('[redeem]', e);
    return res.status(500).json({ error: 'Qualcosa è andato storto. Riprova tra poco.' });
  }
}
