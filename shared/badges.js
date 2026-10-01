// Definizione dei badge. I badge si assegnano da soli (api/_lib/badges.js) a partire dagli eventi.
export const BADGES = [
  { id: 'fondatore', icon: '★', title: 'Fondatore', desc: 'Tra i primi 50 membri. Non si può più ottenere.' },
  { id: 'ritrovatore', icon: '◉', title: 'Ritrovatore', desc: 'Ha raccolto un Whiskey per strada.' },
  { id: 'primo-proprietario', icon: '◆', title: 'Primo proprietario', desc: "Ha tenuto un'opera dal suo ritrovamento." },
  { id: 'vincitore', icon: '▲', title: 'Vincitore di sfida', desc: 'Ha vinto una sfida.' },
  { id: 'custode', icon: '⌂', title: 'Custode', desc: 'Tiene la stessa opera da almeno un anno.' },
  { id: 'coppa', icon: '♛', title: 'Coppa vinta', desc: 'Ha vinto una Coppa.' },
];

export const FOUNDERS_LIMIT = 50;
