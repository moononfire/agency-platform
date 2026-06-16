"use server";

import { db } from "@/lib/db";
import { products, tenants, tenantOnboardings } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { addDomain, removeDomain, getProject } from "@/lib/vercel-api";
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
  const baseDomain = (formData.get("baseDomain") as string)?.trim().toLowerCase();
  let appUrl = (formData.get("appUrl") as string)?.trim().replace(/\/$/, "");
  if (appUrl && !appUrl.startsWith("http")) appUrl = `https://${appUrl}`;

  if (!name || !vercelProjectId || !baseDomain || !appUrl) {
    return { error: "Wypełnij wszystkie pola" };
  }

  try {
    await getProject(vercelProjectId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Nie znaleziono projektu Vercel "${vercelProjectId}": ${msg}` };
  }

  const id = crypto.randomUUID();
  await db.insert(products).values({ id, name, vercelProjectId, baseDomain, appUrl });

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
    .where(and(eq(tenants.slug, slug), eq(tenants.productId, productId)))
    .limit(1);

  if (existing.length > 0) {
    return { error: "Ta subdomena jest już zajęta w tym produkcie" };
  }

  const tenantId = crypto.randomUUID();
  const subdomain = `${slug}.${product.baseDomain}`;

  // Cała operacja musi być atomowa: jeśli którykolwiek krok zawiedzie,
  // wycofujemy wszystko co zdążyliśmy stworzyć (domeny w Vercel, wiersze w bazie),
  // żeby nie zostawić klienta w stanie "częściowo utworzony".
  let subdomainAdded = false;
  let customDomainAdded = false;

  try {
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
      await addDomain(product.vercelProjectId, subdomain);
      subdomainAdded = true;
      console.log(`[createTenant] subdomain added: ${subdomain}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[createTenant] Failed to add subdomain ${subdomain}:`, msg);
      throw new Error(`Nie można dodać subdomeny: ${msg}`);
    }

    if (customDomain) {
      try {
        await addDomain(product.vercelProjectId, customDomain);
        customDomainAdded = true;
        console.log(`[createTenant] custom domain added: ${customDomain}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[createTenant] Failed to add custom domain ${customDomain}:`, msg);
        throw new Error(`Nie można dodać własnej domeny: ${msg}`);
      }
    }

    const agencySecret = process.env.AGENCY_API_SECRET;
    if (!agencySecret) {
      throw new Error("Brak AGENCY_API_SECRET w zmiennych środowiskowych agencji");
    }

    const setupUrl = `${product.appUrl}/api/setup`;
    console.log(`[createTenant] calling setup API: ${setupUrl}`);
    let res: Response;
    try {
      res = await fetch(setupUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agency-secret": agencySecret,
        },
        body: JSON.stringify({
          tenantId,
          slug,
          adminName,
          adminEmail,
          adminPassword,
          // Niektóre produkty (np. chicken-of-the-city) mają inny kontrakt
          // /api/setup: { slug, businessName, email, password } — tam email
          // służy do logowania, więc wysyłamy adminEmail (nie kontaktowy
          // email firmy). Nadmiarowe pola są ignorowane przez produkty
          // korzystające z kontraktu adminName/adminEmail/adminPassword.
          businessName,
          email: adminEmail,
          password: adminPassword,
          services: (formData.get("services") as string) || "",
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[createTenant] setup API fetch error:`, msg);
      throw new Error(`Nie można połączyć się z aplikacją (${setupUrl}): ${msg}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    console.log(`[createTenant] setup API response: status=${res.status} content-type=${contentType} body=${body.slice(0, 300)}`);

    if (!contentType.includes("application/json")) {
      const isVercelProtection = body.includes("Vercel") && (body.includes("login") || body.includes("Authentication") || body.includes("<!DOCTYPE"));
      if (isVercelProtection) {
        throw new Error(
          `Vercel Deployment Protection blokuje ${setupUrl}. ` +
            `Wyłącz ochronę dla projektu marketing-runner w Vercel Dashboard (Settings → Deployment Protection) ` +
            `lub dodaj zmienną VERCEL_AUTOMATION_BYPASS_SECRET i przekaż nagłówek x-vercel-protection-bypass.`
        );
      }
      throw new Error(
        `Aplikacja (${setupUrl}) zwróciła ${res.status} z content-type "${contentType}" zamiast JSON. ` +
          `Treść odpowiedzi: ${body.slice(0, 200)}`
      );
    }
    if (!res.ok) {
      throw new Error(`Błąd tworzenia konta admina (${res.status}): ${body}`);
    }

    await db
      .update(tenants)
      .set({ status: "active" })
      .where(eq(tenants.id, tenantId));

    await db
      .update(tenantOnboardings)
      .set({ completedAt: new Date() })
      .where(eq(tenantOnboardings.tenantId, tenantId));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[createTenant] aborting, rolling back:`, msg);

    if (subdomainAdded) {
      try {
        await removeDomain(product.vercelProjectId, subdomain);
      } catch (cleanupErr) {
        console.error(`[createTenant] rollback: failed to remove subdomain ${subdomain}:`, cleanupErr);
      }
    }
    if (customDomainAdded && customDomain) {
      try {
        await removeDomain(product.vercelProjectId, customDomain);
      } catch (cleanupErr) {
        console.error(`[createTenant] rollback: failed to remove custom domain ${customDomain}:`, cleanupErr);
      }
    }
    try {
      await db.delete(tenantOnboardings).where(eq(tenantOnboardings.tenantId, tenantId));
    } catch (cleanupErr) {
      console.error(`[createTenant] rollback: failed to delete onboarding row:`, cleanupErr);
    }
    try {
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    } catch (cleanupErr) {
      console.error(`[createTenant] rollback: failed to delete tenant row:`, cleanupErr);
    }

    return { error: msg };
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
  const vercelProjectId = (formData.get("vercelProjectId") as string)?.trim();

  if (!appUrl) return { error: "Podaj URL aplikacji" };
  if (!vercelProjectId) return { error: "Podaj Vercel Project ID" };

  try {
    await getProject(vercelProjectId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Nie znaleziono projektu Vercel "${vercelProjectId}": ${msg}` };
  }

  await db
    .update(products)
    .set({ appUrl, vercelProjectId })
    .where(eq(products.id, productId));

  revalidatePath(`/dashboard/products/${productId}`);
  return { error: "" };
}

export async function deleteProduct(productId: string, _formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const tenantRows = await db
    .select({ id: tenants.id, slug: tenants.slug, customDomain: tenants.customDomain })
    .from(tenants)
    .where(eq(tenants.productId, productId));

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);

  for (const tenant of tenantRows) {
    if (product) {
      try { await removeDomain(product.vercelProjectId, `${tenant.slug}.${product.baseDomain}`); } catch {}
      if (tenant.customDomain) {
        try { await removeDomain(product.vercelProjectId, tenant.customDomain); } catch {}
      }
    }
    await db.delete(tenantOnboardings).where(eq(tenantOnboardings.tenantId, tenant.id));
    await db.delete(tenants).where(eq(tenants.id, tenant.id));
  }

  await db.delete(products).where(eq(products.id, productId));

  revalidatePath("/dashboard/products");
  redirect("/dashboard/products");
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
      await removeDomain(product.vercelProjectId, `${tenant.slug}.${product.baseDomain}`);
    } catch (e) {
      console.error("Failed to remove subdomain:", e);
    }

    if (tenant.customDomain) {
      try {
        await removeDomain(product.vercelProjectId, tenant.customDomain);
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
