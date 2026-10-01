import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { Loading, Avatar, run, useLoad } from '../components/ui.jsx';
import { BADGES } from '../../shared/badges.js';
import { LEVELS, levelFor } from '../../shared/levels.js';

export default function Profile({ me, counts, badges, onChanged, onOpenPiece }) {
  const [coll] = useLoad(() => api.myCollection(), []);
  const [nick, setNick] = useState(me.nickname);
  const lv = levelFor(counts);
  const patch = async (p, msg) => {
    if (await run(() => api.updateProfile(p), msg)) onChanged();
  };
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const changePw = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    if (await run(() => api.changePassword(pw.current, pw.next), 'Password aggiornata.')) setPw({ current: '', next: '' });
    setPwBusy(false);
  };
  const tracks = [
    ['Pezzi in serie', counts.series, 'contano fino a 6'],
    ['Opere originali', counts.originals, 'nella tua collezione'],
    ['Ritrovamenti', counts.finds, 'quadri raccolti'],
    ['Gare', counts.events, 'a cui hai partecipato'],
    ['Vittorie', counts.wins, 'sfide vinte'],
  ];
  return (
    <div className="body">
      <div className="pf-card">
        <div className="pf-banner" />
        <div className="pf-top">
          <Avatar name={me.nickname} />
          <div>
            <h2>{me.nickname}</h2>
            <span className="lv">{lv.name}</span>
          </div>
        </div>
        <div className="pf-in">
          <div className="ladder">
            {LEVELS.map((n, i) => <span key={n} className={i < lv.index ? 'done' : i === lv.index ? 'cur' : ''}>{n}</span>)}
          </div>
          <div className="prog"><i style={{ width: `${Math.round(lv.progress * 100)}%` }} /></div>
          <div className="progl">{lv.nextName ? `${lv.points} punti · verso ${lv.nextName}` : `${lv.points} punti · livello massimo`}</div>

          <div className="sub-h">Il tuo percorso</div>
          <div className="tracks">
            {tracks.map(([k, v, s]) => (
              <div className="trk" key={k}><div className="k">{k}</div><div className="v">{v}</div><div className="s">{s}</div></div>
            ))}
          </div>

          <div className="sub-h">Badge</div>
          <div className="badges">
            {BADGES.map((b) => {
              const has = badges.includes(b.id);
              return (
                <div key={b.id} className={`bdg ${has ? '' : 'lock'}`}>
                  <div className="ic">{b.icon}</div>
                  <div><b>{b.title}</b><small>{b.desc}</small></div>
                </div>
              );
            })}
          </div>

          <div className="sub-h">La tua collezione</div>
          {!coll ? <Loading /> : (
            <div className="coll">
              {coll.series.length + coll.originals.length === 0 && <p className="hint">Ancora vuota.</p>}
              {coll.originals.map((p) => (
                <button key={p.id} onClick={() => onOpenPiece(p.id)}><span><b>{p.title}</b><small>Opera originale · {p.city || ''}</small></span><span className="pill">Originale</span></button>
              ))}
              {coll.series.map((s) => (
                <div className="r" key={s.id}>
                  <span><b>{s.product?.title}</b><small>n° {s.serial}</small></span>
                  <span className="ship">
                    {s.ship_status === 'shipped' ? <>Spedito{s.eta ? ` · arrivo ${s.eta}` : ''} {s.tracking_url && <a href={s.tracking_url} target="_blank" rel="noreferrer">traccia</a>}</> : s.ship_status === 'delivered' ? 'Consegnato' : 'In preparazione'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="sub-h">Impostazioni</div>
          <form className="row2" onSubmit={(e) => { e.preventDefault(); patch({ nickname: nick.trim() }, 'Nickname aggiornato.'); }}>
            <div className="field" style={{ margin: 0 }}><label>Nickname</label><input value={nick} onChange={(e) => setNick(e.target.value)} minLength={2} maxLength={24} /></div>
            <div style={{ alignSelf: 'end' }}><button className="btn">Salva</button></div>
          </form>
          <label className="sw"><input type="checkbox" checked={!!me.show_collection} onChange={(e) => patch({ show_collection: e.target.checked })} /> Mostra la mia collezione agli altri membri</label>
          <label className="sw"><input type="checkbox" checked={!!me.public_name} onChange={(e) => patch({ public_name: e.target.checked })} /> Mostra il mio nickname come proprietario nel Registro</label>
          <div className="sub-h">Cambia password</div>
          <form onSubmit={changePw}>
            <div className="row2">
              <div className="field"><label>Password attuale</label><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required /></div>
              <div className="field"><label>Nuova password</label><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="Almeno 8 caratteri" minLength={8} maxLength={72} autoComplete="new-password" required /></div>
            </div>
            <button className="btn" disabled={pwBusy}>{pwBusy ? 'Un attimo…' : 'Cambia password'}</button>
          </form>
          <p><button className="btn ghost mini" onClick={() => api.signOut()}>Esci</button></p>
        </div>
      </div>
    </div>
  );
}
