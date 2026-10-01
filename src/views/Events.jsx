import React from 'react';
import { api } from '../lib/api.js';
import { Loading, run, useLoad } from '../components/ui.jsx';
import { fmtDateTime } from '../lib/util.js';

export default function Events({ channel }) {
  const [events, reload] = useLoad(() => api.listEvents(channel.game), [channel.game]);
  if (!events) return <div className="body"><Loading /></div>;
  const now = Date.now();
  return (
    <div className="body">
      {channel.topic && <p className="lead">{channel.topic}</p>}
      {events.length === 0 && <p className="lead">Nessuna gara in programma, per ora.</p>}
      {events.map((e) => {
        const closed = !!e.closed_at || new Date(e.ends_at).getTime() < now;
        return (
          <div className="ev" key={e.id}>
            <h3>{e.title}{e.is_cup ? ' · Coppa' : ''}</h3>
            {e.description && <p>{e.description}</p>}
            <div className="meta">
              <span>Dal <b>{fmtDateTime(e.starts_at)}</b></span>
              <span>al <b>{fmtDateTime(e.ends_at)}</b></span>
              <span><b>{e.entries}</b> iscritti</span>
              {e.prize && <span>Premio: <b>{e.prize}</b></span>}
            </div>
            {closed ? (
              <span className="btn done">{e.closed_at ? 'Conclusa' : 'Iscrizioni chiuse'}</span>
            ) : e.joined ? (
              <div className="acts">
                <span className="btn done">Sei iscritto</span>
                <button className="btn ghost" onClick={async () => { await run(() => api.leaveEvent(e.id)); reload(); }}>Ritirati</button>
              </div>
            ) : (
              <button className="btn" onClick={async () => { await run(() => api.joinEvent(e.id), 'Iscrizione registrata.'); reload(); }}>Iscriviti</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
