import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { WizardClient } from "@/components/wizard/WizardClient";

export default async function NewClientPage({
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <a
          href={`/dashboard/products/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {product.name}
        </a>
        <h1 className="text-2xl font-semibold mt-1">Nowy klient</h1>
      </div>
      <WizardClient
        productId={id}
        productName={product.name}
        baseDomain={product.baseDomain}
        productType={product.type}
      />
    </div>
  );
}
