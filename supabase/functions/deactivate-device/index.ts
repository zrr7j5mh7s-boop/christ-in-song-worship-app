import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  jsonResponse,
  genericError,
  getServiceClient,
  sha256Hex,
  logEvent,
  verifyAdminToken,
  verifyDeviceProof,
} from "../_shared/pilot-license.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return genericError(405);

  try {
    const body = await req.json();
    const licenceId = String(body.licenceId || "").trim();
    const deviceId = String(body.deviceId || "").trim();
    const installationId = String(body.installationId || "").trim();
    const appVersion = String(body.appVersion || "").slice(0, 40);
    const selfDeactivate = Boolean(body.selfDeactivate);

    if (!licenceId || !deviceId || !installationId) return genericError(400);

    const supabase = getServiceClient();
    const installationHash = await sha256Hex(installationId);

    const { data: device } = await supabase
      .from("pilot_devices")
      .select("*")
      .eq("id", deviceId)
      .eq("licence_id", licenceId)
      .maybeSingle();

    if (!device || device.installation_id_hash !== installationHash) {
      await logEvent(supabase, {
        licence_id: licenceId,
        device_id: deviceId,
        event_type: "deactivate",
        result: "device_mismatch",
        app_version: appVersion,
      });
      return genericError(403);
    }

    if (!selfDeactivate) {
      if (!verifyAdminToken(req)) {
        await logEvent(supabase, {
          licence_id: licenceId,
          device_id: deviceId,
          event_type: "deactivate",
          result: "admin_auth_failed",
        });
        return genericError(401);
      }
    } else {
      const challengeId = String(body.challengeId || "").trim();
      const challenge = String(body.challenge || "").trim();
      const deviceSignature = String(body.deviceSignature || "").trim();

      if (!challengeId || !challenge || !deviceSignature) {
        await logEvent(supabase, {
          licence_id: licenceId,
          device_id: deviceId,
          event_type: "deactivate",
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
          event_type: "deactivate",
          result: proof.reason,
          app_version: appVersion,
        });
        return genericError(403);
      }
    }

    await supabase
      .from("pilot_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", deviceId);

    await logEvent(supabase, {
      licence_id: licenceId,
      device_id: deviceId,
      event_type: "deactivate",
      result: selfDeactivate ? "self_success" : "admin_success",
      app_version: appVersion,
    });

    return jsonResponse({ ok: true });
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Server error." }, 500);
  }
});
