-- VaChinoda Worship App — Controlled Pilot Licensing
-- Run via Supabase SQL editor or `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.pilot_licenses (
  id uuid primary key default gen_random_uuid(),
  licence_code_hash text not null unique,
  approved_email text not null,
  organisation_name text not null,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired', 'suspended')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_devices integer not null default 1 check (max_devices >= 1),
  offline_grace_days integer not null default 7 check (offline_grace_days >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_devices (
  id uuid primary key default gen_random_uuid(),
  licence_id uuid not null references public.pilot_licenses(id) on delete cascade,
  installation_id_hash text not null,
  device_public_key text not null,
  device_name text not null default 'Pilot Device',
  platform text,
  architecture text,
  app_version text,
  activated_at timestamptz not null default now(),
  last_validated_at timestamptz,
  revoked_at timestamptz,
  unique (licence_id, installation_id_hash)
);

create table if not exists public.pilot_validation_events (
  id uuid primary key default gen_random_uuid(),
  licence_id uuid references public.pilot_licenses(id) on delete set null,
  device_id uuid references public.pilot_devices(id) on delete set null,
  event_type text not null,
  result text not null,
  app_version text,
  created_at timestamptz not null default now()
);

create index if not exists pilot_devices_licence_id_idx on public.pilot_devices (licence_id);
create index if not exists pilot_devices_installation_hash_idx on public.pilot_devices (installation_id_hash);
create index if not exists pilot_validation_events_licence_id_idx on public.pilot_validation_events (licence_id);
create index if not exists pilot_validation_events_created_at_idx on public.pilot_validation_events (created_at desc);

create or replace function public.touch_pilot_license_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pilot_licenses_touch_updated_at on public.pilot_licenses;
create trigger pilot_licenses_touch_updated_at
before update on public.pilot_licenses
for each row execute function public.touch_pilot_license_updated_at();

alter table public.pilot_licenses enable row level security;
alter table public.pilot_devices enable row level security;
alter table public.pilot_validation_events enable row level security;

-- No direct client access. Edge Functions use service role.
create policy pilot_licenses_no_client on public.pilot_licenses
  for all using (false) with check (false);

create policy pilot_devices_no_client on public.pilot_devices
  for all using (false) with check (false);

create policy pilot_validation_events_no_client on public.pilot_validation_events
  for all using (false) with check (false);

-- Admin helper: create a licence (run from SQL editor with service role only).
-- Example:
-- insert into pilot_licenses (licence_code_hash, approved_email, organisation_name, expires_at)
-- values (
--   encode(digest('PILOT-EXAMPLE-CODE', 'sha256'), 'hex'),
--   'pilot@example.org',
--   'Example SDA Church',
--   now() + interval '45 days'
-- );
