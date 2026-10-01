import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Logo } from '../components/ui.jsx';

const SHOP = import.meta.env.VITE_SHOP_URL || 'https://www.wisiverse.com';

export default function Login({ session }) {
  const [tab, setTab] = useState(session ? 'code' : 'in');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setOk('');
    try {
      if (tab === 'in') {
        await api.signInEmail(email.trim());
        setOk('Se questa email è già socia, ti abbiamo mandato un link per entrare. Controlla la posta.');
      } else {
        await api.redeem({ code: code.trim(), email: email.trim(), nickname: nick.trim() });
        await api.signInEmail(email.trim());
        setOk('Codice accettato. Ti abbiamo mandato un link per entrare: aprilo da questo dispositivo.');
      }
    } catch (x) {
      setErr(x.message || 'Qualcosa non ha funzionato.');
    }
    setBusy(false);
  }

  return (
    <div className="login">
      <div className="login-card">
        <Logo />
        <h1>{session ? 'Questa email non è ancora socia' : 'Il posto di chi ha un pezzo WiSiVERSE'}</h1>
        <p className="lead">
          {session
            ? 'Inserisci il codice che hai ricevuto per posta con il tuo ordine.'
            : 'Entri con un link via email. Se è la prima volta, usa il codice che ti è arrivato con il tuo ordine.'}
        </p>

        {!session && (
          <div className="tabs2">
            <button className={tab === 'in' ? 'on' : ''} onClick={() => setTab('in')}>Accedi</button>
            <button className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}>Ho un codice</button>
            <button className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')}>Non ho un codice</button>
          </div>
        )}

        {tab === 'shop' ? (
          <p className="lead">
            Il codice arriva via email subito dopo il tuo ordine, a nome di chi ha acquistato un pezzo WiSiVERSE.{' '}
            <a href={SHOP}>Vai allo shop</a>.
          </p>
        ) : (
          <form onSubmit={submit}>
            {tab === 'code' && (
              <div className="field">
                <label>Codice</label>
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WISI-XXXX-XXXX" required />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.com" required />
            </div>
            {tab === 'code' && (
              <div className="field">
                <label>Nickname</label>
                <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Come ti chiamano qui dentro" minLength={2} maxLength={24} required />
              </div>
            )}
            <button className="btn" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Un attimo…' : tab === 'in' ? 'Inviami il link' : 'Entra'}
            </button>
            {ok && <p className="msgok">{ok}</p>}
            {err && <p className="msgerr">{err}</p>}
          </form>
        )}

        {session && (
          <p className="hint">
            <button className="btn ghost mini" onClick={() => api.signOut()}>Esci</button>
          </p>
        )}
      </div>
    </div>
  );
}
