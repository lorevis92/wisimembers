// Registra il webhook su Printful. Esegui una volta (e di nuovo quando Printful avvisa che scade):
//   PRINTFUL_API_TOKEN=... PRINTFUL_WEBHOOK_SECRET=... SITE_URL=https://members.wisiverse.com node scripts/printful-webhook.mjs
//
// ATTENZIONE: l'endpoint qui sotto (v1 "POST /webhooks") va verificato sulla documentazione ufficiale
// https://developers.printful.com/docs/ prima del primo uso: i nomi dei campi possono essere cambiati
// con le API v2. In alternativa registra il webhook dal portale sviluppatori di Printful usando
// l'URL che questo script stampa, e seleziona gli stessi eventi.

const token = process.env.PRINTFUL_API_TOKEN;
const secret = process.env.PRINTFUL_WEBHOOK_SECRET;
const site = (process.env.SITE_URL || '').replace(/\/$/, '');
if (!token || !secret || !site) {
  console.error('Servono PRINTFUL_API_TOKEN, PRINTFUL_WEBHOOK_SECRET e SITE_URL.');
  process.exit(1);
}

const url = `${site}/api/printful-webhook?token=${encodeURIComponent(secret)}`;
const types = ['order_created', 'order_updated', 'order_failed', 'order_canceled', 'package_shipped'];
console.log('URL del webhook:', url);
console.log('Eventi:', types.join(', '));

const r = await fetch('https://api.printful.com/webhooks', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ url, types }),
});
console.log('Risposta Printful:', r.status, await r.text());
