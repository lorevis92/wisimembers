import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Loading, run, useLoad } from '../components/ui.jsx';

export default function Found({ channel, onChanged }) {
  const [box, reload] = useLoad(() => api.myFoundRequest().then((r) => ({ r })), []);
  const req = box ? box.r : null;
  const [code, setCode] = useState('');
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function claim(e) {
    e.preventDefault();
    setBusy(true);
    await run(() => api.claimFoundCode(code.trim()), 'Codice accettato. Ora carica la foto.');
    setBusy(false);
    setCode('');
    reload();
  }
  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    const ok = await run(() => api.uploadFoundPhoto(req.id, file, note), 'Foto inviata. Lo Studio la guarda a breve.');
    setBusy(false);
    if (ok) reload();
  }

  const waiting = req && req.status === 'pending';
  return (
    <div className="body">
      {channel.topic && <p className="lead">{channel.topic}</p>}
      {waiting && !req.photo_path && (
        <form className="xfer pending" onSubmit={upload}>
          <b>Manca ancora la foto</b>
          <p className="hint">Fotografa il quadro dove l'hai trovato (o a casa tua, con la busta accanto).</p>
          <div className="field"><input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></div>
          <div className="field"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dove e quando l'hai trovato (facoltativo)" /></div>
          <button className="btn" disabled={busy}>{busy ? 'Invio…' : 'Invia la foto'}</button>
        </form>
      )}
      {waiting && req.photo_path && (
        <div className="xfer pending"><b>In attesa di verifica</b><p className="hint">Lo Studio ha ricevuto la tua foto. Quando il ritrovamento è approvato il quadro entra nel Registro a tuo nome e si apre il Circolo dei Ritrovatori.</p></div>
      )}
      {req && req.status === 'approved' && (
        <div className="xfer"><b>Ritrovamento approvato</b><p className="hint">Sei un Ritrovatore. Il Circolo è aperto: lo trovi nella colonna a sinistra.</p></div>
      )}
      {box && (!req || req.status === 'rejected' || req.status === 'approved') && (
        <div className="xfer">
          <b>{req && req.status === 'approved' ? 'Hai trovato un altro quadro?' : 'Hai raccolto un Whiskey?'}</b>
          <p className="hint">Dentro la busta c'è un codice. Scrivilo qui per iniziare.</p>
          <form onSubmit={claim} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WISI-XXXX-XXXX" required style={{ flex: '1 1 160px', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 3, font: 'inherit' }} />
            <button className="btn" disabled={busy}>Inizia</button>
          </form>
          {req && req.status === 'rejected' && <p className="msgerr">La richiesta precedente non è stata approvata.</p>}
        </div>
      )}
      {!box && <Loading />}
    </div>
  );
}
