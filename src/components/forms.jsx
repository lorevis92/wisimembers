import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { run } from './ui.jsx';

const toLocal = (d) => {
  if (!d) return '';
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function ImageField({ current, file, setFile, label = 'Immagine' }) {
  const prev = file ? URL.createObjectURL(file) : current;
  return (
    <div className="field">
      <label>{label}</label>
      {prev && <img className="imgprev" src={prev} alt="" />}
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <span className="hint">Per cambiarla basta scegliere un nuovo file e salvare.</span>
    </div>
  );
}

/** Nuova opera / modifica opera: con caricamento dell'immagine. */
export function PieceForm({ piece, onSaved, onCancel }) {
  const [f, setF] = useState({
    id: piece?.id,
    title: piece?.title || '',
    city: piece?.city || '',
    description: piece?.description || '',
    status: piece?.status || 'upcoming',
    left_at: toLocal(piece?.left_at),
    lost_note: piece?.lost_note || '',
    image_url: piece?.image_url || null,
    prevStatus: piece?.status,
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await run(() => api.savePiece(f, file), 'Opera salvata.');
    setBusy(false);
    if (ok) onSaved();
  }
  return (
    <form className="xfer" onSubmit={save}>
      <div className="field">
        <label>Titolo</label>
        <input value={f.title} onChange={set('title')} required />
      </div>
      <div className="row2">
        <div className="field">
          <label>Città</label>
          <input value={f.city} onChange={set('city')} />
        </div>
        <div className="field">
          <label>Stato</label>
          <select value={f.status} onChange={set('status')}>
            <option value="upcoming">In arrivo</option>
            <option value="left">Lasciato</option>
            <option value="found">Ritrovato</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>Data e ora (partenza o lascito)</label>
        <input type="datetime-local" value={f.left_at} onChange={set('left_at')} />
      </div>
      <div className="field">
        <label>Descrizione</label>
        <textarea value={f.description} onChange={set('description')} />
      </div>
      <div className="field">
        <label>Nota se non si trova più (facoltativa)</label>
        <input value={f.lost_note} onChange={set('lost_note')} />
      </div>
      <ImageField current={f.image_url} file={file} setFile={setFile} />
      <div className="acts">
        <button className="btn" disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Annulla</button>
      </div>
    </form>
  );
}

/** Nuovo prodotto in serie / modifica. */
export function ProductForm({ product, onSaved, onCancel }) {
  const [f, setF] = useState({
    id: product?.id,
    title: product?.title || '',
    description: product?.description || '',
    match_keys: (product?.match_keys || []).join(', '),
    image_url: product?.image_url || null,
    active: product ? product.active !== false : true,
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const ok = await run(() => api.saveProduct(f, file), 'Prodotto salvato.');
    setBusy(false);
    if (ok) onSaved();
  }
  return (
    <form className="xfer" onSubmit={save}>
      <div className="field">
        <label>Nome</label>
        <input value={f.title} onChange={set('title')} required />
      </div>
      <div className="field">
        <label>Descrizione</label>
        <textarea value={f.description} onChange={set('description')} />
      </div>
      <div className="field">
        <label>Parole chiave per riconoscerlo negli ordini Printful</label>
        <input value={f.match_keys} onChange={set('match_keys')} placeholder="monna, tshirt-monna" />
        <span className="hint">Separate da virgola. Se compaiono nel nome o nello SKU dell'articolo ordinato, l'acquisto viene assegnato a questo prodotto.</span>
      </div>
      <ImageField current={f.image_url} file={file} setFile={setFile} />
      <label className="sw">
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Attivo
      </label>
      <div className="acts" style={{ marginTop: 12 }}>
        <button className="btn" disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Annulla</button>
      </div>
    </form>
  );
}
