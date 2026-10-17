-- PixelForge cloud schema. Run once in the Supabase SQL Editor (or `supabase db push`).
-- Visibility is 'private' or 'public' only (no unlisted links: they cannot be made secure with plain RLS).
create table public.artworks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  preset      text not null check (preset in ('cosmic', 'neon', 'orbit', 'waves', 'bloom')),
  settings    jsonb not null check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 4000),
  visibility  text not null default 'private' check (visibility in ('private', 'public')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index artworks_owner_idx  on public.artworks (owner_id, updated_at desc);
create index artworks_public_idx on public.artworks (updated_at desc) where visibility = 'public';

-- Server-side: bump updated_at and make owner_id immutable (cannot be forged by an UPDATE).
create function public.artworks_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.owner_id   := old.owner_id;
  return new;
end $$;
create trigger artworks_touch before update on public.artworks
  for each row execute function public.artworks_touch();

alter table public.artworks enable row level security;

create policy "read own or public" on public.artworks for select
  using (visibility = 'public' or owner_id = (select auth.uid()));
create policy "insert own" on public.artworks for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "update own" on public.artworks for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own" on public.artworks for delete to authenticated
  using (owner_id = (select auth.uid()));
