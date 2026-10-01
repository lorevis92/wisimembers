import React from 'react';
import { api } from '../lib/api.js';
import { Loading, useLoad } from '../components/ui.jsx';

export default function Series({ channel }) {
  const [products] = useLoad(() => api.listProducts(), []);
  if (!products) return <div className="body"><Loading /></div>;
  const list = products.filter((p) => p.active !== false);
  return (
    <div className="body">
      {channel.topic && <p className="lead">{channel.topic}</p>}
      <div className="series">
        {list.length === 0 && <p className="lead">Nessun pezzo in serie, per ora.</p>}
        {list.map((p) => (
          <div className="row" key={p.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              {p.image_url && <img src={p.image_url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 3, border: '1px solid var(--line)' }} />}
              <div>
                <b>{p.title}</b>
                <small>{p.owners} {p.owners === 1 ? 'persona lo possiede' : 'persone lo possiedono'}</small>
              </div>
            </div>
            {p.mine.length > 0 && <span className="pill">Tuo · n° {p.mine.join(', ')}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
