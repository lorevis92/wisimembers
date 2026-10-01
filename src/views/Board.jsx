import React from 'react';
import { api } from '../lib/api.js';
import { Loading, useLoad } from '../components/ui.jsx';
import { fmtValue } from '../lib/util.js';

export default function Board({ channel }) {
  const [b] = useLoad(() => api.getBoard(channel.game), [channel.game]);
  if (!b) return <div className="body"><Loading /></div>;
  return (
    <div className="body">
      {channel.topic && <p className="lead">{channel.topic}</p>}
      {!b.event ? (
        <p className="lead">Nessuna gara attiva: la classifica compare quando ne parte una.</p>
      ) : (
        <>
          <div className="sh">{b.event.title}{b.event.closed ? ' · conclusa' : ''}</div>
          <div className="tblwrap">
            <table className="board">
              <tbody>
                {b.rows.length === 0 && <tr><td>Ancora nessun punteggio.</td></tr>}
                {b.rows.map((r) => (
                  <tr key={r.rank}>
                    <td style={{ width: 36, fontFamily: 'var(--mono)' }}>{r.rank}</td>
                    <td>{r.nickname}</td>
                    <td>{fmtValue(channel.game, r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
