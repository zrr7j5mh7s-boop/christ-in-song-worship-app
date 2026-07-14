# Pilot licensing database setup

## Prerequisites

- Supabase project with PostgreSQL
- Supabase CLI (`supabase`) for migrations and Edge Function deployment

## Apply schema

Run the migration:

```bash
supabase db push
```

Or execute manually in the SQL editor:

`supabase/migrations/202607140001_pilot_licensing.sql`

This creates:

- `pilot_licenses`
- `pilot_devices`
- `pilot_validation_events`
- `pilot_device_challenges` (from `202607142100_pilot_device_challenges.sql`)

Row Level Security denies all direct client access. Edge Functions use the service role.

## Edge Function authentication

The Electron app does not use Supabase Auth. Configure `supabase/config.toml` so only the five licensing functions use `verify_jwt = false`. Each function authenticates via:

- **activate-license** — hashed activation code + approved email + Ed25519 device public key
- **validate-license** — server-issued challenge + Ed25519 device proof (`crypto.subtle.verify`)
- **deactivate-device** — device proof for self-deactivate, or `PILOT_ADMIN_TOKEN` for admin
- **revoke-license** / **reset-device** — `PILOT_ADMIN_TOKEN` only (constant-time comparison)

Device proof uses a canonical JSON payload signed by the device private key stored in Electron `safeStorage` (main process only).

## Edge Functions

Deploy from the repository root:

```bash
supabase functions deploy activate-license
supabase functions deploy validate-license
supabase functions deploy deactivate-device
supabase functions deploy revoke-license
supabase functions deploy reset-device
```

## Required function secrets

Set in Supabase project settings → Edge Functions → Secrets:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project API URL (usually auto-provided) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for database writes |
| `PILOT_LICENSE_SIGNING_PRIVATE_KEY` | Ed25519 PKCS#8 PEM used to sign licence tokens |
| `PILOT_ADMIN_TOKEN` | Bearer token for `revoke-license` and `reset-device` |

Generate a signing key pair locally:

```bash
openssl genpkey -algorithm ED25519 -out pilot-signing-private.pem
openssl pkey -in pilot-signing-private.pem -pubout -out pilot-signing-public.pem
```

Store `pilot-signing-private.pem` only in Supabase secrets. Ship `pilot-signing-public.pem` to the Electron build as `src/license/license-public-key.pem`.

## Audit trail

`pilot_validation_events` records activation, validation, revocation, and device reset attempts. Review this table when investigating support cases.

## Verification

After deployment, test activation with curl (replace project URL and credentials):

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/activate-license" \
  -H "Content-Type: application/json" \
  -d '{"email":"pilot@example.org","activationCode":"PILOT-EXAMPLE","installationId":"test-install","devicePublicKey":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}'
```

Expect `Authentication failed.` until a licence row exists for the hashed activation code.
