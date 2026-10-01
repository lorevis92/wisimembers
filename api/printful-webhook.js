import { admin, body } from './_lib/supabase.js';
import { normalize, matchItems } from './_lib/printful.js';
import { processOrder, cancelOrder } from './_lib/orders.js';
import { sendOnce, notifyAdmin } from './_lib/email.js';
import { T } from './_lib/templates.js';
import { SITE_URL } from './_lib/supabase.js';

/**
 * Webhook di Printful. URL da registrare:
 *   https://TUO-DOMINIO/api/printful-webhook?token=PRINTFUL_WEBHOOK_SECRET
 *
 * order_created   -> pezzi registrati + codice invito (o avviso se e gia membro) per email
 * package_shipped -> email con tracciamento, pezzo "in viaggio" nel profilo
 * order_canceled  -> pezzi tolti, codice non usato revocato
 * order_failed    -> avviso a Lorenzo
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
  const secret = process.env.PRINTFUL_WEBHOOK_SECRET;
  if (!secret || req.query?.token !== secret) return res.status(401).json({ error: 'Non autorizzato' });

  let logId = null;
  try {
    const payload = body(req);
    const ev = normalize(payload);
    logId = `${ev.type}:${ev.orderId}:${ev.ship?.id || ''}`;

    const { error: dup } = await admin
      .from('wm_webhook_log')
      .insert({ id: logId, type: ev.type, payload });
    if (dup) {
      if (dup.code === '23505') return res.status(200).json({ ok: true, duplicate: true });
      throw dup;
    }
    if (!ev.orderId) return res.status(200).json({ ok: true, ignored: 'no-order-id' });
    const orderKey = `printful:${ev.orderId}`;

    if (ev.type === 'order_created') {
      const { data: products } = await admin.from('wm_products').select('id,title,match_keys').eq('active', true);
      const { matched, unmatched } = matchItems(ev.items, products || []);
      if (unmatched.length) {
        await admin.from('wm_unmatched_items').insert(
          unmatched.map((u) => ({ order_key: orderKey, name: u.name, sku: u.sku, email: ev.email })),
        );
        await notifyAdmin(`unmatched:${orderKey}`, 'Ordine con articoli non riconosciuti', [
          `Ordine Printful ${ev.orderId} (${ev.email || 'email mancante'}).`,
          ...unmatched.map((u) => `Non riconosciuto: ${u.name} ${u.sku ? '(' + u.sku + ')' : ''}`),
          'Aggiungi la parola chiave al prodotto nello Studio, poi registra l\'acquisto a mano.',
        ]);
      }
      if (!ev.email) {
        await notifyAdmin(`noemail:${orderKey}`, 'Ordine senza email del cliente', [
          `Ordine Printful ${ev.orderId} senza email: serve registrarlo a mano dallo Studio.`,
        ]);
        return res.status(200).json({ ok: true, warning: 'no-email' });
      }
      if (matched.length) await processOrder({ orderKey, email: ev.email, matched });
    } else if (ev.type === 'package_shipped') {
      const { data: rows } = await admin
        .from('wm_ownerships')
        .update({
          ship_status: 'shipped',
          tracking_url: ev.ship?.trackingUrl || null,
          eta: ev.ship?.eta ? String(ev.ship.eta) : null,
        })
        .eq('order_key', orderKey)
        .select('email, wm_products(title)');
      const email = rows?.[0]?.email || ev.email;
      const titles = (rows || []).map((r) => r.wm_products?.title).filter(Boolean);
      if (email && titles.length) {
        await sendOnce(
          `shipped:${orderKey}:${ev.ship?.id || ''}`,
          email,
          T.shipped({ titles, trackingUrl: ev.ship?.trackingUrl, eta: ev.ship?.eta, siteUrl: SITE_URL() }),
        );
      }
    } else if (ev.type === 'order_canceled') {
      await cancelOrder({ orderKey, email: ev.email });
    } else if (ev.type === 'order_failed') {
      await notifyAdmin(`failed:${orderKey}`, 'Ordine Printful fallito', [`Ordine ${ev.orderId} (${ev.email}) segnato come fallito da Printful.`]);
    }
    // Gli altri eventi restano solo nel log.
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[printful-webhook]', e);
    // 500 => Printful ritenta piu tardi. L'idempotenza evita doppioni.
    if (logId) await admin.from('wm_webhook_log').delete().eq('id', logId).then(() => {}, () => {});
    return res.status(500).json({ error: 'Errore interno' });
  }
}
