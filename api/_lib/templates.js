// Email nello stile WISI: sfondo bianco, rosso #E8352A, titoli serif. Stili inline per i client di posta.
const RED = '#E8352A';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function layout({ title, intro, blocks = '', cta }) {
  return `<!doctype html><html><body style="margin:0;background:#F8F8F8;font-family:Helvetica,Arial,sans-serif;color:#111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F8F8;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #E8E8E8;border-radius:6px;">
<tr><td style="padding:20px 24px;border-bottom:1px solid #E8E8E8;font-weight:800;letter-spacing:.04em;text-transform:uppercase;font-size:16px;">WISI <span style="color:${RED};font-size:12px;letter-spacing:.1em;">Members</span></td></tr>
<tr><td style="padding:28px 24px;">
<h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px;line-height:1.25;">${esc(title)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#333;">${intro}</p>
${blocks}
${cta ? `<p style="margin:24px 0 0;"><a href="${esc(cta.url)}" style="display:inline-block;background:${RED};color:#fff;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;padding:12px 18px;border-radius:3px;">${esc(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #E8E8E8;background:#F8F8F8;font-size:11px;color:#666;">Part of the WiSiVERSE ecosystem · wisiverse.com</td></tr>
</table></td></tr></table></body></html>`;
}

const list = (items) =>
  `<ul style="margin:0 0 8px;padding-left:18px;font-size:15px;line-height:1.6;">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;

const codeBox = (code) =>
  `<p style="margin:18px 0;padding:14px 16px;background:#F8F8F8;border:1px dashed #E8E8E8;border-radius:6px;text-align:center;font-family:'Courier New',monospace;font-size:22px;letter-spacing:.12em;font-weight:700;">${esc(code)}</p>`;

export const T = {
  invite: ({ code, siteUrl }) => ({
    subject: 'Il tuo invito al WiSiVERSE',
    html: layout({
      title: 'Sei dentro',
      intro: 'Hai un invito per entrare nella community WiSiVERSE. Questo è il tuo codice personale:',
      blocks: codeBox(code) +
        '<p style="margin:0;font-size:13px;color:#666;">Il codice funziona una sola volta, con questo indirizzo email.</p>',
      cta: { label: 'Entra con il codice', url: `${siteUrl}/?code=${encodeURIComponent(code)}` },
    }),
  }),

  welcomeOrder: ({ code, titles, siteUrl }) => ({
    subject: 'Il tuo ordine è partito: ecco il codice per entrare nel WiSiVERSE',
    html: layout({
      title: 'Benvenuto nel WiSiVERSE',
      intro: 'Grazie per il tuo ordine. Il pezzo è in preparazione e nel frattempo puoi già entrare nella community con questo codice personale.',
      blocks: list(titles) + codeBox(code) +
        '<p style="margin:0;font-size:13px;color:#666;">Il codice funziona una sola volta, con questo indirizzo email. Al primo ingresso scegli una password: le volte dopo entri con email e password.</p>',
      cta: { label: 'Entra con il codice', url: `${siteUrl}/?code=${encodeURIComponent(code)}` },
    }),
  }),

  pieceAdded: ({ titles, siteUrl }) => ({
    subject: 'Nuovo pezzo nella tua collezione WiSiVERSE',
    html: layout({
      title: 'Un nuovo pezzo per te',
      intro: 'Abbiamo aggiunto alla tua collezione:',
      blocks: list(titles),
      cta: { label: 'Apri il tuo profilo', url: siteUrl },
    }),
  }),

  shipped: ({ titles, trackingUrl, eta, siteUrl }) => ({
    subject: 'Il tuo pezzo WiSiVERSE è in viaggio',
    html: layout({
      title: 'È partito!',
      intro: 'Il tuo ordine è stato spedito.' + (eta ? ` Consegna stimata: <strong>${esc(eta)}</strong>.` : ''),
      blocks: list(titles),
      cta: trackingUrl ? { label: 'Segui la spedizione', url: trackingUrl } : { label: 'Apri WISI Members', url: siteUrl },
    }),
  }),

  canceled: ({ titles }) => ({
    subject: 'Il tuo ordine WiSiVERSE è stato annullato',
    html: layout({
      title: 'Ordine annullato',
      intro: 'Il seguente ordine è stato annullato e i relativi pezzi sono stati tolti dalla tua collezione. Se non te lo aspettavi, rispondi a questa email.',
      blocks: list(titles),
    }),
  }),

  foundApproved: ({ pieceTitle, siteUrl }) => ({
    subject: 'Ritrovamento approvato: benvenuto nel Circolo',
    html: layout({
      title: 'Il sigillo è rotto',
      intro: `Hai ritrovato <strong>${esc(pieceTitle || 'un Whiskey')}</strong>. Il tuo ritrovamento è stato approvato e il Circolo dei Ritrovatori è aperto per te.`,
      cta: { label: 'Entra nel Circolo', url: siteUrl },
    }),
  }),

  foundRejected: ({ reason }) => ({
    subject: 'Ritrovamento non approvato',
    html: layout({
      title: 'Ritrovamento non approvato',
      intro: `Non siamo riusciti ad approvare il tuo ritrovamento${reason ? `: ${esc(reason)}` : '.'} Rispondi a questa email se pensi sia un errore.`,
    }),
  }),

  transferApproved: ({ pieceTitle, role, other, siteUrl }) => ({
    subject: role === 'from' ? `Passaggio approvato: ${pieceTitle}` : `Hai ricevuto ${pieceTitle}`,
    html: layout({
      title: role === 'from' ? 'Passaggio completato' : 'Un nuovo quadro per te',
      intro:
        role === 'from'
          ? `${esc(pieceTitle)} è passato a ${esc(other)}. La storia dell'opera è stata aggiornata.`
          : `${esc(pieceTitle)} ora è tuo, passato da ${esc(other)}. Lo trovi nel tuo profilo e nel Registro.`,
      cta: { label: 'Apri il Registro', url: siteUrl },
    }),
  }),

  transferRejected: ({ pieceTitle }) => ({
    subject: `Passaggio non approvato: ${pieceTitle}`,
    html: layout({ title: 'Passaggio non approvato', intro: `Il passaggio di ${esc(pieceTitle)} non è stato approvato. L'opera resta a te.` }),
  }),

  eventWon: ({ eventTitle, prize, siteUrl }) => ({
    subject: `Hai vinto: ${eventTitle}`,
    html: layout({
      title: 'Hai vinto!',
      intro: `Primo posto in <strong>${esc(eventTitle)}</strong>.` + (prize ? ` Premio: ${esc(prize)}. Ti scriviamo presto per organizzare la consegna.` : ''),
      cta: { label: 'Guarda la classifica', url: siteUrl },
    }),
  }),

  adminNotice: ({ subject, lines, siteUrl }) => ({
    subject: `[WISI Members] ${subject}`,
    html: layout({
      title: subject,
      intro: lines.map(esc).join('<br>'),
      cta: { label: 'Apri lo Studio', url: siteUrl },
    }),
  }),
};
