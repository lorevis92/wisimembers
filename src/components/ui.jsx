import React, { useEffect, useState } from 'react';
import { artBg, colorFor, initial } from '../lib/util.js';

export const Logo = () => (
  <div className="logo">
    <b>WiSiVERSE</b>
    <span>Members</span>
  </div>
);

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
