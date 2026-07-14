// Shared helpers for pilot licensing Edge Functions.
// Deploy with Supabase CLI. Never import service-role keys into the Electron app.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type ServiceClient = SupabaseClient;

export interface PilotLicenseRow {
  id: string;
  approved_email: string;
  organisation_name: string;
  status: string;
  starts_at: string;
  expires_at: string;
  max_devices: number;
  offline_grace_days: number;
  licence_code_hash: string;
}

export const DEVICE_PROOF_TYPE = "pilot-device-proof-v1";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pilot-client, x-pilot-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function genericError(status = 401) {
  return jsonResponse({ ok: false, error: "Authentication failed." }, status);
}

export function getServiceClient(): ServiceClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Server configuration error.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function constantTimeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

export function verifyAdminToken(req: Request) {
  const adminToken = Deno.env.get("PILOT_ADMIN_TOKEN");
  if (!adminToken) return false;
  const provided = req.headers.get("x-pilot-admin-token") || "";
  return constantTimeEqual(provided, adminToken);
}

export async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildCanonicalDeviceProofPayload(input: {
  challenge: string;
  licenceId: string;
  deviceId: string;
  installationIdHash: string;
  appVersion: string;
}) {
  return JSON.stringify({
    type: DEVICE_PROOF_TYPE,
    challenge: input.challenge,
    licenceId: input.licenceId,
    deviceId: input.deviceId,
    installationIdHash: input.installationIdHash,
    appVersion: input.appVersion,
  });
}

export function isValidEd25519PublicKeyPem(publicKeyPem: string) {
  const normalized = String(publicKeyPem || "").trim();
  if (!normalized.includes("BEGIN PUBLIC KEY")) return false;
  try {
    const pemBody = normalized
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\s+/g, "");
    if (!pemBody) return false;
    const raw = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
    return raw.length > 0;
  } catch {
    return false;
  }
}

export async function importEd25519PublicKey(publicKeyPem: string) {
  const normalized = publicKeyPem.replace(/\\n/g, "\n").trim();
  const pemBody = normalized
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", raw, { name: "Ed25519" }, false, ["verify"]);
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function verifyDeviceProofSignature(
  publicKeyPem: string,
  canonicalPayload: string,
  signatureBase64Url: string,
) {
  if (!publicKeyPem || !canonicalPayload || !signatureBase64Url) {
    return { ok: false, reason: "missing_proof_material" };
  }
  try {
    const key = await importEd25519PublicKey(publicKeyPem);
    const signature = decodeBase64Url(signatureBase64Url);
    const valid = await crypto.subtle.verify(
      "Ed25519",
      key,
      signature,
      new TextEncoder().encode(canonicalPayload),
    );
    return { ok: valid, reason: valid ? "ok" : "invalid_signature" };
  } catch {
    return { ok: false, reason: "verify_failed" };
  }
}

export function generateChallengeValue() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueDeviceChallenge(
  supabase: ServiceClient,
  licenceId: string,
  deviceId: string,
) {
  const challenge = generateChallengeValue();
  const challengeHash = await sha256Hex(challenge);
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("pilot_device_challenges")
    .insert({
      licence_id: licenceId,
      device_id: deviceId,
      challenge_hash: challengeHash,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();
  if (error) throw error;
  return {
    challengeId: data.id as string,
    challenge,
    expiresAt: data.expires_at as string,
  };
}

export async function consumeDeviceChallenge(
  supabase: ServiceClient,
  input: {
    challengeId: string;
    challenge: string;
    licenceId: string;
    deviceId: string;
  },
) {
  const challengeHash = await sha256Hex(input.challenge);
  const { data: row, error } = await supabase
    .from("pilot_device_challenges")
    .select("*")
    .eq("id", input.challengeId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { ok: false, reason: "challenge_not_found" };
  const challengeRow = row as {
    licence_id: string;
    device_id: string;
    challenge_hash: string;
    expires_at: string;
    used_at: string | null;
  };
  if (challengeRow.licence_id !== input.licenceId || challengeRow.device_id !== input.deviceId) {
    return { ok: false, reason: "challenge_binding_mismatch" };
  }
  if (challengeRow.used_at) return { ok: false, reason: "challenge_reused" };
  if (new Date(challengeRow.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "challenge_expired" };
  }
  if (challengeRow.challenge_hash !== challengeHash) {
    return { ok: false, reason: "challenge_invalid" };
  }

  const { error: updateError } = await supabase
    .from("pilot_device_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("id", input.challengeId)
    .is("used_at", null);
  if (updateError) throw updateError;

  return { ok: true, reason: "ok" };
}

export async function verifyDeviceProof(
  supabase: ServiceClient,
  input: {
    licenceId: string;
    deviceId: string;
    installationIdHash: string;
    appVersion: string;
    challengeId: string;
    challenge: string;
    deviceSignature: string;
    devicePublicKey: string;
  },
) {
  if (!input.devicePublicKey) {
    return { ok: false, reason: "missing_device_public_key" };
  }
  if (!isValidEd25519PublicKeyPem(input.devicePublicKey)) {
    return { ok: false, reason: "malformed_device_public_key" };
  }

  const challengeCheck = await consumeDeviceChallenge(supabase, {
    challengeId: input.challengeId,
    challenge: input.challenge,
    licenceId: input.licenceId,
    deviceId: input.deviceId,
  });
  if (!challengeCheck.ok) return challengeCheck;

  const canonicalPayload = buildCanonicalDeviceProofPayload({
    challenge: input.challenge,
    licenceId: input.licenceId,
    deviceId: input.deviceId,
    installationIdHash: input.installationIdHash,
    appVersion: input.appVersion,
  });

  const signatureCheck = await verifyDeviceProofSignature(
    input.devicePublicKey,
    canonicalPayload,
    input.deviceSignature,
  );
  if (!signatureCheck.ok) return { ok: false, reason: signatureCheck.reason };
  return { ok: true, reason: "ok" };
}

export async function signToken(payload: Record<string, unknown>) {
  const privateKeyPem = Deno.env.get("PILOT_LICENSE_SIGNING_PRIVATE_KEY");
  if (!privateKeyPem) throw new Error("Signing key not configured.");
  const normalized = privateKeyPem.replace(/\\n/g, "\n");
  const pemBody = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = btoa(payloadJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signature = await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(payloadJson));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${payloadB64}.${sigB64}`;
}

export async function logEvent(
  supabase: ServiceClient,
  entry: {
    licence_id?: string | null;
    device_id?: string | null;
    event_type: string;
    result: string;
    app_version?: string | null;
  },
) {
  await supabase.from("pilot_validation_events").insert(entry);
}

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function hasStarted(startsAt: string) {
  return new Date(startsAt).getTime() <= Date.now();
}

export async function loadLicenseByCodeHash(
  supabase: ServiceClient,
  codeHash: string,
): Promise<PilotLicenseRow | null> {
  const { data, error } = await supabase
    .from("pilot_licenses")
    .select("*")
    .eq("licence_code_hash", codeHash)
    .maybeSingle();
  if (error) throw error;
  return data as PilotLicenseRow | null;
}

export async function countActiveDevices(supabase: ServiceClient, licenceId: string) {
  const { count, error } = await supabase
    .from("pilot_devices")
    .select("id", { count: "exact", head: true })
    .eq("licence_id", licenceId)
    .is("revoked_at", null);
  if (error) throw error;
  return count || 0;
}
