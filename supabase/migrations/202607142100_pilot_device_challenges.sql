-- VaChinoda Worship App — device challenge-response for proof-of-possession
-- Run via Supabase SQL editor or `supabase db push`.

create table if not exists public.pilot_device_challenges (
  id uuid primary key default gen_random_uuid(),
  licence_id uuid not null references public.pilot_licenses(id) on delete cascade,
  device_id uuid not null references public.pilot_devices(id) on delete cascade,
  challenge_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pilot_device_challenges_device_id_idx
  on public.pilot_device_challenges (device_id);

create index if not exists pilot_device_challenges_expires_at_idx
  on public.pilot_device_challenges (expires_at);

create index if not exists pilot_device_challenges_licence_device_idx
  on public.pilot_device_challenges (licence_id, device_id, created_at desc);

alter table public.pilot_device_challenges enable row level security;

create policy pilot_device_challenges_no_client on public.pilot_device_challenges
  for all using (false) with check (false);
