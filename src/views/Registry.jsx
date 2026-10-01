import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Art, Loading, run, useLoad } from '../components/ui.jsx';
import { PieceForm } from '../components/forms.jsx';
import { STATUS_LABEL, STATUS_TAG, fmtDate } from '../lib/util.js';

const KIND = { left: 'left', found: 'found', passed: 'passed', upcoming: 'soon' };
const KIND_LABEL = { left: 'Lasciato', found: 'Ritrovato', passed: 'Passato di mano', upcoming: 'In arrivo' };

function Detail({ piece, me, onBack, reload }) {
  const [tl] = useLoad(() => api.getTimeline(piece.id), [piece.id]);
  const [transfers, reloadTr] = useLoad(() => api.myTransfers(), []);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [edit, setEdit] = useState(false);
  const pending = (transfers || []).find((t) => t.piece_id === piece.id);

  async function request(e) {
    e.preventDefault();
    if (await run(() => api.requestTransfer({ pieceId: piece.id, toNickname: to.trim(), note }), 'Richiesta inviata allo Studio.')) {
      setTo('');
      setNote('');
      reloadTr();
    }
  }
  if (edit)
    return (
      <div className="body">
        <PieceForm piece={piece} onCancel={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); onBack(); }} />
      </div>
    );
  return (
    <div className="body">
      <button className="btn ghost mini" onClick={onBack}>← Tutte le opere</button>
      <div className="pd" style={{ marginTop: 14 }}>
        <Art src={piece.image_url} seed={piece.id} mine={piece.is_mine} />
        <div>
          <h2>{piece.title}</h2>
          {piece.description && <p className="lead">{piece.description}</p>}
          <dl className="kv">
            <dt>Stato</dt><dd>{STATUS_LABEL[piece.status]}</dd>
            {piece.city && (<><dt>Città</dt><dd>{piece.city}</dd></>)}
            {piece.status === 'found' && (<><dt>Oggi vive da</dt><dd>{piece.owner_label || 'Un membro'}</dd></>)}
          </dl>
          {me.is_admin && <button className="btn ghost mini" onClick={() => setEdit(true)}>Modifica opera</button>}
          <div className="sh">Storia</div>
          {!tl ? <Loading /> : (
            <ul className="tl">
              {tl.map((t) => (
                <li key={t.id} className={KIND[t.kind]}>
                  <div className="d">{KIND_LABEL[t.kind]} · {fmtDate(t.happened_at)}</div>
                  <div className="x">
                    {t.kind === 'passed' && t.from_label && t.to_label ? `Da ${t.from_label} a ${t.to_label}. ` : t.to_label && t.kind === 'found' ? `${t.to_label}. ` : ''}
                    {t.text}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {piece.is_mine && (
            <div className="xfer pending" style={!pending ? { borderColor: 'var(--line)' } : null}>
              <b>Passa quest'opera</b>
              {pending ? (
                <p className="hint">
                  Richiesta in attesa di approvazione dello Studio: passaggio a {pending.to_profile?.nickname}.{' '}
                  <button className="btn ghost mini" onClick={async () => { await run(() => api.cancelTransfer(pending.id)); reloadTr(); }}>Annulla richiesta</button>
                </p>
              ) : (
                <>
                  <p className="hint">Scrivi il nickname di chi la riceverà. Lo Studio approva e il Registro si aggiorna.</p>
                  <form onSubmit={request}>
                    <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Nickname" required />
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (facoltativa)" />
                    <button className="btn">Richiedi</button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Registry({ channel, me, initial }) {
  const [pieces, reload] = useLoad(() => api.listPieces(), []);
  const [open, setOpen] = useState(initial || null);
  const [adding, setAdding] = useState(false);
  if (!pieces) return <div className="body"><Loading /></div>;
  const sel = pieces.find((p) => p.id === open);
  if (sel) return <Detail piece={sel} me={me} onBack={() => setOpen(null)} reload={reload} />;
  return (
    <div className="body">
      {channel.topic && <p className="lead">{channel.topic}</p>}
      {me.is_admin && !adding && <button className="btn mini" onClick={() => setAdding(true)}>+ Nuova opera</button>}
      {adding && <PieceForm onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
      <div className="grid">
        {pieces.map((p) => (
          <button key={p.id} className="plate" onClick={() => setOpen(p.id)}>
            <Art src={p.image_url} seed={p.id} mine={p.is_mine} tag={<span className={`tag ${STATUS_TAG[p.status]}`}>{STATUS_LABEL[p.status]}</span>} />
            <div className="inf">
              <div className="ti">{p.title}</div>
              <div className="ci">{p.city || '—'}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
