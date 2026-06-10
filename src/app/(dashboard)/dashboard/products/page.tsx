export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { products, tenants } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ProductsPage() {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      baseDomain: products.baseDomain,
      tenantCount: sql<number>`count(${tenants.id})::int`,
    })
    .from(products)
    .leftJoin(tenants, eq(tenants.productId, products.id))
    .groupBy(products.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Produkty</h1>
        <Link href="/dashboard/products/new">
          <Button>+ Nowy produkt</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Brak produktów. Dodaj pierwszy produkt ręcznie w bazie danych.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border p-6 hover:shadow-sm transition-shadow space-y-3"
            >
              <Link href={`/dashboard/products/${p.id}`} className="block space-y-1">
                <div className="font-medium text-lg">{p.name}</div>
                <div className="text-sm text-muted-foreground">{p.baseDomain}</div>
                <div className="text-sm font-medium">
                  {p.tenantCount} {p.tenantCount === 1 ? "klient" : "klientów"}
                </div>
              </Link>
              <Link href={`/dashboard/products/${p.id}/new`}>
                <Button size="sm" variant="outline" className="w-full">
                  + Dodaj klienta
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
