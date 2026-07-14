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
        event_type: "revoke",
        result: "admin_auth_failed",
      });
      return genericError(401);
    }

    const body = await req.json();
    const licenceId = String(body.licenceId || "").trim();
    if (!licenceId) return genericError(400);

    const supabase = getServiceClient();
    await supabase.from("pilot_licenses").update({ status: "revoked" }).eq("id", licenceId);
    await supabase
      .from("pilot_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("licence_id", licenceId)
      .is("revoked_at", null);

    await logEvent(supabase, {
      licence_id: licenceId,
      event_type: "revoke",
      result: "success",
    });

    return jsonResponse({ ok: true });
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Server error." }, 500);
  }
});
