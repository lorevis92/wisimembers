import React, { useEffect, useState } from 'react';
import { artBg, colorFor, initial } from '../lib/util.js';

/** Logo dell'app (public/logo-members.png). Con onClick diventa il pulsante che riporta all'inizio. */
export function Logo({ onClick }) {
  const [broken, setBroken] = useState(false);
  // Se il file manca resta il nome scritto, non un'immagine rotta.
  const mark = broken ? <b>WiSiVERSE Members</b> : <img src="/logo-members.png" alt="WiSiVERSE Members" onError={() => setBroken(true)} />;
  return onClick ? (
    <button type="button" className="logo" onClick={onClick} title="Torna all'inizio">{mark}</button>
  ) : (
    <div className="logo">{mark}</div>
  );
}

export const Face = ({ label = 'W' }) => (
  <div className="face lg">
    <i>{label}</i>
  </div>
);

/** Immagine di un'opera: foto se c'e, altrimenti la faccina WISI su fondo colorato. */
export function Art({ src, seed, tag, mine, children }) {
  return (
    <div className="art" style={{ background: artBg(seed) }}>
      {src ? <img src={src} alt="" loading="lazy" /> : <Face label="W" />}
      {tag}
      {mine && <span className="mine">Tua</span>}
      {children}
    </div>
  );
}

export const Avatar = ({ name, size }) => (
  <div className="av" style={{ background: colorFor(name), ...(size ? { width: size, height: size } : null) }}>
    {initial(name)}
  </div>
);

let toastSet = null;
export const toast = (m) => toastSet && toastSet(m);
export function Toaster() {
  const [m, setM] = useState('');
  useEffect(() => {
    toastSet = (x) => {
      setM(x);
      setTimeout(() => setM(''), 3200);
    };
    return () => (toastSet = null);
  }, []);
  return m ? <div className="toast">{m}</div> : null;
}

export const Loading = () => <div className="loading">Un attimo…</div>;

/** Esegue una funzione asincrona mostrando l'errore come toast. */
export async function run(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    return r === undefined ? true : r;
  } catch (e) {
    toast(e.message || 'Qualcosa non ha funzionato.');
    return false;
  }
}

export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let off = false;
    fn()
      .then((d) => !off && setData(d))
      .catch((e) => !off && (toast(e.message), setData(undefined)));
    return () => {
      off = true;
    };
    // eslint-disable-next-line
  }, [...deps, tick]);
  return [data, () => setTick((t) => t + 1), setData];
}
