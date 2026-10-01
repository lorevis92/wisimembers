import { createClient } from '@supabase/supabase-js';

// Client con chiave di servizio: bypassa le regole RLS. Si usa SOLO qui, lato server.
export const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const SITE_URL = () => (process.env.SITE_URL || 'https://members.wisiverse.com').replace(/\/$/, '');

export function body(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      return {};
    }
  }
  return req.body || {};
}

/** Utente Supabase dal token Bearer, oppure null. */
export async function authUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export async function getProfile(userId) {
  const { data } = await admin.from('wm_profiles').select('*').eq('id', userId).maybeSingle();
  return data || null;
}

/** Richiede un membro loggato. Risponde da solo con 401/403 e ritorna null se non va bene. */
export async function requireMember(req, res) {
  const user = await authUser(req);
  if (!user) {
    res.status(401).json({ error: 'Devi accedere.' });
    return null;
  }
  const profile = await getProfile(user.id);
  if (!profile) {
    res.status(403).json({ error: 'Non sei ancora un membro.' });
    return null;
  }
  return { user, profile };
}

export async function requireAdmin(req, res) {
  const ctx = await requireMember(req, res);
  if (!ctx) return null;
  if (!ctx.profile.is_admin) {
    res.status(403).json({ error: 'Solo per amministratori.' });
    return null;
  }
  return ctx;
}

export async function userIdByEmail(email) {
  const { data } = await admin.rpc('wm_user_id_by_email', { p_email: email });
  return data || null;
}

export async function logActivity(userId, kind, ref = null) {
  await admin.from('wm_activity').insert({ user_id: userId, kind, ref });
}
