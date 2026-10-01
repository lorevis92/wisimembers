// Livelli del WiSiVERSE (mondo dell'arte). Usato sia dall'app che dalle funzioni server.
// I livelli salgono con quello che fai (ritrovare, partecipare, vincere) piu che con quello che spendi:
// i pezzi in serie contano poco e sono limitati a 6 punti in totale.

export const LEVELS = ['Visitatore', 'Appassionato', 'Collezionista', 'Mecenate', 'Curatore'];
const THRESHOLDS = [0, 1, 4, 10, 20];

/** counts: { series, originals, finds, events, wins } */
export function computePoints(c) {
  const series = Math.min(c.series || 0, 6);
  return series * 1 + (c.originals || 0) * 3 + (c.finds || 0) * 3 + (c.events || 0) * 1 + (c.wins || 0) * 4;
}

export function levelFor(counts) {
  const points = computePoints(counts);
  let index = 0;
  THRESHOLDS.forEach((t, i) => {
    if (points >= t) index = i;
  });
  const prev = THRESHOLDS[index];
  const next = THRESHOLDS[index + 1];
  return {
    index,
    name: LEVELS[index],
    points,
    nextName: next == null ? null : LEVELS[index + 1],
    progress: next == null ? 1 : (points - prev) / (next - prev),
  };
}
