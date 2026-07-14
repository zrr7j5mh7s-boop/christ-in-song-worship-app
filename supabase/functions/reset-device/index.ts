import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  corsHeaders,
  jsonResponse,
  genericError,
  getServiceClient,
  logEvent,
  verifyAdminToken,
} from "../_shared/pilot-license.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return genericError(405);

  try {
    if (!verifyAdminToken(req)) {
      await logEvent(getServiceClient(), {
        event_type: "reset_device",
        result: "admin_auth_failed",
      });
      return genericError(401);
    }

    const body = await req.json();
    const licenceId = String(body.licenceId || "").trim();
    const deviceId = String(body.deviceId || "").trim();
    if (!licenceId || !deviceId) return genericError(400);

    const supabase = getServiceClient();
    await supabase
      .from("pilot_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", deviceId)
      .eq("licence_id", licenceId);

    await logEvent(supabase, {
      licence_id: licenceId,
      device_id: deviceId,
      event_type: "reset_device",
      result: "success",
    });

    return jsonResponse({ ok: true, message: "Device reset. The pilot may activate again on this installation." });
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Server error." }, 500);
  }
});
