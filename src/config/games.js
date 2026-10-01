// I giochi mostrati in WISI ARCADE > tutti-i-giochi.
//
// PER CAMBIARE LE IMMAGINI: copia il file nella cartella /public/games con il nome indicato qui sotto
// (consigliato un quadrato, es. 800x800 px). Se il file non c'e, compare un segnaposto.
//
// status: 'online' = si puo giocare ('Gioca' apre url) | 'soon' = in sviluppo
export const GAMES = [
  {
    id: 'wisinvaders',
    title: 'WISINVADERS',
    desc: "L'arcade nello spazio: ondate, power-up e punteggi. Qui si giocano le gare con premio.",
    image: '/games/wisinvaders.png',
    status: 'online',
    url: 'https://wisinvaders.vercel.app',
  },
  {
    id: 'wisikart',
    title: 'WisiKart',
    desc: 'Il kart racer del WiSiVERSE: quattro piste, due coppe, tutti i Whiskey in griglia.',
    image: '/games/wisikart.png',
    status: 'online',
    url: 'https://wisikart.vercel.app',
  },
  {
    id: 'unbound',
    title: 'WiSiVERSE Unbound',
    desc: 'La Story: parti da Niaboc e segui Whiskey tra i pianeti. Livelli, boss e pezzi di storia.',
    image: '/games/unbound.png',
    status: 'soon',
    url: '',
  },
];
