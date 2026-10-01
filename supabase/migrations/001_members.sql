-- =====================================================================
-- WISI Members: schema completo (prefisso wm_ per convivere con le altre app
-- WiSiVERSE nello stesso progetto Supabase). Non distruttivo: si puo rieseguire.
-- Esegui questo file nel SQL Editor di Supabase, poi 002_seed.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Profili ----------
-- Un utente e "membro" solo se ha una riga qui. La riga viene creata dal server
-- (api/redeem.js) quando riscatta un codice: gli utenti delle altre app NON diventano
-- membri automaticamente.
create table if not exists wm_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  member_no int generated always as identity,
  nickname text not null,
  avatar_url text,
  is_admin boolean not null default false,
  is_finder boolean not null default false,
  show_collection boolean not null default true,
  public_name boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists wm_profiles_nick_idx on wm_profiles (lower(nickname));

-- ---------- Funzioni di appoggio ----------
create or replace function wm_is_member() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from wm_profiles where id = auth.uid()) $$;

create or replace function wm_is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from wm_profiles where id = auth.uid() and is_admin) $$;

create or replace function wm_is_finder() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from wm_profiles where id = auth.uid() and (is_finder or is_admin)) $$;

create or replace function wm_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as
$$ select id from auth.users where lower(email) = lower(p_email) limit 1 $$;
revoke all on function wm_user_id_by_email(text) from public, anon, authenticated;
grant execute on function wm_user_id_by_email(text) to service_role;

-- Un utente non puo promuoversi a admin/ritrovatore da solo.
create or replace function wm_profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.is_admin := old.is_admin;
    new.is_finder := old.is_finder;
    new.member_no := old.member_no;
    new.id := old.id;
  end if;
  return new;
end $$;
drop trigger if exists wm_profiles_guard_trg on wm_profiles;
create trigger wm_profiles_guard_trg before update on wm_profiles
  for each row execute function wm_profiles_guard();

-- ---------- Server e canali (la struttura "stile Discord") ----------
create table if not exists wm_servers (
  id text primary key,
  name text not null,
  glyph text not null,
  title text not null,
  access text not null default 'member' check (access in ('member', 'finder')),
  position int not null default 0
);
create table if not exists wm_channels (
  id text primary key,
  server_id text not null references wm_servers(id) on delete cascade,
  category text not null,
  name text not null,
  type text not null default 'feed'
    check (type in ('feed', 'registry', 'series', 'games', 'events', 'board', 'found')),
  ro boolean not null default false,
  topic text,
  game text,
  position int not null default 0
);

create or replace function wm_can_read_channel(p_channel text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when not wm_is_member() then false
    else exists (
      select 1 from wm_channels c join wm_servers s on s.id = c.server_id
      where c.id = p_channel and (s.access = 'member' or wm_is_finder())
    ) end
$$;

create or replace function wm_can_post_channel(p_channel text) returns boolean
language sql stable security definer set search_path = public as $$
  select wm_can_read_channel(p_channel) and (
    wm_is_admin() or exists (
      select 1 from wm_channels c where c.id = p_channel and c.type = 'feed' and not c.ro
    )
  )
$$;

-- ---------- Messaggi e reazioni ----------
create table if not exists wm_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null references wm_channels(id) on delete cascade,
  user_id uuid not null references wm_profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists wm_messages_channel_idx on wm_messages (channel_id, created_at desc);

create table if not exists wm_reactions (
  message_id uuid not null references wm_messages(id) on delete cascade,
  user_id uuid not null references wm_profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  primary key (message_id, user_id, emoji)
);

-- ---------- Prodotti in serie (t-shirt, stampe...) ----------
create table if not exists wm_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  -- parole chiave cercate nel nome/SKU degli articoli Printful per riconoscere il prodotto
  match_keys text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists wm_product_counters (
  product_id uuid primary key references wm_products(id) on delete cascade,
  last_serial int not null default 0
);
create or replace function wm_next_serial(p uuid) returns int
language sql security definer set search_path = public as $$
  insert into wm_product_counters (product_id, last_serial) values (p, 1)
  on conflict (product_id) do update set last_serial = wm_product_counters.last_serial + 1
  returning last_serial
$$;
revoke all on function wm_next_serial(uuid) from public, anon, authenticated;
grant execute on function wm_next_serial(uuid) to service_role;

-- Una riga per ogni pezzo acquistato (anche prima che il cliente abbia un account).
create table if not exists wm_ownerships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references wm_profiles(id) on delete set null,
  email text not null,
  product_id uuid not null references wm_products(id),
  serial int,
  order_key text not null,
  line_idx int not null default 0,
  unit_idx int not null default 0,
  status text not null default 'active' check (status in ('active', 'canceled', 'refunded')),
  ship_status text not null default 'processing' check (ship_status in ('processing', 'shipped', 'delivered')),
  tracking_url text,
  eta text,
  created_at timestamptz not null default now(),
  unique (order_key, line_idx, unit_idx)
);
create index if not exists wm_ownerships_user_idx on wm_ownerships (user_id);
create index if not exists wm_ownerships_email_idx on wm_ownerships (lower(email));

