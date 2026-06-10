"use client";

import { useActionState } from "react";
import { updateProduct } from "@/app/actions/tenants";

export function EditAppUrlForm({
  productId,
  currentAppUrl,
}: {
  productId: string;
  currentAppUrl: string;
}) {
  const bound = updateProduct.bind(null, productId);
  const [state, action, pending] = useActionState(bound, null);

  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-sm font-medium mb-2">URL aplikacji (używany przy tworzeniu klientów)</p>
      <form action={action} className="flex items-center gap-2">
        <input
          name="appUrl"
          defaultValue={currentAppUrl}
          placeholder="https://twoja-aplikacja.vercel.app"
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Zapisuję…" : "Zapisz"}
        </button>
      </form>
      {state?.error && (
        <p className="text-sm text-destructive mt-2">{state.error}</p>
      )}
      {state !== null && !state.error && (
        <p className="text-sm text-green-600 mt-2">Zapisano.</p>
      )}
    </div>
  );
}
