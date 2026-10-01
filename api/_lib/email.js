import { Resend } from 'resend';
import { admin, SITE_URL } from './supabase.js';
import { T } from './templates.js';

let resend = null;
function client() {
  if (!resend && process.env.RESEND_API_KEY) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/**
 * Invia una email una sola volta per "key" (es. "welcome:order-123").
 * Se la stessa key e gia stata inviata, non fa nulla: i riavvii del webhook non creano doppioni.
 */
export async function sendOnce(key, to, tpl) {
  if (!to) return { skipped: 'no-recipient' };
  const { error: logErr } = await admin
    .from('wm_emails_log')
    .insert({ key, to_email: to, subject: tpl.subject });
  if (logErr) {
    if (logErr.code === '23505') return { skipped: 'already-sent' };
    throw logErr;
  }
  const r = client();
  if (!r) {
    console.warn('[email] RESEND_API_KEY mancante, email non inviata:', key);
    return { skipped: 'no-resend-key' };
  }
  const { error } = await r.emails.send({
    from: process.env.EMAIL_FROM || 'WiSiVERSE <noreply@wisiverse.com>',
    to,
    subject: tpl.subject,
    html: tpl.html,
  });
  if (error) {
    // Cosi un nuovo tentativo potra reinviarla.
    await admin.from('wm_emails_log').delete().eq('key', key);
    throw new Error(`Invio email fallito: ${error.message || JSON.stringify(error)}`);
  }
  return { sent: true };
}

/** Avviso a Lorenzo (ADMIN_EMAIL). Non blocca mai il flusso principale. */
export async function notifyAdmin(key, subject, lines) {
  try {
    const to = process.env.ADMIN_EMAIL;
    if (!to) return;
    await sendOnce(`admin:${key}`, to, T.adminNotice({ subject, lines, siteUrl: SITE_URL() }));
  } catch (e) {
    console.error('[notifyAdmin]', e.message);
  }
}
