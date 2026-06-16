import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyState, exchangeCodeForAccountId } from "@/lib/stripe-connect";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error_description") || searchParams.get("error");

  if (errorParam) {
    return redirectWithStatus(state, "error", errorParam);
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Brak code/state w odpowiedzi Stripe" }, { status: 400 });
  }

  const tenantId = verifyState(state);
  if (!tenantId) {
    return NextResponse.json({ error: "Nieprawidłowy lub wygasły state" }, { status: 400 });
  }

  try {
    const stripeAccountId = await exchangeCodeForAccountId(code);

    await db
      .update(tenants)
      .set({ stripeAccountId })
      .where(eq(tenants.id, tenantId));

    // Best-effort: przekaż connected account id do docelowej apki klienta
    // (np. hair-saas / course-saas), żeby mogła faktycznie kierować na nie płatności.
    // Niepowodzenie tego kroku nie unieważnia samego połączenia OAuth.
    let pushWarning: string | undefined;
    try {
      await notifyProductApp(tenantId, stripeAccountId);
    } catch (e) {
      pushWarning = e instanceof Error ? e.message : String(e);
      console.error(`[stripe-oauth-callback] notifyProductApp failed:`, pushWarning);
    }

    return redirectWithStatus(state, "connected", pushWarning ? `Połączono, ale nie przekazano do apki: ${pushWarning}` : undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return redirectWithStatus(state, "error", msg);
  }
}

async function notifyProductApp(tenantId: string, stripeAccountId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) throw new Error("Tenant nie znaleziony");

  const [product] = await db.select().from(products).where(eq(products.id, tenant.productId)).limit(1);
  if (!product?.appUrl) throw new Error("Produkt nie ma ustawionego appUrl");

  const agencySecret = process.env.AGENCY_API_SECRET;
  if (!agencySecret) throw new Error("Brak AGENCY_API_SECRET");

  const res = await fetch(`${product.appUrl.replace(/\/$/, "")}/api/stripe/connected`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agency-secret": agencySecret,
    },
    body: JSON.stringify({
      tenantId,
      slug: tenant.slug,
      stripeAccountId,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apka odpowiedziała ${res.status}: ${body.slice(0, 200)}`);
  }
}

function redirectWithStatus(state: string | null, status: "connected" | "error", message?: string) {
  const tenantId = state ? verifyState(state) : null;
  const base = process.env.AGENCY_APP_URL?.replace(/\/$/, "") || "";
  const target = tenantId
    ? `${base}/dashboard/clients/${tenantId}`
    : `${base}/dashboard/clients`;

  const url = new URL(target);
  url.searchParams.set("stripe", status);
  if (message) url.searchParams.set("stripe_error", message);

  return NextResponse.redirect(url);
}
