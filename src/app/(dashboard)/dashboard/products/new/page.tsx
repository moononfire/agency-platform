"use client";

import { useActionState } from "react";
import { createProduct } from "@/app/actions/tenants";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const fieldClass =
  "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelClass = "block text-sm font-medium mb-1";

export default function NewProductPage() {
  const [state, action, pending] = useActionState(createProduct, null);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/products"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Produkty
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Nowy produkt</h1>
      </div>

      <form action={action} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className={labelClass}>
            Nazwa <span className="text-destructive">*</span>
          </label>
          <input
            name="name"
            className={fieldClass}
            placeholder="Mój SaaS"
            required
          />
        </div>

        <div>
          <label className={labelClass}>
            Vercel Project ID <span className="text-destructive">*</span>
          </label>
          <input
            name="vercelProjectId"
            className={fieldClass}
            placeholder="prj_xxxxxxxxxxxxxxxxxxxx"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Znajdziesz go w Settings → General w Vercel projektu klienta.
          </p>
        </div>

        <div>
          <label className={labelClass}>
            Vercel Token <span className="text-destructive">*</span>
          </label>
          <input
            name="vercelToken"
            type="password"
            className={fieldClass}
            placeholder="••••••••••••••••••••"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Token z dostępem do projektu (Account Settings → Tokens).
          </p>
        </div>

        <div>
          <label className={labelClass}>
            Domena bazowa <span className="text-destructive">*</span>
          </label>
          <input
            name="baseDomain"
            className={fieldClass}
            placeholder="app.twojsaas.pl"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Klienci dostaną subdomeny w formacie: klient.app.twojsaas.pl
          </p>
        </div>

        {state?.error && (
          <p className="text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Tworzenie…" : "Utwórz produkt"}
          </Button>
        </div>
      </form>
    </div>
  );
}
