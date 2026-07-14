import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  jsonResponse,
  genericError,
  getServiceClient,
  sha256Hex,
  signToken,
  logEvent,
  normalizeEmail,
  isExpired,
  hasStarted,
  loadLicenseByCodeHash,
  countActiveDevices,
  isValidEd25519PublicKeyPem,
} from "../_shared/pilot-license.ts";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }
  entry.count += 1;
  attempts.set(key, entry);
  return entry.count <= RATE_MAX;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return genericError(405);

  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const code = String(body.activationCode || body.code || "").trim();
    const installationId = String(body.installationId || "").trim();
    const devicePublicKey = String(body.devicePublicKey || "").trim();
    const deviceName = String(body.deviceName || "Pilot Device").trim().slice(0, 120);
    const platform = String(body.platform || "").slice(0, 40);
    const architecture = String(body.architecture || "").slice(0, 40);
    const appVersion = String(body.appVersion || "").slice(0, 40);

    if (!email || !code || !installationId || !devicePublicKey) {
      return genericError(400);
    }

    const supabase = getServiceClient();

    if (!isValidEd25519PublicKeyPem(devicePublicKey)) {
      await logEvent(supabase, {
        event_type: "activate",
        result: "malformed_device_public_key",
        app_version: appVersion,
      });
      return genericError(400);
    }

    const rateKey = `${req.headers.get("x-forwarded-for") || "local"}:${email}`;
    if (!rateLimit(rateKey)) return jsonResponse({ ok: false, error: "Too many attempts." }, 429);

    const codeHash = await sha256Hex(code);
    const installationHash = await sha256Hex(installationId);
    const license = await loadLicenseByCodeHash(supabase, codeHash);

    if (!license || license.approved_email !== email) {
      await logEvent(supabase, {
        licence_id: license?.id || null,
        event_type: "activate",
        result: "invalid_credentials",
        app_version: appVersion,
      });
      return genericError();
    }

    if (license.status === "revoked") {
      await logEvent(supabase, { licence_id: license.id, event_type: "activate", result: "revoked", app_version: appVersion });
      return genericError(403);
    }

    if (!hasStarted(license.starts_at)) {
      await logEvent(supabase, { licence_id: license.id, event_type: "activate", result: "not_started", app_version: appVersion });
      return genericError(403);
    }

    if (isExpired(license.expires_at)) {
      await supabase.from("pilot_licenses").update({ status: "expired" }).eq("id", license.id);
      await logEvent(supabase, { licence_id: license.id, event_type: "activate", result: "expired", app_version: appVersion });
      return genericError(403);
    }

    const { data: existingDevice } = await supabase
      .from("pilot_devices")
      .select("*")
      .eq("licence_id", license.id)
      .eq("installation_id_hash", installationHash)
      .maybeSingle();

    if (existingDevice?.revoked_at) {
      await logEvent(supabase, {
        licence_id: license.id,
        device_id: existingDevice.id,
        event_type: "activate",
        result: "device_revoked",
        app_version: appVersion,
      });
      return genericError(403);
    }

    let device = existingDevice;
    if (!device) {
      const activeCount = await countActiveDevices(supabase, license.id);
      if (activeCount >= license.max_devices) {
        await logEvent(supabase, {
          licence_id: license.id,
          event_type: "activate",
          result: "device_limit",
          app_version: appVersion,
        });
        return genericError(403);
      }

      const { data: inserted, error: insertError } = await supabase
        .from("pilot_devices")
        .insert({
          licence_id: license.id,
          installation_id_hash: installationHash,
          device_public_key: devicePublicKey,
          device_name: deviceName,
          platform,
          architecture,
          app_version: appVersion,
          last_validated_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      device = inserted;
    } else {
      await supabase
        .from("pilot_devices")
        .update({
          device_public_key: devicePublicKey,
          device_name: deviceName,
          platform,
          architecture,
          app_version: appVersion,
          last_validated_at: new Date().toISOString(),
        })
        .eq("id", device.id);
    }

    const serverTime = Date.now();
    const offlineGraceDeadline = serverTime + license.offline_grace_days * 24 * 60 * 60 * 1000;
    const token = await signToken({
      licenceId: license.id,
      deviceId: device.id,
      organisationName: license.organisation_name,
      approvedEmail: license.approved_email,
      installationIdHash: installationHash,
      issuedAt: serverTime,
      expiresAt: new Date(license.expires_at).getTime(),
      offlineGraceDeadline,
      serverTime,
      status: license.status,
    });

    await logEvent(supabase, {
      licence_id: license.id,
      device_id: device.id,
      event_type: "activate",
      result: "success",
      app_version: appVersion,
    });

    return jsonResponse({
      ok: true,
      licenceId: license.id,
      deviceId: device.id,
      organisationName: license.organisation_name,
      expiresAt: license.expires_at,
      offlineGraceDays: license.offline_grace_days,
      serverTime,
      signedToken: token,
      status: license.status,
    });
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Server error." }, 500);
  }
});
