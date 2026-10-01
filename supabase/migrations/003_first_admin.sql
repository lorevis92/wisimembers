-- Eseguire UNA volta, dopo aver fatto login almeno una volta con la tua email
-- (oppure se esiste gia un utente con questa email in Supabase, cioe un account di un'altra app WisiAPP).
-- Sostituisci la mail e il nickname.

insert into wm_profiles (id, nickname, is_admin, is_finder)
select id, 'Lorenzo', true, true
from auth.users
where lower(email) = lower('LA_TUA_EMAIL@esempio.com')
on conflict (id) do update set is_admin = true, is_finder = true;
