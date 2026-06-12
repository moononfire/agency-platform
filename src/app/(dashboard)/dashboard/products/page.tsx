export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { products, tenants } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/DeleteProductButton";

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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Produkty</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zarządzaj swoimi produktami i klientami
          </p>
        </div>
        <Link href="/dashboard/products/new">
          <Button>+ Nowy produkt</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card rounded-2xl border border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4">
            <span className="text-2xl">📦</span>
          </div>
          <p className="font-semibold text-foreground">Brak produktów</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Dodaj pierwszy produkt ręcznie w bazie danych.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <div
              key={p.id}
              className="bg-card rounded-2xl border border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 flex flex-col"
            >
              <div className="p-6 flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25"
                      />
                    </svg>
                  </div>
                  <span className="text-xs font-medium bg-accent text-accent-foreground px-2 py-1 rounded-full">
                    {p.tenantCount} {p.tenantCount === 1 ? "klient" : "klientów"}
                  </span>
                </div>
                <Link href={`/dashboard/products/${p.id}`} className="block space-y-1 group">
                  <div className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded-md inline-block">
                    {p.baseDomain}
                  </div>
                </Link>
              </div>
              <div className="px-6 pb-5 flex gap-2 border-t border-border pt-4">
                <Link href={`/dashboard/products/${p.id}/new`} className="flex-1">
                  <Button size="sm" variant="outline" className="w-full">
                    + Dodaj klienta
                  </Button>
                </Link>
                <DeleteProductButton productId={p.id} productName={p.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
