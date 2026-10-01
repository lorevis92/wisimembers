import { admin } from './_lib/supabase.js';
import { closeEvent } from './_lib/events.js';

/**
 * Chiude le gare scadute. Vercel la chiama da sola (vedi vercel.json) con
 * Authorization: Bearer <CRON_SECRET>. Si puo chiamare anche da un cron esterno gratuito.
 * Sul piano Hobby di Vercel i cron girano al massimo una volta al giorno.
 */
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }
  try {
    const { data: due } = await admin
      .from('wm_events')
      .select('id, title')
      .is('closed_at', null)
      .lt('ends_at', new Date().toISOString());
    const out = [];
    for (const ev of due || []) {
      try {
        out.push({ id: ev.id, title: ev.title, ...(await closeEvent(ev.id)) });
      } catch (e) {
        console.error('[cron] gara', ev.id, e);
        out.push({ id: ev.id, title: ev.title, error: e.message });
      }
    }
    return res.status(200).json({ ok: true, processed: out });
  } catch (e) {
    console.error('[cron]', e);
    return res.status(500).json({ error: 'Errore interno' });
  }
}
