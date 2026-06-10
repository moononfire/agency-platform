export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { products, tenants, tenantOnboardings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { deleteTenant } from "@/app/actions/tenants";

const STATUS_LABEL: Record<string, string> = {
  pending: "Oczekuje",
  active: "Aktywny",
  suspended: "Zawieszony",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  suspended: "bg-red-100 text-red-800",
};

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/dashboard/products/${tenant.productId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← {product?.name ?? "Produkt"}
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{tenant.businessName}</h1>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLOR[tenant.status ?? "pending"]}`}
        >
          {STATUS_LABEL[tenant.status ?? "pending"]}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold">Dane firmy</h2>
          <dl className="space-y-2 text-sm">
            <Field label="Email" value={tenant.email} />
            {tenant.phone && <Field label="Telefon" value={tenant.phone} />}
            {tenant.address && <Field label="Adres" value={tenant.address} />}
            {tenant.primaryColor && (
              <div className="flex items-start gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">Kolor</dt>
                <dd className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: tenant.primaryColor }}
                  />
                  <span className="font-mono">{tenant.primaryColor}</span>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold">Domeny</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <dt className="text-muted-foreground w-28 shrink-0">Subdomena</dt>
              <dd className="font-mono">{subdomain}</dd>
            </div>
            {tenant.customDomain && (
              <div className="flex items-start gap-2">
                <dt className="text-muted-foreground w-28 shrink-0">
                  Własna domena
                </dt>
                <dd className="font-mono">{tenant.customDomain}</dd>
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

      {onboarding && (
        <div className="bg-white rounded-xl border p-6 space-y-2">
          <h2 className="font-semibold">Onboarding</h2>
          <dl className="text-sm space-y-2">
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
                  <span className="text-green-700 font-medium">
                    Zweryfikowany
                  </span>
                ) : (
                  <span className="text-yellow-700">Oczekuje weryfikacji</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <form action={deleteAction}>
          <Button variant="destructive" size="sm" type="submit">
            Usuń klienta
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="text-muted-foreground w-28 shrink-0">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