create or replace view wm_product_stats as
  select p.id as product_id, count(o.id) filter (where o.status = 'active') as owners
  from wm_products p left join wm_ownerships o on o.product_id = p.id
  group by p.id;

-- ---------- Opere originali (il Registro) ----------
create table if not exists wm_pieces (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  city text,
  description text,
  image_url text,
  status text not null default 'upcoming' check (status in ('upcoming', 'left', 'found')),
  left_at timestamptz,
  lost_note text,
  current_owner uuid references wm_profiles(id) on delete set null,
  owner_since timestamptz,
  found_by uuid references wm_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists wm_piece_events (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references wm_pieces(id) on delete cascade,
  kind text not null check (kind in ('upcoming', 'left', 'found', 'passed', 'note')),
  from_user uuid references wm_profiles(id) on delete set null,
  to_user uuid references wm_profiles(id) on delete set null,
  text text,
  happened_at timestamptz not null default now()
);
create index if not exists wm_piece_events_idx on wm_piece_events (piece_id, happened_at);

-- Viste pubbliche per i membri: mostrano il nickname del proprietario solo se lo vuole.
create or replace view wm_pieces_public as
  select p.id, p.title, p.city, p.description, p.image_url, p.status, p.left_at, p.lost_note,
         p.created_at, p.owner_since,
         case when p.current_owner is null then null
              when pr.public_name or p.current_owner = auth.uid() then pr.nickname
              else 'Un membro' end as owner_label,
         coalesce(p.current_owner = auth.uid(), false) as is_mine
  from wm_pieces p left join wm_profiles pr on pr.id = p.current_owner
  where wm_is_member();

create or replace view wm_piece_timeline as
  select e.id, e.piece_id, e.kind, e.text, e.happened_at,
         case when e.from_user is null then null when f.public_name then f.nickname else 'Un membro' end as from_label,
         case when e.to_user is null then null when t.public_name then t.nickname else 'Un membro' end as to_label
  from wm_piece_events e
  left join wm_profiles f on f.id = e.from_user
  left join wm_profiles t on t.id = e.to_user
  where wm_is_member();

-- ---------- Codici (solo il server li legge: nessuna policy) ----------
create table if not exists wm_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('purchase', 'artwork')),
  email text,
  piece_id uuid references wm_pieces(id) on delete set null,
  order_key text,
  status text not null default 'unused' check (status in ('unused', 'redeemed', 'revoked')),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists wm_redeem_attempts (
  id bigint generated always as identity primary key,
  ident text not null,
  created_at timestamptz not null default now()
);
create index if not exists wm_redeem_attempts_idx on wm_redeem_attempts (ident, created_at);

-- ---------- Ritrovamenti e passaggi ----------
create table if not exists wm_found_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references wm_profiles(id) on delete cascade,
  code_id uuid references wm_codes(id) on delete set null,
  piece_id uuid references wm_pieces(id) on delete set null,
  photo_path text,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create or replace function wm_found_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.user_id := old.user_id; new.code_id := old.code_id; new.piece_id := old.piece_id;
    new.status := old.status; new.reject_reason := old.reject_reason;
    new.reviewed_at := old.reviewed_at; new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists wm_found_guard_trg on wm_found_requests;
create trigger wm_found_guard_trg before update on wm_found_requests
  for each row execute function wm_found_guard();

