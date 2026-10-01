import React, { useState } from 'react';
import { GAMES } from '../config/games.js';

function Tile({ g }) {
  const [broken, setBroken] = useState(false);
  const online = g.status === 'online' && g.url;
  const inner = (
    <>
      {broken ? <div className="ph"><span style={{ fontFamily: 'var(--display)', fontSize: 22, textAlign: 'center', padding: 12 }}>{g.title}</span></div> : <img src={g.image} alt={g.title} onError={() => setBroken(true)} />}
      <span className={`st ${online ? 'on' : ''}`}>{online ? 'Gioca' : 'In arrivo'}</span>
      <div className="cap">
        <h3>{g.title}</h3>
        <p>{g.desc}</p>
      </div>
    </>
  );
  return online ? (
    <a className="tile" href={g.url} target="_blank" rel="noreferrer">{inner}</a>
  ) : (
    <div className="tile">{inner}</div>
  );
}

export default function Games({ channel }) {
  return (
    <div className="body">
      {channel.topic && <p className="lead">{channel.topic}</p>}
      <div className="tiles">
        {GAMES.map((g) => <Tile key={g.id} g={g} />)}
      </div>
      <p className="hint">Entra nei giochi con lo stesso account: i punteggi delle gare arrivano da soli in classifica.</p>
    </div>
  );
}
