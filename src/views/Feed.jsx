import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Avatar, Loading, run } from '../components/ui.jsx';
import { fmtDate, relTime } from '../lib/util.js';

const EMOJI = ['❤️', '🔥', '👀', '👍'];

export default function Feed({ channel, me }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const end = useRef(null);
  const canPost = !channel.ro || me.is_admin;

  const load = () => api.listMessages(channel.id).then(setMsgs).catch(() => setMsgs([]));
  useEffect(() => {
    setMsgs(null);
    load();
    return api.subscribeMessages(channel.id, load);
    // eslint-disable-next-line
  }, [channel.id]);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs]);

  async function send(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    if (await run(() => api.postMessage(channel.id, t))) load();
  }
  async function react(m, emoji) {
    const has = m.reactions.some((r) => r.emoji === emoji && r.user_id === me.id);
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
            m.reactions.forEach((r) => (groups[r.emoji] = (groups[r.emoji] || []).concat(r.user_id)));
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
