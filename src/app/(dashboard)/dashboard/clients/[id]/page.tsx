export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { products, tenants, tenantOnboardings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { deleteTenant } from "@/app/actions/tenants";
import { DeleteClientButton } from "@/components/DeleteClientButton";
import { buildAuthorizeUrl } from "@/lib/stripe-connect";

const STATUS_LABEL: Record<string, string> = {
  pending: "Oczekuje",
  active: "Aktywny",
  suspended: "Zawieszony",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
  active: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  suspended: "bg-red-100 text-red-700 ring-1 ring-red-200",
};

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stripe?: string; stripe_error?: string }>;
}) {
  const { id } = await params;
  const { stripe: stripeStatus, stripe_error: stripeError } = await searchParams;

  let stripeConnectUrl: string | null = null;
  let stripeConnectConfigError: string | null = null;
  try {
    stripeConnectUrl = buildAuthorizeUrl(id);
  } catch (e) {
    stripeConnectConfigError = e instanceof Error ? e.message : String(e);
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!tenant) notFound();

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, tenant.productId))
    .limit(1);

  const [onboarding] = await db
    .select()
    .from(tenantOnboardings)
    .where(eq(tenantOnboardings.tenantId, id))
    .limit(1);

  const subdomain = `${tenant.slug}.${product?.baseDomain ?? ""}`;

  const deleteAction = deleteTenant.bind(null, id);

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/dashboard/products/${tenant.productId}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {product?.name ?? "Produkt"}
          </Link>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{tenant.businessName}</h1>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLOR[tenant.status ?? "pending"]}`}
        >
          {STATUS_LABEL[tenant.status ?? "pending"]}
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </span>
            Dane firmy
          </h2>
          <dl className="space-y-3 text-sm">
            <Field label="Email" value={tenant.email} />
            {tenant.phone && <Field label="Telefon" value={tenant.phone} />}
            {tenant.address && <Field label="Adres" value={tenant.address} />}
            {tenant.primaryColor && (
              <div className="flex items-start gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Kolor</dt>
                <dd className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-border shadow-sm"
                    style={{ backgroundColor: tenant.primaryColor }}
                  />
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{tenant.primaryColor}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </span>
            Domeny
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Subdomena</dt>
              <dd className="font-mono text-xs bg-muted px-2 py-1 rounded-md">{subdomain}</dd>
            </div>
            {tenant.customDomain && (
              <div className="flex items-start gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Własna domena</dt>
                <dd className="font-mono text-xs bg-muted px-2 py-1 rounded-md">{tenant.customDomain}</dd>
              </div>
            )}
          </dl>
          <Link href={`/dashboard/clients/${id}/domain`}>
            <Button variant="outline" size="sm">
              Status DNS →
            </Button>
          </Link>
        </div>
      </div>

      {stripeStatus === "connected" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Konto Stripe zostało połączone.
        </div>
      )}
      {stripeStatus === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Nie udało się połączyć Stripe{stripeError ? `: ${stripeError}` : ""}.
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          Stripe
        </h2>
        {tenant.stripeAccountId ? (
          <div className="text-sm space-y-2">
            <div className="flex items-center gap-2 text-emerald-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Połączone konto Stripe
            </div>
            <p className="font-mono text-xs bg-muted px-2 py-1 rounded-md inline-block">
              {tenant.stripeAccountId}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Klient nie ma jeszcze połączonego konta Stripe — przelewy nie mogą być realizowane.
            </p>
            {stripeConnectUrl ? (
              <a href={stripeConnectUrl}>
                <Button size="sm">Połącz Stripe</Button>
              </a>
            ) : (
              <p className="text-xs text-amber-700">
                Stripe Connect nie jest skonfigurowany ({stripeConnectConfigError}).
              </p>
            )}
          </div>
        )}
      </div>

      {onboarding && (
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Onboarding
          </h2>
          <dl className="text-sm space-y-3">
            {onboarding.completedAt && (
              <Field
                label="Ukończono"
                value={new Date(onboarding.completedAt).toLocaleString("pl-PL")}
              />
            )}
            <div className="flex items-start gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">DNS</dt>
              <dd>
                {onboarding.dnsVerified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Zweryfikowany
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    Oczekuje weryfikacji
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <DeleteClientButton action={deleteAction} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="text-muted-foreground w-28 shrink-0">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
