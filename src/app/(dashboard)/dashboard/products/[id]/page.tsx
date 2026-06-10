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
  pending: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  suspended: "bg-red-100 text-red-800",
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/products"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Produkty
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{product.name}</h1>
          <p className="text-sm text-muted-foreground">{product.baseDomain}</p>
        </div>
        <Link href={`/dashboard/products/${id}/new`}>
          <Button>+ Dodaj klienta</Button>
        </Link>
      </div>

      <EditAppUrlForm productId={id} currentAppUrl={product.appUrl} />

      {rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Brak klientów. Dodaj pierwszego.
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Firma</th>
                <th className="text-left px-4 py-3 font-medium">Subdomena</th>
                <th className="text-left px-4 py-3 font-medium">
                  Własna domena
                </th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${t.id}`}
                      className="font-medium hover:underline"
                    >
                      {t.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {t.slug}.{product.baseDomain}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.customDomain ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status ?? "pending"]}`}
                    >
                      {STATUS_LABEL[t.status ?? "pending"]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
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
