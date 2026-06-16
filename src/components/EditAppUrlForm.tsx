"use client";

import { useActionState } from "react";
import { updateProduct } from "@/app/actions/tenants";

export function EditAppUrlForm({
  productId,
  currentAppUrl,
  currentVercelProjectId,
}: {
  productId: string;
  currentAppUrl: string;
  currentVercelProjectId: string;
}) {
  const bound = updateProduct.bind(null, productId);
  const [state, action, pending] = useActionState(bound, null);

  return (
    <div className="bg-white rounded-xl border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium mb-2">URL aplikacji (używany przy tworzeniu klientów)</p>
        <input
          name="appUrl"
          form="edit-product-form"
          defaultValue={currentAppUrl}
          placeholder="https://twoja-aplikacja.vercel.app"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
        />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Vercel Project ID</p>
        <input
          name="vercelProjectId"
          form="edit-product-form"
          defaultValue={currentVercelProjectId}
          placeholder="prj_xxxxxxxxxxxxxxxxxxxx"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Sprawdzane przy zapisie — jeśli projekt nie istnieje w Vercel, zapis zostanie odrzucony.
        </p>
      </div>
      <form id="edit-product-form" action={action} className="flex justify-end">
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
