import React, { useCallback, useEffect, useState } from 'react';
import { api, DEMO } from './lib/api.js';
import { Avatar, Loading, Logo, Toaster } from './components/ui.jsx';
import { levelFor } from '../shared/levels.js';
import Login, { NewPassword } from './views/Login.jsx';
import Feed from './views/Feed.jsx';
import Registry from './views/Registry.jsx';
import Series from './views/Series.jsx';
import Games from './views/Games.jsx';
import Events from './views/Events.jsx';
import Board from './views/Board.jsx';
import Found from './views/Found.jsx';
import Profile from './views/Profile.jsx';
import Studio from './views/Studio.jsx';

const VIEWS = { feed: Feed, registry: Registry, series: Series, games: Games, events: Events, board: Board, found: Found };

const LockIcon = () => (
  <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const StudioIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M4 20l4-1 10-10-3-3L5 16l-1 4z" /><path d="M14 7l3 3" /></svg>
);

function Sealed() {
  return (
    <div className="body">
      <div className="seal">
        <div className="wax">C</div>
        <h2>Il Circolo dei Ritrovatori è sigillato</h2>
        <p>Si apre quando raccogli un Whiskey per strada e lo Studio approva il ritrovamento. Il codice è nella busta del quadro: inizia da Drop, “ho-trovato-un-whiskey”.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [boot, setBoot] = useState(false);
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null); // loadMe
  const [loadedFor, setLoadedFor] = useState(null); // utente di cui è già stato caricato il profilo
  const [recovery, setRecovery] = useState(api.recovery.pending); // ritorno da «Password dimenticata»
  const [servers, setServers] = useState([]);
  const [people, setPeople] = useState([]);
  const [srvId, setSrvId] = useState(null);
  const [chId, setChId] = useState(null);
  const [mode, setMode] = useState('channel'); // channel | profile | studio
  const [view, setView] = useState('nav');
  const [openPiece, setOpenPiece] = useState(null);

  const loadAll = useCallback(async () => {
    const me = await api.loadMe();
    setData(me);
    return me;
  }, []);

  useEffect(() => {
    let off = api.onAuth((s, event) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    api.getSession().then(async (s) => {
      setSession(s);
      if (s) await loadAll().catch(() => null);
      setLoadedFor(s?.user?.id || null);
      setBoot(true);
    });
    return off;
  }, [loadAll]);

  const userId = session?.user?.id || null;
  useEffect(() => {
    if (session && boot) loadAll().catch(() => null).finally(() => setLoadedFor(userId));
    if (!session) {
      setData(null);
      setLoadedFor(null);
    }
    // eslint-disable-next-line
  }, [userId]);

  const profile = data?.profile || null;
  useEffect(() => {
    if (!profile) return;
    api.loadStructure().then((s) => {
      setServers(s);
      if (!srvId && s[0]) {
        setSrvId(s[0].id);
        setChId(s[0].categories[0]?.channels[0]?.id || null);
      }
    });
    api.listPeople().then(setPeople).catch(() => null);
    api.refreshBadges();
    // eslint-disable-next-line
  }, [profile?.id]);

  // Dopo il login il profilo si carica un attimo dopo la sessione: nel frattempo niente schermata del codice.
  if (!boot || (session && loadedFor !== userId)) return <div className="shell"><Loading /></div>;
  if (session && recovery) return <NewPassword onDone={() => setRecovery(false)} />;
  if (!session || !profile) return <Login session={session} onJoined={loadAll} />;

  const me = profile;
  const counts = data.counts;
  const badges = data.badges;
  const lv = levelFor(counts);
  const srv = servers.find((s) => s.id === srvId) || servers[0];
  const channels = srv ? srv.categories.flatMap((c) => c.channels) : [];
  const ch = channels.find((c) => c.id === chId) || channels[0];
  const sealed = srv && srv.access === 'finder' && !(me.is_finder || me.is_admin);
  const canSeeStudio = me.is_admin;

  const pickServer = (s) => {
    setSrvId(s.id);
    setChId(s.categories[0]?.channels[0]?.id || null);
    setMode('channel');
    setView('nav');
  };
  const pickChannel = (c) => {
    setChId(c.id);
    setOpenPiece(null);
    setMode('channel');
    setView('chat');
  };
  const goPiece = (id) => {
    const s = servers.find((x) => x.id === 'reg');
    const c = s?.categories.flatMap((k) => k.channels).find((k) => k.type === 'registry');
    if (!s || !c) return;
    setSrvId(s.id);
    setChId(c.id);
    setOpenPiece(id);
    setMode('channel');
    setView('chat');
  };

  const title = mode === 'profile' ? 'Il mio profilo' : mode === 'studio' ? 'Studio' : ch?.name;
  const topic = mode === 'channel' ? ch?.topic : '';
  const View = ch ? VIEWS[ch.type] || Feed : null;

  return (
    <div className="shell">
      {DEMO && <div className="demobar">Modalità demo · dati di prova, niente viene salvato</div>}
      <div className="nav">
        <button className="burger" aria-label="Menu" onClick={() => setView('nav')}>☰</button>
        <Logo />
        <div className="auth">
          <span>{me.nickname}</span>
          <button onClick={() => api.signOut()}>Esci</button>
        </div>
      </div>
      <div className="app" data-view={view}>
        <div className="rail">
          {servers.map((s) => (
            <button key={s.id} className={`srv ${mode === 'channel' && srv?.id === s.id ? 'on' : ''}`} title={s.name} onClick={() => pickServer(s)}>
              <span className="gl">{s.glyph}</span>
              {s.access === 'finder' && !(me.is_finder || me.is_admin) && <span className="lk"><LockIcon /></span>}
            </button>
          ))}
          {canSeeStudio && (
            <button className={`srv studio ${mode === 'studio' ? 'on' : ''}`} title="Studio" onClick={() => { setMode('studio'); setView('chat'); }}>
              <StudioIcon />
            </button>
          )}
        </div>

        <div className="chlist">
          <div className="shead">
            <h1>{srv?.title}</h1>
            {srv?.access === 'finder' ? (
              <div className={`badge ${sealed ? 'locked' : 'gold'}`}><b />{sealed ? 'Sigillato' : 'Solo ritrovatori'}</div>
            ) : (
              <div className="badge"><b />Aperto ai membri</div>
            )}
          </div>
          <div className="chs">
            {srv?.categories.map((cat) => (
              <div key={cat.name}>
                <div className="cat">{cat.name}</div>
                {cat.channels.map((c) => (
                  <button key={c.id} className={`ch ${mode === 'channel' && ch?.id === c.id ? 'on' : ''}`} onClick={() => pickChannel(c)}>
                    <span className="t">{c.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button className="me" onClick={() => { setMode('profile'); setView('chat'); }}>
            <Avatar name={me.nickname} />
            <div><div className="nm">{me.nickname}</div><div className="sub">{lv.name}</div></div>
          </button>
        </div>

        <div className="main">
          <div className="top">
            <button className="back" aria-label="Indietro" onClick={() => setView('nav')}>
              <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <span className="nm">{title}</span>
            {topic && <span className="tp">{topic}</span>}
          </div>
          {mode === 'profile' ? (
            <Profile me={me} counts={counts} badges={badges} onChanged={loadAll} onOpenPiece={goPiece} />
          ) : mode === 'studio' ? (
            <Studio />
          ) : sealed ? (
            <Sealed />
          ) : View ? (
            <View key={ch.id + (openPiece || '')} channel={ch} me={me} initial={openPiece} onChanged={loadAll} />
          ) : null}
        </div>

        <aside className="people">
          <div className="cat">Membri</div>
          {people.map((p) => (
            <div className="pp" key={p.id}>
              <Avatar name={p.nickname} />
              <span>{p.nickname}</span>
            </div>
          ))}
        </aside>
      </div>
      <div className="foot">
        <div className="lw"><span className="lg">Wi<i>Si</i>VERSE</span><span>© WiSiVERSE · Spazio riservato ai membri</span></div>
        <a href={import.meta.env.VITE_SHOP_URL || 'https://www.wisiverse.com'}>wisiverse.com</a>
      </div>
      <Toaster />
    </div>
  );
}
