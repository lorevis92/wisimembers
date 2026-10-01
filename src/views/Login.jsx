import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Logo } from '../components/ui.jsx';

const SHOP = import.meta.env.VITE_SHOP_URL || 'https://www.wisiverse.com';
// Le email con il codice portano qui con ?code=WISI-XXXX-XXXX: si apre già la registrazione.
const URL_CODE = (new URLSearchParams(window.location.search).get('code') || '').toUpperCase();

/**
 * Accesso con email e password.
 *  in      Accedi
 *  forgot  Password dimenticata (email di recupero di Supabase)
 *  up      Registrati: solo con un codice valido, l'account lo crea il server
 *  shop    Non ho un codice
 *  code    già loggato (es. con l'account dei giochi) ma senza profilo membro: serve solo il codice
 */
export default function Login({ session, onJoined }) {
  const [tab, setTab] = useState(URL_CODE ? 'up' : 'in');
  const mode = session ? 'code' : tab;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(URL_CODE);
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState(
    !session && api.recovery.expired
      ? 'Il link per la nuova password è scaduto o è già stato usato. Chiedine un altro da «Password dimenticata».'
      : '',
  );

  const go = (t) => {
    setTab(t);
    setOk('');
    setErr('');
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setOk('');
    try {
      if (mode ==='in') {
        await api.signIn(email.trim(), password);
      } else if (mode ==='forgot') {
        await api.sendPasswordReset(email.trim());
        setOk('Se questa email ha un account, ti abbiamo mandato un link per scegliere una nuova password. Controlla la posta, anche lo spam.');
      } else if (mode ==='code') {
        await api.redeem({ code: code.trim(), nickname: nick.trim() });
        await onJoined();
      } else {
        const r = await api.redeem({ code: code.trim(), email: email.trim(), nickname: nick.trim(), password });
        if (r.existing) {
          // Account già presente (lo stesso dei giochi): la password non è stata toccata.
          setPassword('');
          setTab('in');
          setOk('Codice accettato. Questa email era già registrata nel WiSiVERSE: entra con la tua password di sempre. Se non la ricordi o non ne hai mai scelta una, usa «Password dimenticata».');
        } else {
          await api.signIn(email.trim(), password);
        }
      }
    } catch (x) {
      setErr(x.message || 'Qualcosa non ha funzionato.');
    }
    setBusy(false);
  }

  const signing = mode ==='in' || mode ==='forgot';

  return (
    <div className="login">
      <div className="login-card">
        <Logo />
        <h1>{session ? 'Questa email non è ancora socia' : 'Il posto di chi ha un pezzo WiSiVERSE'}</h1>
        <p className="lead">
          {session
            ? 'Inserisci il codice che hai ricevuto per posta con il tuo ordine.'
            : 'Entri con email e password. Se è la prima volta, registrati con il codice che ti è arrivato con il tuo ordine.'}
        </p>

        {!session && (
          <div className="tabs2">
            <button className={signing ? 'on' : ''} onClick={() => go('in')}>Accedi</button>
            <button className={mode ==='up' ? 'on' : ''} onClick={() => go('up')}>Registrati</button>
            <button className={mode ==='shop' ? 'on' : ''} onClick={() => go('shop')}>Non ho un codice</button>
          </div>
        )}

        {mode ==='shop' ? (
          <p className="lead">
            Il codice arriva via email subito dopo il tuo ordine, a nome di chi ha acquistato un pezzo WiSiVERSE.{' '}
            <a href={SHOP}>Vai allo shop</a>.
          </p>
        ) : (
          <form onSubmit={submit}>
            {mode ==='forgot' && (
              <p className="lead" style={{ marginBottom: 12 }}>
                Scrivi la tua email: ti mandiamo un link per scegliere una nuova password.
              </p>
            )}
            {(mode ==='up' || mode ==='code') && (
              <div className="field">
                <label>Codice</label>
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WISI-XXXX-XXXX" autoComplete="off" required />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              {mode ==='code' ? (
                <input type="email" value={session?.user?.email || ''} disabled />
              ) : (
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.com" autoComplete="email" required />
              )}
            </div>
            {(mode ==='up' || mode ==='code') && (
              <div className="field">
                <label>Nickname</label>
                <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Come ti chiamano qui dentro" minLength={2} maxLength={24} autoComplete="nickname" required />
              </div>
            )}
            {mode ==='in' && (
              <div className="field">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </div>
            )}
            {mode ==='up' && (
              <div className="field">
                <label>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Almeno 8 caratteri" minLength={8} maxLength={72} autoComplete="new-password" required />
              </div>
            )}
            <button className="btn" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Un attimo…' : mode ==='in' ? 'Accedi' : mode ==='forgot' ? 'Inviami il link' : mode ==='up' ? 'Registrati' : 'Entra'}
            </button>
            {ok && <p className="msgok">{ok}</p>}
            {err && <p className="msgerr">{err}</p>}
            {signing && (
              <p className="hint">
                <button type="button" className="btn ghost mini" onClick={() => go(mode ==='in' ? 'forgot' : 'in')}>
                  {mode ==='in' ? 'Password dimenticata' : 'Torna ad Accedi'}
                </button>
              </p>
            )}
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

/** Ritorno dal link «Password dimenticata»: l'utente è già dentro e sceglie la nuova password. */
export function NewPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (password !== again) return setErr('Le due password non coincidono.');
    setBusy(true);
    setErr('');
    try {
      await api.setPassword(password);
      onDone();
    } catch (x) {
      setErr(x.message || 'Qualcosa non ha funzionato.');
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <Logo />
        <h1>Scegli una nuova password</h1>
        <p className="lead" style={{ marginBottom: 14 }}>Da adesso entri con la tua email e questa password.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Nuova password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Almeno 8 caratteri" minLength={8} maxLength={72} autoComplete="new-password" required />
          </div>
          <div className="field">
            <label>Ripeti la password</label>
            <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required />
          </div>
          <button className="btn" disabled={busy} style={{ width: '100%' }}>{busy ? 'Un attimo…' : 'Salva la password'}</button>
          {err && <p className="msgerr">{err}</p>}
        </form>
        <p className="hint">
          <button className="btn ghost mini" onClick={() => api.signOut()}>Esci</button>
        </p>
      </div>
    </div>
  );
}
