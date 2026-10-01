import { DEMO } from './supabase.js';
import { real } from './real.js';
import { demo } from './demo.js';

// Un solo punto d'ingresso per i dati: reale (Supabase) oppure demo (dati finti).
export const api = DEMO ? demo : real;
export { DEMO };
