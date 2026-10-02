import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Avatar, Loading, run, toast } from '../components/ui.jsx';
import { fmtDate, relTime } from '../lib/util.js';

const EMOJI = ['❤️', '🔥', '👀', '👍'];
const POLL_MS = 8000;

export default function Feed({ channel, me }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const end = useRef(null);
  const canPost = !channel.ro || me.is_admin;

  // quiet: gli aggiornamenti periodici non mostrano l'errore a ogni giro.
  const load = (quiet) =>
    api
      .listMessages(channel.id)
      .then((list) => setMsgs(Array.isArray(list) ? list : []))
      .catch((e) => {
        if (!quiet) toast(`Messaggi non caricati: ${e?.message || e}`);
        setMsgs((cur) => cur || []);
      });
  useEffect(() => {
    setMsgs(null);
    load();
    // Aggiornamento periodico al posto del realtime: ogni 8 secondi, solo a scheda visibile
    // (e subito quando la scheda torna visibile).
    const refresh = () => {
      if (document.visibilityState === 'visible') load(true);
    };
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
    // eslint-disable-next-line
  }, [channel.id]);

  // Si scende in fondo solo quando arriva un messaggio nuovo, non a ogni aggiornamento periodico.
  // Corpo tra graffe: scrollIntoView nei browser recenti ritorna una Promise, e un effetto che la
  // ritorna fa cadere React al giro dopo ("... is not a function" sulla pulizia dell'effetto).
  const lastId = msgs?.length ? msgs[msgs.length - 1]?.id : null;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    if (await run(() => api.postMessage(channel.id, t))) load();
  }
  async function react(m, emoji) {
    const has = (m.reactions || []).some((r) => r.emoji === emoji && r.user_id === me.id);
    if (await run(() => api.toggleReaction(m.id, emoji, has))) load();
  }

  let lastDay = '';
  return (
    <>
      <div className="body">
        {channel.topic && <p className="lead">{channel.topic}</p>}
        {!msgs ? (
          <Loading />
        ) : msgs.length === 0 ? (
          <p className="lead">Ancora nessun messaggio.</p>
        ) : (
          msgs.map((m) => {
            const day = fmtDate(m.created_at);
            const sep = day !== lastDay;
            lastDay = day;
            const groups = {};
            (m.reactions || []).forEach((r) => (groups[r.emoji] = (groups[r.emoji] || []).concat(r.user_id)));
            const emojis = [...new Set([...EMOJI, ...Object.keys(groups)])];
            return (
              <React.Fragment key={m.id}>
                {sep && <div className="day">{day}</div>}
                <div className="msg">
                  <Avatar name={m.author?.nickname} />
                  <div>
                    <div className="mh">
                      <span className="who">{m.author?.nickname || 'Membro'}</span>
                      {m.author?.is_admin && <span className="rl" style={{ color: 'var(--primary)' }}>Studio</span>}
                      {!m.author?.is_admin && m.author?.is_finder && <span className="rl" style={{ color: 'var(--gold)' }}>Ritrovatore</span>}
                      <span className="tm">{relTime(m.created_at)}</span>
                    </div>
                    <p className="tx">{m.body}</p>
                    <div className="rx">
                      {emojis.map((em) => {
                        const n = (groups[em] || []).length;
                        const on = (groups[em] || []).includes(me.id);
                                                return (
                          <button key={em} className={on ? 'on' : ''} onClick={() => react(m, em)}>
                            {em}{n ? ` ${n}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={end} />
      </div>
      <div className="compose">
        {canPost ? (
          <form onSubmit={send}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Scrivi in ${channel.name}`} maxLength={2000} />
            <button>Invia</button>
          </form>
        ) : (
          <div className="ro">In questo canale scrive solo lo Studio.</div>
        )}
      </div>
    </>
  );
}
