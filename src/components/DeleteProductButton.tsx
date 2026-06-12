"use client";

import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/app/actions/tenants";

export function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  return (
    <form
      action={deleteProduct.bind(null, productId)}
      onSubmit={(e) => {
        if (!confirm(`Usunąć produkt "${productName}" i wszystkich jego klientów?`)) e.preventDefault();
      }}
    >
      <Button size="sm" variant="destructive" className="w-full">
        Usuń produkt
      </Button>
    </form>
  );
}
