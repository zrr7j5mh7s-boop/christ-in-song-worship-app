import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  jsonResponse,
  genericError,
  getServiceClient,
  sha256Hex,
  signToken,
  logEvent,
  isExpired,
  issueDeviceChallenge,
  verifyDeviceProof,
} from "../_shared/pilot-license.ts";

async function loadBoundDevice(
  supabase: ReturnType<typeof getServiceClient>,
  licenceId: string,
  deviceId: string,
  installationHash: string,
) {
  const { data: license } = await supabase.from("pilot_licenses").select("*").eq("id", licenceId).maybeSingle();
  if (!license) return { ok: false as const, reason: "license_not_found" };

  const { data: device } = await supabase
    .from("pilot_devices")
    .select("*")
    .eq("id", deviceId)
    .eq("licence_id", licenceId)
    .maybeSingle();

  if (!device || device.installation_id_hash !== installationHash) {
    return { ok: false as const, reason: "device_mismatch", license, device };
  }

  return { ok: true as const, license, device };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return genericError(405);

  try {
    const body = await req.json();
    const action = String(body.action || "validate").trim().toLowerCase();
    const licenceId = String(body.licenceId || "").trim();
    const deviceId = String(body.deviceId || "").trim();
    const installationId = String(body.installationId || "").trim();
    const appVersion = String(body.appVersion || "").slice(0, 40);

    if (!licenceId || !deviceId || !installationId) return genericError(400);

    const supabase = getServiceClient();
    const installationHash = await sha256Hex(installationId);
    const bound = await loadBoundDevice(supabase, licenceId, deviceId, installationHash);

    if (!bound.ok) {
      await logEvent(supabase, {
        licence_id: licenceId,
        device_id: deviceId,
        event_type: action === "challenge" ? "challenge" : "validate",
        result: bound.reason,
        app_version: appVersion,
      });
      return genericError(403);
    }

    const { license, device } = bound;

    if (device.revoked_at) {
      await logEvent(supabase, {
        licence_id: licenceId,
        device_id: deviceId,
        event_type: action === "challenge" ? "challenge" : "validate",
        result: "device_revoked",
        app_version: appVersion,
      });
      return genericError(403);
    }

    if (license.status === "revoked") {
      await logEvent(supabase, {
        licence_id: licenceId,
        device_id: deviceId,
        event_type: action === "challenge" ? "challenge" : "validate",
        result: "revoked",
        app_version: appVersion,
      });
      return genericError(403);
    }

    if (isExpired(license.expires_at)) {
      await supabase.from("pilot_licenses").update({ status: "expired" }).eq("id", licenceId);
      await logEvent(supabase, {
        licence_id: licenceId,
        device_id: deviceId,
        event_type: action === "challenge" ? "challenge" : "validate",
        result: "expired",
        app_version: appVersion,
      });
      return genericError(403);
    }

    if (action === "challenge") {
      if (body.challenge || body.deviceSignature || body.challengeId) {
        await logEvent(supabase, {
          licence_id: licenceId,
          device_id: deviceId,
          event_type: "challenge",
          result: "client_challenge_rejected",
          app_version: appVersion,
        });
        return genericError(400);
      }

      const issued = await issueDeviceChallenge(supabase, licenceId, deviceId);
      await logEvent(supabase, {
        licence_id: licenceId,
        device_id: deviceId,
        event_type: "challenge",
        result: "issued",
        app_version: appVersion,
      });

      return jsonResponse({
        ok: true,
        action: "challenge",
        challengeId: issued.challengeId,
        challenge: issued.challenge,
        expiresAt: issued.expiresAt,
      });
    }

    const challengeId = String(body.challengeId || "").trim();
    const challenge = String(body.challenge || "").trim();
    const deviceSignature = String(body.deviceSignature || "").trim();

    if (!challengeId || !challenge || !deviceSignature) {
      await logEvent(supabase, {
        licence_id: licenceId,
        device_id: deviceId,
        event_type: "validate",
        result: "missing_device_proof",
        app_version: appVersion,
      });
      return genericError(400);
    }

    const proof = await verifyDeviceProof(supabase, {
      licenceId,
      deviceId,
      installationIdHash: installationHash,
      appVersion,
      challengeId,
      challenge,
      deviceSignature,
      devicePublicKey: device.device_public_key,
    });

    if (!proof.ok) {
      await logEvent(supabase, {
        licence_id: licenceId,
        device_id: deviceId,
        event_type: "validate",
        result: proof.reason,
        app_version: appVersion,
      });
      return genericError(403);
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

    await supabase
      .from("pilot_devices")
      .update({ last_validated_at: new Date(serverTime).toISOString(), app_version: appVersion })
      .eq("id", device.id);

    await logEvent(supabase, {
      licence_id: licenceId,
      device_id: deviceId,
      event_type: "validate",
      result: "success",
      app_version: appVersion,
    });

    return jsonResponse({
      ok: true,
      action: "validate",
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
