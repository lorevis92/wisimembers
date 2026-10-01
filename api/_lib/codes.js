import { randomInt } from 'node:crypto';
import { admin } from './supabase.js';

// Niente 0/O/1/I per evitare errori di lettura. 32 simboli, 8 posizioni: ~1.1e12 combinazioni.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function chunk(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export function newCode() {
  return `WISI-${chunk(4)}-${chunk(4)}`;
}

export function normalizeCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 12 || !c.startsWith('WISI')) return null;
  return `WISI-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

/** Crea un codice monouso. kind: 'purchase' (legato a un'email) oppure 'artwork' (legato a un'opera). */
export async function createCode({ kind, email = null, pieceId = null, orderKey = null }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { data, error } = await admin
      .from('wm_codes')
      .insert({ code, kind, email: email ? email.toLowerCase() : null, piece_id: pieceId, order_key: orderKey })
      .select()
      .single();
    if (!error) return data;
    if (error.code !== '23505') throw error; // 23505 = codice gia esistente, riprova
  }
  throw new Error('Impossibile generare un codice univoco.');
}

/** Limite ai tentativi: 8 ogni 15 minuti per IP e per email. */
export async function tooManyAttempts(idents) {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  for (const ident of idents) {
    const { count } = await admin
      .from('wm_redeem_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ident', ident)
      .gte('created_at', since);
    if ((count || 0) >= 8) return true;
  }
  return false;
}

export async function recordAttempt(idents) {
  await admin.from('wm_redeem_attempts').insert(idents.map((ident) => ({ ident })));
}

/** Brucia il codice in modo atomico: ritorna la riga solo se era ancora 'unused'. */
export async function burnCode(codeId, userId) {
  const { data } = await admin
    .from('wm_codes')
    .update({ status: 'redeemed', redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq('id', codeId)
    .eq('status', 'unused')
    .select()
    .maybeSingle();
  return data || null;
}
