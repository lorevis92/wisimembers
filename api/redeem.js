import { admin, body, authUser, userIdByEmail, getProfile, logActivity } from './_lib/supabase.js';
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
 *
 * L'account nasce qui, con la password scelta nel form e l'email gia confermata: dopo la risposta ok
 * il browser fa il login con email e password. Risposta: { ok, kind, existing }.
 * L'account Supabase e condiviso con i giochi: se l'email esiste gia (existing: true) la password
 * NON viene mai toccata, si crea solo il profilo membro e l'utente entra con la password di sempre.
 * Chi e gia loggato (Bearer) ma senza profilo riscatta il codice per il proprio account, senza password.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
  try {
    const { code: rawCode, email: rawEmail, nickname, password: rawPassword } = body(req);
    const logged = await authUser(req);
    const email = String(logged?.email || rawEmail || '').toLowerCase().trim();
    const password = typeof rawPassword === 'string' ? rawPassword : '';
    const code = normalizeCode(rawCode);
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Inserisci un indirizzo email valido.' });
    if (!code) return res.status(400).json({ error: 'Il codice non è nel formato giusto (WISI-XXXX-XXXX).' });
    if (!logged && password.length < 8) return res.status(400).json({ error: 'La password deve avere almeno 8 caratteri.' });
    if (!logged && password.length > 72) return res.status(400).json({ error: 'La password è troppo lunga (massimo 72 caratteri).' });

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

    // Trova o crea l'utente di autenticazione. Un utente che esiste gia non viene mai modificato.
    let userId = logged?.id || (await userIdByEmail(email));
    let created = false;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) {
        if (error.code === 'weak_password') {
          return res.status(400).json({ error: 'Questa password è troppo debole: scegline una più lunga o meno comune.' });
        }
        // Email registrata nel frattempo (o non vista dalla ricerca): si prosegue come utente esistente.
        userId = await userIdByEmail(email);
        if (!userId) throw error;
      } else {
        userId = data.user.id;
        created = true;
      }
    }
    const existing = !created;
    // Se il codice viene bruciato da un'altra richiesta nel frattempo, l'account appena creato non deve restare.
    const invalidUndo = async () => {
      if (created) await admin.auth.admin.deleteUser(userId);
      return invalid();
    };

    let profile = await getProfile(userId);

    if (codeRow.kind === 'purchase') {
      const burned = await burnCode(codeRow.id, userId);
      if (!burned) return invalidUndo();
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
      return res.status(200).json({ ok: true, kind: 'purchase', existing });
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
      if (e.status === 409) return invalidUndo();
      throw e;
    }
    await recomputeBadges(userId);
    return res.status(200).json({ ok: true, kind: 'artwork', existing });
  } catch (e) {
    console.error('[redeem]', e);
    return res.status(500).json({ error: 'Qualcosa è andato storto. Riprova tra poco.' });
  }
}
