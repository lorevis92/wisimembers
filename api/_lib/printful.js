// Unico punto che conosce il formato dei webhook Printful.
// Se al primo ordine di prova i nomi dei campi sono diversi, si corregge SOLO qui:
// il payload completo di ogni evento ricevuto e salvato nella tabella wm_webhook_log.

export function normalize(body) {
  const type = String(body?.type || body?.event || '');
  const d = body?.data || {};
  const order = d.order || d || {};
  const shipment =
    d.shipment || (Array.isArray(d.shipments) ? d.shipments[d.shipments.length - 1] : null) || null;

  const orderId = String(order.id ?? order.order_id ?? d.order_id ?? '');
  const email = String(order.recipient?.email || order.customer?.email || order.email || '')
    .toLowerCase()
    .trim();

  const rawItems = order.items || order.order_items || d.items || [];
  const items = rawItems.map((it) => ({
    name: String(it.name || it.product?.name || ''),
    sku: String(it.sku || it.external_variant_id || it.variant?.sku || ''),
    externalId: String(it.external_id || it.external_product_id || ''),
    quantity: Math.max(1, Number(it.quantity || 1)),
  }));

  let ship = null;
  if (shipment) {
    const est = shipment.estimated_delivery;
    ship = {
      id: String(shipment.id || shipment.tracking_number || ''),
      trackingUrl: String(shipment.tracking_url || ''),
      trackingNumber: String(shipment.tracking_number || ''),
      carrier: String(shipment.carrier || shipment.service || ''),
      eta:
        (est && typeof est === 'object' ? est.to || est.end || est.date || '' : est) ||
        shipment.delivery_date ||
        '',
    };
  }

  return { type, orderId, email, items, ship };
}

/** Collega gli articoli Printful ai prodotti del catalogo tramite le parole chiave (match_keys). */
export function matchItems(items, products) {
  const matched = [];
  const unmatched = [];
  items.forEach((it, lineIdx) => {
    const hay = `${it.sku} ${it.externalId} ${it.name}`.toLowerCase();
    const product = products.find((p) => (p.match_keys || []).some((k) => k && hay.includes(String(k).toLowerCase())));
    if (product) matched.push({ lineIdx, product, quantity: it.quantity });
    else unmatched.push(it);
  });
  return { matched, unmatched };
}
