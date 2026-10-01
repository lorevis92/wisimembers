import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Loading, run, useLoad, toast } from '../components/ui.jsx';
import { PieceForm, ProductForm } from '../components/forms.jsx';
import { STATUS_LABEL, fmtDateTime } from '../lib/util.js';

const TABS = [['todo', 'Da approvare'], ['pieces', 'Opere'], ['products', 'Prodotti'], ['sales', 'Acquisti'], ['events', 'Gare']];

function Todo() {
  const [o, reload] = useLoad(() => api.adminOverview(), []);
  if (!o) return <Loading />;
  const act = async (a, p, m) => { if (await run(() => api.adminAction(a, p), m)) reload(); };
  const empty = !o.pendingFound.length && !o.pendingTransfers.length && !o.unmatched.length && !o.toClose.length;
  return (
    <>
      {empty && <p className="lead">Niente da fare: è tutto in ordine.</p>}
      {o.pendingFound.length > 0 && <div className="sub-h">Ritrovamenti</div>}
      <div className="adm">
        {o.pendingFound.map((f) => (
          <div className="row" key={f.id}>
            <span><b>{f.nickname}</b> · {f.pieceTitle || 'quadro non indicato'}<small>{f.note}</small>
              {f.photoUrl ? <a href={f.photoUrl} target="_blank" rel="noreferrer"><img className="photo" src={f.photoUrl} alt="" /></a> : <small>Foto non ancora caricata</small>}
            </span>
            <span className="acts">
              <button className="btn mini" onClick={() => act('approve_found', { requestId: f.id }, 'Approvato.')}>Approva</button>
              <button className="btn ghost mini" onClick={() => act('reject_found', { requestId: f.id, reason: window.prompt('Motivo (facoltativo)') || '' }, 'Rifiutato.')}>Rifiuta</button>
            </span>
          </div>
        ))}
      </div>
      {o.pendingTransfers.length > 0 && <div className="sub-h">Passaggi di mano</div>}
      <div className="adm">
        {o.pendingTransfers.map((t) => (
          <div className="row" key={t.id}>
            <span><b>{t.pieceTitle}</b>: {t.from} → {t.to}<small>{t.note}</small></span>
            <span className="acts">
              <button className="btn mini" onClick={() => act('approve_transfer', { id: t.id }, 'Passaggio approvato.')}>Approva</button>
              <button className="btn ghost mini" onClick={() => act('reject_transfer', { id: t.id, reason: window.prompt('Motivo (facoltativo)') || '' }, 'Rifiutato.')}>Rifiuta</button>
            </span>
          </div>
        ))}
      </div>
      {o.unmatched.length > 0 && <div className="sub-h">Articoli ordinati non riconosciuti</div>}
      <div className="adm">
        {o.unmatched.map((u) => (
          <div className="row warn" key={u.id}><span><b>{u.name}</b><small>{u.sku} · {u.email}</small></span><span className="hint">Aggiungi la parola chiave al prodotto giusto, oppure creane uno.</span></div>
        ))}
      </div>
      {o.toClose.length > 0 && <div className="sub-h">Gare da chiudere</div>}
      <div className="adm">
        {o.toClose.map((e) => (
          <div className="row" key={e.id}><span><b>{e.title}</b><small>{e.game} · finita {fmtDateTime(e.ends_at)}</small></span>
            <button className="btn mini" onClick={() => act('close_event', { eventId: e.id }, 'Gara chiusa.')}>Chiudi e assegna</button></div>
        ))}
      </div>
    </>
  );
}

function Pieces() {
  const [pieces, reload] = useLoad(() => api.listPieces(), []);
  const [edit, setEdit] = useState(null); // null | 'new' | piece
  const [pid, setPid] = useState('');
  const [count, setCount] = useState(5);
  const [codes, setCodes] = useState(null);
  if (!pieces) return <Loading />;
  async function gen() {
    const r = await run(() => api.adminAction('artwork_codes', { pieceId: pid, count }));
    if (r && r.codes) setCodes(r);
  }
  return (
    <>
      {edit ? (
        <PieceForm piece={edit === 'new' ? null : edit} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
      ) : (
        <button className="btn mini" onClick={() => setEdit('new')}>+ Nuova opera</button>
      )}
      <div className="adm">
        {pieces.map((p) => (
          <div className="row" key={p.id}>
            <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {p.image_url && <img src={p.image_url} alt="" style={{ width: 40, height: 50, objectFit: 'cover', borderRadius: 3 }} />}
              <span><b>{p.title}</b><small>{STATUS_LABEL[p.status]} · {p.city || '—'}</small></span>
            </span>
            <button className="btn ghost mini" onClick={() => setEdit(p)}>Modifica</button>
          </div>
        ))}
      </div>
      <div className="sub-h">Codici per le buste dei quadri</div>
      <p className="hint">Genera i codici da stampare e infilare nella busta di un quadro: chi lo raccoglie li usa in “Ho trovato un Whiskey”.</p>
      <div className="row2">
        <div className="field"><label>Opera</label><select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">Scegli…</option>{pieces.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
        <div className="field"><label>Quanti</label><input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} /></div>
      </div>
      <button className="btn" disabled={!pid} onClick={gen}>Genera codici</button>
      {codes && <div className="codes"><b>{codes.pieceTitle}</b><br />{codes.codes.map((c) => <div key={c}>{c}</div>)}</div>}
    </>
  );
}

