-- Struttura iniziale: server e canali. Puoi cambiarla quando vuoi (nomi, ordine, nuovi canali).
-- type: feed (chat) | registry (opere) | series (pezzi in serie) | games | events | board | found

insert into wm_servers (id, name, glyph, title, access, position) values
  ('drop',    'Drop',                    'D', 'Drop',                    'member', 1),
  ('reg',     'Registro',                'R', 'Registro',                'member', 2),
  ('wisi',    'WiSiVERSE',               'W', 'WiSiVERSE',               'member', 3),
  ('arcade',  'WISI ARCADE',             'A', 'WISI ARCADE',             'member', 4),
  ('cerchio', 'Circolo dei Ritrovatori', 'C', 'Circolo dei Ritrovatori', 'finder', 5)
on conflict (id) do update set name = excluded.name, glyph = excluded.glyph,
  title = excluded.title, access = excluded.access, position = excluded.position;

insert into wm_channels (id, server_id, category, name, type, ro, topic, game, position) values
  ('prossimi',     'drop',    'Annunci',           'prossimi-drop',        'feed',     true,  'Dove e quando parte il prossimo Whiskey.', null, 1),
  ('indizi',       'drop',    'Annunci',           'indizi',               'feed',     true,  'Un indizio alla volta. Il resto è da scoprire.', null, 2),
  ('trovato',      'drop',    'Ritrovamenti',      'ho-trovato-un-whiskey','found',    false, 'Hai raccolto un quadro? Inizia da qui.', null, 3),

  ('opere',        'reg',     'Le opere',          'opere-originali',      'registry', false, 'Ogni quadro ha la sua storia: dove è stato lasciato, chi lo ha trovato, dove vive oggi.', null, 1),
  ('serie',        'reg',     'Le opere',          'pezzi-in-serie',       'series',   false, 'T-shirt, stampe e altri pezzi: quante persone li possiedono.', null, 2),
  ('passaggi',     'reg',     'Passaggi',          'passaggi-approvati',   'feed',     true,  'Ogni passaggio di mano approvato.', null, 3),
  ('cerca',        'reg',     'Passaggi',          'cerca-casa',           'feed',     false, 'Chi vuole passare un''opera e chi la cerca.', null, 4),

  ('benvenuto',    'wisi',    'Benvenuto',         'benvenuto',            'feed',     true,  'Cosa puoi fare qui dentro.', null, 1),
  ('presentazioni','wisi',    'Benvenuto',         'presentazioni',        'feed',     false, 'Chi sei, dove sei, quale pezzo hai.', null, 2),
  ('chiacchiere',  'wisi',    'Comunità',          'chiacchiere',          'feed',     false, 'Tutto quello che non ha un canale.', null, 3),
  ('pezzi',        'wisi',    'Comunità',          'i-miei-pezzi',         'feed',     false, 'Foto dei pezzi WiSiVERSE nelle vostre case.', null, 4),
  ('novita',       'wisi',    'Annunci',           'novità-dallo-studio',  'feed',     true,  'Solo Lorenzo scrive qui.', null, 5),

  ('giochi',       'arcade',  'Sala giochi',       'tutti-i-giochi',       'games',    false, 'Tutti i giochi del WiSiVERSE, un posto solo.', null, 1),
  ('gare-inv',     'arcade',  'WISINVADERS',       'gare-aperte',          'events',   false, 'Iscrizioni e regolamento.', 'wisinvaders', 2),
  ('classifica-inv','arcade', 'WISINVADERS',       'classifica',           'board',    false, 'Punteggi aggiornati.', 'wisinvaders', 3),
  ('strategie',    'arcade',  'WISINVADERS',       'strategie',            'feed',     false, 'Consigli, trucchi, scuse per il punteggio.', null, 4),
  ('gare-kart',    'arcade',  'WisiKart',          'gare-aperte',          'events',   false, 'Tornei e sfide a tempo.', 'wisikart', 5),
  ('tempi',        'arcade',  'WisiKart',          'tempi-sul-giro',       'board',    false, 'I migliori tempi.', 'wisikart', 6),
  ('kart-chat',    'arcade',  'WisiKart',          'in-pista',             'feed',     false, 'Scorciatoie, setup e sorpassi finiti male.', null, 7),
  ('storia',       'arcade',  'WiSiVERSE Unbound', 'diario-di-sviluppo',   'feed',     true,  'Come nasce la Story: aggiornamenti da Lorenzo.', null, 8),
  ('feedback',     'arcade',  'WiSiVERSE Unbound', 'feedback',             'feed',     false, 'Cosa funziona e cosa no, prima che esca.', null, 9),

  ('studio-feed',  'cerchio', 'Il Circolo',        'dal-mio-studio',       'feed',     true,  'Anticipazioni e bozze, prima di tutti.', null, 1),
  ('case',         'cerchio', 'Il Circolo',        'nelle-nuove-case',     'feed',     false, 'Dove sono finiti i quadri.', null, 2),
  ('incontri',     'cerchio', 'Il Circolo',        'incontri',             'events',   false, 'Videochiamate e serate.', 'circolo', 3)
on conflict (id) do update set server_id = excluded.server_id, category = excluded.category,
  name = excluded.name, type = excluded.type, ro = excluded.ro, topic = excluded.topic,
  game = excluded.game, position = excluded.position;
