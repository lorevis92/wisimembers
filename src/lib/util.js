export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

export function relTime(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'adesso';
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} gg fa`;
  return fmtDate(d);
}

const PALETTE = ['#9ad0f5', '#e3b64a', '#7cc6a4', '#c59cf0', '#f09c8a', '#f0a67c', '#a9c4ff'];
export const colorFor = (s) => {
  let h = 0;
  for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
};
export const initial = (n) => (n || '?').trim().slice(0, 1).toUpperCase();

export const STATUS_LABEL = { upcoming: 'in arrivo', left: 'lasciato', found: 'ritrovato' };
export const STATUS_TAG = { upcoming: 's', left: 'l', found: 'f' };

/** Il valore di una gara: tempo in ms per WisiKart, altrimenti numero. */
export function fmtValue(game, v) {
  if (v == null) return '';
  if (game === 'wisikart') {
    const ms = Number(v);
    const m = Math.floor(ms / 60000);
    const s = ((ms % 60000) / 1000).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  }
  return Number(v).toLocaleString('it-IT');
}

/** Riduce una foto (max lato 1600px, JPEG) prima del caricamento: risparmia spazio e tempo. */
export async function shrinkImage(file, max = 1600) {
  try {
    if (!file || !file.type.startsWith('image/')) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob || file;
  } catch {
    return file;
  }
}

const ART_BG = ['#2d4f86', '#7a4a2b', '#5a2f4a', '#2f5a45', '#3a4a6b', '#5b2a2a'];
export const artBg = (s) => {
  let h = 0;
  for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ART_BG[h % ART_BG.length];
};
