-- Run once in the Supabase SQL editor for the Only Bird Nerds project.
-- Adds cloud storage for user-entered ("manual") sightings and a saved
-- home location, alongside the existing photo_overrides / location_pins /
-- trips / profiles tables.

create table if not exists manual_observations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  sci        text,
  lat        double precision not null,
  lon        double precision not null,
  date       date not null,
  time       text,
  count      text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_observations_user_id_idx on manual_observations(user_id);

alter table manual_observations enable row level security;

create policy "Users can view own manual observations"
  on manual_observations for select
  using (auth.uid() = user_id);

create policy "Users can insert own manual observations"
  on manual_observations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own manual observations"
  on manual_observations for update
  using (auth.uid() = user_id);

create policy "Users can delete own manual observations"
  on manual_observations for delete
  using (auth.uid() = user_id);

-- Saved "home" location, so quick-adding a house-list sighting doesn't
-- require re-pinning a location every time.
alter table profiles add column if not exists home_lat double precision;
alter table profiles add column if not exists home_lon double precision;
