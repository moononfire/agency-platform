import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants, products } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-agency-secret");
  if (secret !== process.env.AGENCY_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Missing domain param" }, { status: 400 });
  }

  const tenantFields = {
    id: tenants.id,
    slug: tenants.slug,
    productId: tenants.productId,
    status: tenants.status,
    schemaVersion: tenants.schemaVersion,
    customDomain: tenants.customDomain,
    businessName: tenants.businessName,
    logoUrl: tenants.logoUrl,
    primaryColor: tenants.primaryColor,
  };

  // Match by custom domain or by subdomain pattern (slug.baseDomain)
  const allTenants = await db
    .select(tenantFields)
    .from(tenants)
    .where(or(eq(tenants.customDomain, domain)));

  // Also check slug-based subdomains
  const allProducts = await db
    .select({ id: products.id, baseDomain: products.baseDomain })
    .from(products);

  let match = allTenants[0] ?? null;

  if (!match) {
    for (const product of allProducts) {
      const suffix = `.${product.baseDomain}`;
      if (domain.endsWith(suffix)) {
        const slug = domain.slice(0, -suffix.length);
        const rows = await db
          .select(tenantFields)
          .from(tenants)
          .where(eq(tenants.slug, slug))
          .limit(1);
        if (rows[0]) {
          match = rows[0];
          break;
        }
      }
    }
  }

  if (!match) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    tenantId: match.id,
    slug: match.slug,
    productId: match.productId,
    status: match.status,
    schemaVersion: match.schemaVersion ?? "1",
    businessName: match.businessName,
    logoUrl: match.logoUrl ?? null,
    primaryColor: match.primaryColor ?? null,
  });
}