create table if not exists wm_transfers (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references wm_pieces(id) on delete cascade,
  from_user uuid not null references wm_profiles(id) on delete cascade,
  to_user uuid not null references wm_profiles(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- ---------- Gare ----------
create table if not exists wm_events (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  title text not null,
  description text,
  prize text,
  is_cup boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists wm_event_entries (
  event_id uuid not null references wm_events(id) on delete cascade,
  user_id uuid not null references wm_profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create table if not exists wm_event_results (
  event_id uuid not null references wm_events(id) on delete cascade,
  user_id uuid not null references wm_profiles(id) on delete cascade,
  rank int not null,
  value numeric,
  primary key (event_id, user_id)
);

-- ---------- Badge, attivita, log ----------
create table if not exists wm_user_badges (
  user_id uuid not null references wm_profiles(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  meta jsonb,
  primary key (user_id, badge_id)
);
create table if not exists wm_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references wm_profiles(id) on delete cascade,
  kind text not null,
  ref text,
  created_at timestamptz not null default now()
);
create table if not exists wm_webhook_log (
  id text primary key,
  type text,
  payload jsonb,
  received_at timestamptz not null default now()
);
create table if not exists wm_unmatched_items (
  id uuid primary key default gen_random_uuid(),
  order_key text,
  name text,
  sku text,
  email text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists wm_emails_log (
  key text primary key,
  to_email text,
  subject text,
  sent_at timestamptz not null default now()
);

-- =====================================================================
-- Sicurezza (RLS)
-- =====================================================================
alter table wm_profiles enable row level security;
alter table wm_servers enable row level security;
alter table wm_channels enable row level security;
alter table wm_messages enable row level security;
alter table wm_reactions enable row level security;
alter table wm_products enable row level security;
alter table wm_product_counters enable row level security;
alter table wm_ownerships enable row level security;
alter table wm_pieces enable row level security;
alter table wm_piece_events enable row level security;
alter table wm_codes enable row level security;
alter table wm_redeem_attempts enable row level security;
alter table wm_found_requests enable row level security;
alter table wm_transfers enable row level security;
alter table wm_events enable row level security;
alter table wm_event_entries enable row level security;
alter table wm_event_results enable row level security;
alter table wm_user_badges enable row level security;
alter table wm_activity enable row level security;
alter table wm_webhook_log enable row level security;
alter table wm_unmatched_items enable row level security;
alter table wm_emails_log enable row level security;

-- Profili
drop policy if exists wm_profiles_select on wm_profiles;
create policy wm_profiles_select on wm_profiles for select to authenticated
  using (id = auth.uid() or wm_is_member());
drop policy if exists wm_profiles_update on wm_profiles;
create policy wm_profiles_update on wm_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Struttura
drop policy if exists wm_servers_select on wm_servers;
create policy wm_servers_select on wm_servers for select to authenticated using (wm_is_member());
drop policy if exists wm_channels_select on wm_channels;
create policy wm_channels_select on wm_channels for select to authenticated using (wm_is_member());

-- Messaggi
drop policy if exists wm_messages_select on wm_messages;
create policy wm_messages_select on wm_messages for select to authenticated
  using (wm_can_read_channel(channel_id));
drop policy if exists wm_messages_insert on wm_messages;
create policy wm_messages_insert on wm_messages for insert to authenticated
  with check (user_id = auth.uid() and wm_can_post_channel(channel_id));
drop policy if exists wm_messages_delete on wm_messages;
create policy wm_messages_delete on wm_messages for delete to authenticated
  using (user_id = auth.uid() or wm_is_admin());

drop policy if exists wm_reactions_select on wm_reactions;
create policy wm_reactions_select on wm_reactions for select to authenticated
  using (exists (select 1 from wm_messages m where m.id = message_id and wm_can_read_channel(m.channel_id)));
drop policy if exists wm_reactions_insert on wm_reactions;
create policy wm_reactions_insert on wm_reactions for insert to authenticated
  with check (user_id = auth.uid()
    and exists (select 1 from wm_messages m where m.id = message_id and wm_can_read_channel(m.channel_id)));
drop policy if exists wm_reactions_delete on wm_reactions;
create policy wm_reactions_delete on wm_reactions for delete to authenticated using (user_id = auth.uid());

-- Prodotti: lettura ai membri, scrittura all'admin
drop policy if exists wm_products_select on wm_products;
create policy wm_products_select on wm_products for select to authenticated using (wm_is_member());
drop policy if exists wm_products_admin on wm_products;
create policy wm_products_admin on wm_products for all to authenticated
  using (wm_is_admin()) with check (wm_is_admin());

-- Proprieta: ognuno vede le sue, l'admin tutte (le scritture le fa solo il server)
drop policy if exists wm_ownerships_select on wm_ownerships;
create policy wm_ownerships_select on wm_ownerships for select to authenticated
  using (user_id = auth.uid() or wm_is_admin());

-- Opere: tabella base solo admin (i membri usano le viste wm_pieces_public / wm_piece_timeline)
drop policy if exists wm_pieces_admin on wm_pieces;
create policy wm_pieces_admin on wm_pieces for all to authenticated
  using (wm_is_admin()) with check (wm_is_admin());
drop policy if exists wm_piece_events_admin on wm_piece_events;
create policy wm_piece_events_admin on wm_piece_events for all to authenticated
  using (wm_is_admin()) with check (wm_is_admin());

-- Ritrovamenti
drop policy if exists wm_found_select on wm_found_requests;
create policy wm_found_select on wm_found_requests for select to authenticated
  using (user_id = auth.uid() or wm_is_admin());
drop policy if exists wm_found_update on wm_found_requests;
create policy wm_found_update on wm_found_requests for update to authenticated
  using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid());

-- Passaggi
drop policy if exists wm_transfers_select on wm_transfers;
create policy wm_transfers_select on wm_transfers for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or wm_is_admin());

-- Gare
drop policy if exists wm_events_select on wm_events;
create policy wm_events_select on wm_events for select to authenticated using (wm_is_member());
drop policy if exists wm_events_admin on wm_events;
create policy wm_events_admin on wm_events for all to authenticated
  using (wm_is_admin()) with check (wm_is_admin());

drop policy if exists wm_entries_select on wm_event_entries;
create policy wm_entries_select on wm_event_entries for select to authenticated using (wm_is_member());
drop policy if exists wm_entries_insert on wm_event_entries;
create policy wm_entries_insert on wm_event_entries for insert to authenticated
  with check (user_id = auth.uid() and wm_is_member()
    and exists (select 1 from wm_events e where e.id = event_id and e.closed_at is null and e.ends_at > now()));
drop policy if exists wm_entries_delete on wm_event_entries;
create policy wm_entries_delete on wm_event_entries for delete to authenticated
  using (user_id = auth.uid()
    and exists (select 1 from wm_events e where e.id = event_id and e.closed_at is null and e.ends_at > now()));

drop policy if exists wm_results_select on wm_event_results;
create policy wm_results_select on wm_event_results for select to authenticated using (wm_is_member());

-- Badge e attivita: solo i propri (l'admin vede tutto)
drop policy if exists wm_badges_select on wm_user_badges;
create policy wm_badges_select on wm_user_badges for select to authenticated
  using (user_id = auth.uid() or wm_is_admin());
drop policy if exists wm_activity_select on wm_activity;
create policy wm_activity_select on wm_activity for select to authenticated
  using (user_id = auth.uid() or wm_is_admin());

-- Ordini non riconosciuti: solo admin
drop policy if exists wm_unmatched_admin on wm_unmatched_items;
create policy wm_unmatched_admin on wm_unmatched_items for select to authenticated using (wm_is_admin());

-- Viste: solo utenti loggati
revoke all on wm_pieces_public, wm_piece_timeline, wm_product_stats from anon;
grant select on wm_pieces_public, wm_piece_timeline, wm_product_stats to authenticated;

-- wm_codes, wm_redeem_attempts, wm_webhook_log, wm_emails_log, wm_product_counters:
-- RLS attiva e nessuna policy => accessibili solo con la chiave service_role (server).

-- =====================================================================
-- Storage
-- =====================================================================
insert into storage.buckets (id, name, public) values ('wm-art', 'wm-art', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('wm-found', 'wm-found', false)
  on conflict (id) do nothing;

drop policy if exists "wm-art admin write" on storage.objects;
create policy "wm-art admin write" on storage.objects for all to authenticated
  using (bucket_id = 'wm-art' and wm_is_admin())
  with check (bucket_id = 'wm-art' and wm_is_admin());

drop policy if exists "wm-found own upload" on storage.objects;
create policy "wm-found own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'wm-found' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wm-found own read" on storage.objects;
create policy "wm-found own read" on storage.objects for select to authenticated
  using (bucket_id = 'wm-found'
    and ((storage.foldername(name))[1] = auth.uid()::text or wm_is_admin()));

-- =====================================================================
-- Realtime per le chat
-- =====================================================================
do $$ begin
  alter publication supabase_realtime add table wm_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table wm_reactions;
exception when duplicate_object then null; when undefined_object then null; end $$;
