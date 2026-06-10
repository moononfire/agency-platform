"use server";

import { db } from "@/lib/db";
import { products, tenants, tenantOnboardings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { addDomain, removeDomain } from "@/lib/vercel-api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function createProduct(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = (formData.get("name") as string)?.trim();
  const vercelProjectId = (formData.get("vercelProjectId") as string)?.trim();
  const vercelToken = (formData.get("vercelToken") as string)?.trim();
  const baseDomain = (formData.get("baseDomain") as string)?.trim().toLowerCase();
  const appUrl = (formData.get("appUrl") as string)?.trim().replace(/\/$/, "");

  if (!name || !vercelProjectId || !vercelToken || !baseDomain || !appUrl) {
    return { error: "Wypełnij wszystkie pola" };
  }

  const id = crypto.randomUUID();
  await db.insert(products).values({ id, name, vercelProjectId, vercelToken, baseDomain, appUrl });

  revalidatePath("/dashboard/products");
  redirect(`/dashboard/products/${id}`);
}

export async function createTenant(
  productId: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) return { error: "Produkt nie istnieje" };

  const businessName = (formData.get("businessName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || undefined;
  const address = (formData.get("address") as string)?.trim() || undefined;
  const slug = (formData.get("slug") as string)?.trim().toLowerCase();
  const customDomain =
    (formData.get("customDomain") as string)?.trim() || undefined;
  const logoUrl = (formData.get("logoUrl") as string)?.trim() || undefined;
  const primaryColor =
    (formData.get("primaryColor") as string)?.trim() || undefined;
  const adminName = (formData.get("adminName") as string)?.trim();
  const adminEmail = (formData.get("adminEmail") as string)?.trim();
  const adminPassword = (formData.get("adminPassword") as string)?.trim();

  if (!businessName || !email || !slug) {
    return { error: "Wypełnij wymagane pola: nazwa firmy, email, subdomena" };
  }
  if (!adminName || !adminEmail || !adminPassword) {
    return { error: "Wypełnij dane konta admina" };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return {
      error: "Subdomena może zawierać tylko małe litery, cyfry i myślniki",
    };
  }

  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    return { error: "Ta subdomena jest już zajęta" };
  }

  const tenantId = crypto.randomUUID();

  await db.insert(tenants).values({
    id: tenantId,
    productId,
    slug,
    customDomain,
    status: "pending",
    businessName,
    email,
    phone,
    address,
    logoUrl,
    primaryColor,
  });

  await db.insert(tenantOnboardings).values({
    tenantId,
    currentStep: "6",
  });

  try {
    await addDomain(
      product.vercelProjectId,
      product.vercelToken,
      `${slug}.${product.baseDomain}`
    );
  } catch (e) {
    console.error("Failed to add subdomain:", e);
  }

  if (customDomain) {
    try {
      await addDomain(
        product.vercelProjectId,
        product.vercelToken,
        customDomain
      );
    } catch (e) {
      console.error("Failed to add custom domain:", e);
    }
  }

  await db
    .update(tenants)
    .set({ status: "active" })
    .where(eq(tenants.id, tenantId));

  await db
    .update(tenantOnboardings)
    .set({ completedAt: new Date() })
    .where(eq(tenantOnboardings.tenantId, tenantId));

  const agencySecret = process.env.AGENCY_API_SECRET;
  if (!agencySecret) {
    return { error: "Brak AGENCY_API_SECRET w zmiennych środowiskowych agencji" };
  }

  try {
    const res = await fetch(`${product.appUrl}/api/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agency-secret": agencySecret,
      },
      body: JSON.stringify({
        tenantId,
        adminName,
        adminEmail,
        adminPassword,
        services: (formData.get("services") as string) || "",
      }),
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("application/json")) {
      const body = await res.text();
      if (!contentType.includes("application/json")) {
        return { error: `Aplikacja (${product.appUrl}) zwróciła HTML zamiast JSON — prawdopodobnie blokuje requesty (middleware auth?). Sprawdź czy /api/setup jest dostępny bez logowania.` };
      }
      return { error: `Błąd tworzenia konta admina (${res.status}): ${body}` };
    }
  } catch (e) {
    return { error: `Nie można połączyć się z aplikacją (${product.appUrl}): ${e}` };
  }

  revalidatePath(`/dashboard/products/${productId}`);
  redirect(`/dashboard/clients/${tenantId}/domain`);
}

export async function updateProduct(
  productId: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string }> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const appUrl = (formData.get("appUrl") as string)?.trim().replace(/\/$/, "");
  if (!appUrl) return { error: "Podaj URL aplikacji" };

  await db.update(products).set({ appUrl }).where(eq(products.id, productId));

  revalidatePath(`/dashboard/products/${productId}`);
  return { error: "" };
}

export async function deleteTenant(tenantId: string, _formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) return;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, tenant.productId))
    .limit(1);

  if (product) {
    try {
      await removeDomain(
        product.vercelProjectId,
        product.vercelToken,
        `${tenant.slug}.${product.baseDomain}`
      );
    } catch (e) {
      console.error("Failed to remove subdomain:", e);
    }

    if (tenant.customDomain) {
      try {
        await removeDomain(
          product.vercelProjectId,
          product.vercelToken,
          tenant.customDomain
        );
      } catch (e) {
        console.error("Failed to remove custom domain:", e);
      }
    }
  }

  await db
    .delete(tenantOnboardings)
    .where(eq(tenantOnboardings.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));

  revalidatePath(`/dashboard/products/${tenant.productId}`);
  redirect(`/dashboard/products/${tenant.productId}`);
}
