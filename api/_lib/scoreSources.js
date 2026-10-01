// =====================================================================
// DA ADATTARE: dove sono salvati i punteggi dei tuoi giochi nel Supabase "wisinvaders".
// Per ogni gioco indica tabella e colonne. Il giocatore deve essere identificato dallo stesso
// user id dell'account Supabase (e lo stesso dei membri), cosi i vincitori si calcolano da soli.
//
//   table    nome della tabella con i punteggi
//   userCol  colonna con l'id utente (uuid di auth.users)
//   valueCol colonna con punteggio o tempo
//   dateCol  colonna con la data della partita
//   best     'max' (vince il punteggio piu alto) oppure 'min' (vince il tempo piu basso)
//
// Se per un gioco non c'e ancora una tabella, lascia null: le gare di quel gioco si chiudono
// solo a mano dallo Studio inserendo l'ordine di arrivo.
// I nomi qui sotto sono SEGNAPOSTO: controllali nel tuo database prima di usare le gare.
// =====================================================================
export const SOURCES = {
  wisinvaders: { table: 'scores', userCol: 'user_id', valueCol: 'score', dateCol: 'created_at', best: 'max' },
  wisikart: { table: 'kart_times', userCol: 'user_id', valueCol: 'time_ms', dateCol: 'created_at', best: 'min' },
  unbound: null,
  circolo: null,
};
