export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { products, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { EditAppUrlForm } from "@/components/EditAppUrlForm";

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

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!product) notFound();

  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.productId, id))
    .orderBy(tenants.createdAt);

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Produkty
          </Link>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{product.name}</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">{product.baseDomain}</p>
        </div>
        <Link href={`/dashboard/products/${id}/new`}>
          <Button>+ Dodaj klienta</Button>
        </Link>
      </div>

      <EditAppUrlForm productId={id} currentAppUrl={product.appUrl} />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-dashed">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-3">
            <span className="text-xl">👥</span>
          </div>
          <p className="font-semibold text-foreground">Brak klientów</p>
          <p className="text-sm text-muted-foreground mt-1">Dodaj pierwszego klienta.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Klienci</p>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {rows.length}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Firma</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subdomena</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Własna domena</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/dashboard/clients/${t.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {t.businessName}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                      {t.slug}.{product.baseDomain}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground hidden md:table-cell">
                    {t.customDomain ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status ?? "pending"]}`}
                    >
                      {STATUS_LABEL[t.status ?? "pending"]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleDateString("pl-PL")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
