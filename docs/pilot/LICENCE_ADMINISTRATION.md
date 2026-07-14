# Licence administration guide

## Create the first pilot licence

1. Choose an activation code (share securely with the pilot church, e.g. `PILOT-ST-JOHN-2026`).
2. Hash the code with SHA-256 (never store the plaintext code in the database).
3. Insert a licence row for the approved email and organisation.

### SQL example

```sql
insert into public.pilot_licenses (
  licence_code_hash,
  approved_email,
  organisation_name,
  status,
  starts_at,
  expires_at,
  max_devices,
  offline_grace_days
) values (
  encode(digest('PILOT-ST-JOHN-2026', 'sha256'), 'hex'),
  'media@stjohn.example.org',
  'St John SDA Church',
  'active',
  now(),
  now() + interval '45 days',
  1,
  7
);
```

Send the pilot administrator:

- Approved email: `media@stjohn.example.org`
- Activation code: `PILOT-ST-JOHN-2026` (out-of-band, not via the database)
- Installer download link

## Renew or extend a licence

Update `expires_at` and set `status = 'active'` if previously expired:

```sql
update public.pilot_licenses
set expires_at = now() + interval '45 days',
    status = 'active'
where id = 'LICENCE_UUID_HERE';
```

The desktop app picks up the new expiry on the next successful validation (within 24 hours) or when the operator taps **Validate licence now** in Settings.

## Revoke a licence

Use the `revoke-license` Edge Function (admin token required):

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/revoke-license" \
  -H "Authorization: Bearer $PILOT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"licenceId":"LICENCE_UUID_HERE","reason":"pilot ended"}'
```

Revoked licences block live outputs on the next validation. Offline grace may apply until the grace deadline.

## View active devices

```sql
select d.id, d.device_name, d.platform, d.architecture, d.app_version,
       d.activated_at, d.last_validated_at, d.revoked_at
from public.pilot_devices d
where d.licence_id = 'LICENCE_UUID_HERE'
order by d.activated_at desc;
```

## Increase device limit (exception only)

```sql
update public.pilot_licenses
set max_devices = 2
where id = 'LICENCE_UUID_HERE';
```

Default pilot policy remains **one device**.

## Review validation history

```sql
select event_type, result, app_version, created_at
from public.pilot_validation_events
where licence_id = 'LICENCE_UUID_HERE'
order by created_at desc
limit 50;
```
