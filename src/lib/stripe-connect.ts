import crypto from "crypto";

/**
 * Stripe Connect OAuth (Standard accounts).
 *
 * Flow:
 * 1. buildAuthorizeUrl(tenantId) -> link wysyłany / pokazywany klientowi
 * 2. Klient loguje się na Stripe i zatwierdza dostęp
 * 3. Stripe odsyła na jeden zarejestrowany redirect_uri z ?code=...&state=...
 * 4. /api/stripe/oauth/callback weryfikuje state, woła exchangeCodeForAccountId,
 *    zapisuje tenant.stripeAccountId
 */

const STATE_TTL_MS = 15 * 60 * 1000; // 15 min

function getSecret() {
  const secret = process.env.AGENCY_API_SECRET;
  if (!secret) throw new Error("Brak AGENCY_API_SECRET w zmiennych środowiskowych");
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Tworzy podpisany, samowystarczalny `state` z tenantId + timestamp. */
export function createState(tenantId: string): string {
  const payload = `${tenantId}.${Date.now()}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

/** Weryfikuje `state` zwrócony przez Stripe i wyciąga tenantId. Zwraca null jeśli nieprawidłowy/wygasły. */
export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [tenantId, ts, sig] = decoded.split(".");
    if (!tenantId || !ts || !sig) return null;

    const expected = sign(`${tenantId}.${ts}`);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

    if (Date.now() - Number(ts) > STATE_TTL_MS) return null;

    return tenantId;
  } catch {
    return null;
  }
}

function getRedirectUri() {
  const baseUrl = process.env.AGENCY_APP_URL;
  if (!baseUrl) throw new Error("Brak AGENCY_APP_URL w zmiennych środowiskowych");
  return `${baseUrl.replace(/\/$/, "")}/api/stripe/oauth/callback`;
}

/** Link, na który ma kliknąć klient, aby połączyć swoje konto Stripe. */
export function buildAuthorizeUrl(tenantId: string): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
  if (!clientId) throw new Error("Brak STRIPE_CONNECT_CLIENT_ID w zmiennych środowiskowych");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_write",
    redirect_uri: getRedirectUri(),
    state: createState(tenantId),
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

/** Wymienia `code` z callbacku na connected account id (stripe_user_id). */
export async function exchangeCodeForAccountId(code: string): Promise<string> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Brak STRIPE_SECRET_KEY w zmiennych środowiskowych");

  const res = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_secret: secretKey,
      code,
      grant_type: "authorization_code",
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error_description || body?.error || "Stripe OAuth token exchange failed");
  }

  return body.stripe_user_id as string;
}
