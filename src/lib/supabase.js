import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ritorno dall'email "Password dimenticata": va letto prima che Supabase consumi e ripulisca l'indirizzo.
const hash = window.location.hash;
export const RECOVERY_RETURN = /[#&]type=recovery/.test(hash);
export const RECOVERY_EXPIRED = /[#&]error(_code)?=/.test(hash);

export const supabase = url && key ? createClient(url, key) : null;
// Senza chiavi Supabase l'app gira in modalita demo con dati finti.
export const DEMO = !supabase;