function Products() {
  const [list, reload] = useLoad(() => api.listProducts(), []);
  const [edit, setEdit] = useState(null);
  if (!list) return <Loading />;
  return (
    <>
      {edit ? (
        <ProductForm product={edit === 'new' ? null : edit} onCancel={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />
      ) : (
        <button className="btn mini" onClick={() => setEdit('new')}>+ Nuovo prodotto</button>
      )}
      <div className="adm">
        {list.map((p) => (
          <div className="row" key={p.id}>
            <span><b>{p.title}{p.active === false ? ' (non attivo)' : ''}</b><small>{p.owners} possessori · parole chiave: {(p.match_keys || []).join(', ') || '—'}</small></span>
            <button className="btn ghost mini" onClick={() => setEdit(p)}>Modifica</button>
          </div>
        ))}
      </div>
    </>
  );
}

function Sales() {
  const [products] = useLoad(() => api.listProducts(), []);
  const [inv, setInv] = useState('');
  const [em, setEm] = useState('');
  const [prod, setProd] = useState('');
  const [qty, setQty] = useState(1);
  const [out, setOut] = useState('');
  if (!products) return <Loading />;
  return (
    <>
      <div className="sub-h" style={{ marginTop: 0 }}>Invita qualcuno a mano</div>
      <p className="hint">Manda un codice di accesso a un'email, senza acquisto.</p>
      <form className="xfer" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => api.adminAction('create_invite', { email: inv }), 'Invito inviato.'); if (r?.code) setOut(`Codice: ${r.code}`); setInv(''); }}>
        <div className="field"><input type="email" value={inv} onChange={(e) => setInv(e.target.value)} placeholder="email@esempio.com" required /></div>
        <button className="btn">Invia invito</button>
      </form>
      <div className="sub-h">Registra un acquisto a mano</div>
      <p className="hint">Per ordini fatti fuori da Printful. Fa quello che fa il webhook: assegna il pezzo, invia il codice e l'email.</p>
      <form className="xfer" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => api.adminAction('register_purchase', { email: em, items: [{ productId: prod, qty }] }), 'Acquisto registrato.'); if (r?.code) setOut(`Codice: ${r.code}`); }}>
        <div className="field"><label>Email dell'acquirente</label><input type="email" value={em} onChange={(e) => setEm(e.target.value)} required /></div>
        <div className="row2">
          <div className="field"><label>Prodotto</label><select value={prod} onChange={(e) => setProd(e.target.value)} required><option value="">Scegli…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          <div className="field"><label>Quantità</label><input type="number" min="1" max="20" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        </div>
        <button className="btn">Registra</button>
      </form>
      {out && <div className="codes">{out}</div>}
    </>
  );
}

function Events() {
  const [list, reload] = useLoad(() => api.listAllEvents(), []);
  const blank = { game: 'wisinvaders', title: '', description: '', prize: '', is_cup: false, starts_at: '', ends_at: '' };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (!list) return <Loading />;
  async function create(e) {
    e.preventDefault();
    if (await run(() => api.createEvent(f), 'Gara creata.')) { setF(blank); reload(); }
  }
  async function close(ev) {
    const manual = window.prompt('Classifica (facoltativo): nickname in ordine, separati da virgola. Lascia vuoto per usare i punteggi del gioco.');
    const order = manual ? manual.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
    if (await run(() => api.adminAction('close_event', { eventId: ev.id, order }), 'Gara chiusa.')) reload();
  }
  return (
    <>
      <form className="xfer" onSubmit={create}>
        <div className="row2">
          <div className="field"><label>Gioco</label><select value={f.game} onChange={set('game')}><option value="wisinvaders">WISINVADERS</option><option value="wisikart">WisiKart</option><option value="circolo">Circolo (incontri)</option></select></div>
          <div className="field"><label>Titolo</label><input value={f.title} onChange={set('title')} required /></div>
        </div>
        <div className="field"><label>Descrizione</label><textarea value={f.description} onChange={set('description')} /></div>
        <div className="row2">
          <div className="field"><label>Inizio</label><input type="datetime-local" value={f.starts_at} onChange={set('starts_at')} required /></div>
          <div className="field"><label>Fine</label><input type="datetime-local" value={f.ends_at} onChange={set('ends_at')} required /></div>
        </div>
        <div className="field"><label>Premio</label><input value={f.prize} onChange={set('prize')} /></div>
        <label className="sw" style={{ marginTop: 0 }}><input type="checkbox" checked={f.is_cup} onChange={(e) => setF({ ...f, is_cup: e.target.checked })} /> È una Coppa</label>
        <div style={{ marginTop: 12 }}><button className="btn">Crea gara</button></div>
      </form>
      <div className="adm">
        {list.map((e) => (
          <div className="row" key={e.id}>
            <span><b>{e.title}</b><small>{e.game} · {fmtDateTime(e.starts_at)} → {fmtDateTime(e.ends_at)}{e.closed_at ? ' · chiusa' : ''}</small></span>
            {!e.closed_at && e.game !== 'circolo' && <button className="btn ghost mini" onClick={() => close(e)}>Chiudi</button>}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Studio() {
  const [tab, setTab] = useState('todo');
  const View = { todo: Todo, pieces: Pieces, products: Products, sales: Sales, events: Events }[tab];
  return (
    <div className="body">
      <div className="tabs2" style={{ marginTop: 0 }}>
        {TABS.map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}
      </div>
      <View />
    </div>
  );
}
