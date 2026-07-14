# Recovery and device reset guide

## Operator: deactivate on this device

When a licence should move to a new computer:

1. Open **Settings → Controlled Pilot Licence**.
2. Tap **Deactivate on this device**.
3. Install and activate on the replacement machine with the same email and activation code (if still valid).

Deactivation calls the `deactivate-device` Edge Function with installation proof, then clears the encrypted local licence cache.

## Administrator: reset a bound device

When the operator cannot deactivate locally (hardware failure, lost machine):

```bash
curl -sS -X POST "$SUPABASE_URL/functions/v1/reset-device" \
  -H "Authorization: Bearer $PILOT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"licenceId":"LICENCE_UUID_HERE","deviceId":"DEVICE_UUID_HERE"}'
```

This revokes the device row so a new installation can activate within `max_devices`.

## Common error states

| Status | Meaning | Recovery |
| --- | --- | --- |
| `not_activated` | No local licence cache | Activate with approved email and code |
| `expired` | Past `expires_at` or offline grace | Renew licence; validate online |
| `revoked` | Licence revoked server-side | Contact administrator |
| `device_mismatch` | Cache copied or clock unreliable | Deactivate and reactivate; fix system clock |
| `validation_unavailable` | Server unreachable beyond grace | Restore network; use Settings → Validate |
| `server_configuration_error` | App missing public key or API base | Reinstall pilot build with correct configuration |

## Data safety

Expired, revoked, or mismatched licences **do not delete** hymn packs, Bible data, favourites, or builder plans. Backup export remains available from Settings.

## Support checklist

1. Confirm licence row status and expiry in `pilot_licenses`.
2. Check `pilot_devices` for active bindings.
3. Review recent rows in `pilot_validation_events`.
4. If needed, reset device server-side and ask operator to reactivate.
5. For clock rollback messages, verify OS automatic time sync.

## Offline worship during grace

The worship library remains fully offline. Only live presentation, projection, OBS output, and related operator outputs are gated after expiry, revocation, or grace exhaustion.
