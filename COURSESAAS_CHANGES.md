# Instrukcje dla agenta: zmiany w agency-platform pod CourseSaaS

## Kontekst

Mamy platformę agencyjną (`agency-platform`) która zarządza wieloma produktami SaaS.  
Dotychczas obsługiwała tylko `HairSaaS` (aplikacja dla salonów fryzjerskich).  
Teraz dodajemy drugi produkt: **CourseSaaS** — platforma sprzedaży kursów wideo.

CourseSaaS to osobny projekt Next.js (`sell-courses-www`). Każdy klient agencji dostaje:
- subdomenę (`jan-kowalski.courses.twojaagencja.pl`)
- własne klucze Stripe (klient podaje ręcznie przy onboardingu)
- własne dane w shared bazie (izolacja przez `tenant_id`)

**Nie** robimy teraz: Stripe Connect OAuth, osobnych bucketów R2, żadnych prowizji platformy.

---

## Istniejące pliki które modyfikujesz

```
src/lib/db/schema.ts                                    ← schema Drizzle
src/app/api/tenant/route.ts                             ← GET /api/tenant?domain=
src/app/actions/tenants.ts                              ← server action createTenant
src/components/wizard/WizardClient.tsx                  ← wizard onboardingu (client component)
src/app/(dashboard)/dashboard/products/new/page.tsx     ← formularz nowego produktu
src/app/(dashboard)/dashboard/products/[id]/new/page.tsx ← strona wizarda
```

## Nowe pliki które tworzysz

```
src/app/api/tenant/credentials/route.ts    ← nowy endpoint zwracający secret key
```

---

## Zmiana 1 — `src/lib/db/schema.ts`

### 1a. Nowy enum `productTypeEnum`

Dodaj przed tabelą `products`:

```ts
export const productTypeEnum = pgEnum("product_type", ["hair", "courses"]);
```

Pamiętaj żeby zaimportować `pgEnum` — jest już zaimportowany, tylko go użyj.

### 1b. Nowa kolumna w tabeli `products`

```ts
type: productTypeEnum("type").default("hair").notNull(),
```

### 1c. Dwie nowe kolumny w tabeli `tenants`

```ts
stripeSecretKey:      text("stripe_secret_key"),
stripePublishableKey: text("stripe_publishable_key"),
```

### Wynik końcowy `schema.ts`

```ts
import {
  pgTable,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "pending",
  "active",
  "suspended",
]);

export const productTypeEnum = pgEnum("product_type", ["hair", "courses"]);

export const products = pgTable("products", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: productTypeEnum("type").default("hair").notNull(),
  vercelProjectId: text("vercel_project_id").notNull(),
  vercelToken: text("vercel_token").notNull(),
  baseDomain: text("base_domain").notNull(),
  appUrl: text("app_url").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  slug: text("slug").notNull(),
  customDomain: text("custom_domain"),
  status: tenantStatusEnum("status").default("pending"),
  schemaVersion: text("schema_version").default("1"),
  businessName: text("business_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  stripeSecretKey: text("stripe_secret_key"),
  stripePublishableKey: text("stripe_publishable_key"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenantOnboardings = pgTable("tenant_onboardings", {
  tenantId: text("tenant_id")
    .primaryKey()
    .references(() => tenants.id),
  currentStep: text("current_step").default("1"),
  completedAt: timestamp("completed_at"),
  dnsVerified: boolean("dns_verified").default(false),
  dnsVerifiedAt: timestamp("dns_verified_at"),
});
```

Po zapisaniu pliku uruchom: `npm run db:push`

---

## Zmiana 2 — `src/app/api/tenant/credentials/route.ts` (NOWY PLIK)

Ten endpoint zwraca wrażliwe dane (Stripe secret key). Dostępny tylko z serwera (wymaga `x-agency-secret`). Sell-courses-www wywołuje go server-side żeby dostać klucz Stripe dla tenanta.

```ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-agency-secret");
  if (secret !== process.env.AGENCY_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenantId");
  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId param" }, { status: 400 });
  }

  const [tenant] = await db
    .select({
      stripeSecretKey: tenants.stripeSecretKey,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    stripeSecretKey: tenant.stripeSecretKey ?? null,
  });
}
```

---

## Zmiana 3 — `src/app/api/tenant/route.ts`

Dodaj `stripePublishableKey` do odpowiedzi (klucz publiczny jest bezpieczny do zwrócenia).

### Zmiana w `tenantFields`

Dodaj do obiektu `tenantFields`:
```ts
stripePublishableKey: tenants.stripePublishableKey,
```

### Zmiana w `return NextResponse.json(...)`

Dodaj do obiektu odpowiedzi:
```ts
stripePublishableKey: match.stripePublishableKey ?? null,
```

---

## Zmiana 4 — `src/app/actions/tenants.ts`

### W funkcji `createTenant`

#### 4a. Odczytaj klucze Stripe z formData

Dodaj po istniejących zmiennych (po `adminPassword`):

```ts
const stripeSecretKey =
  (formData.get("stripeSecretKey") as string)?.trim() || undefined;
const stripePublishableKey =
  (formData.get("stripePublishableKey") as string)?.trim() || undefined;
```

#### 4b. Pobierz typ produktu przy pobieraniu produktu

Zmień selekcję produktu żeby pobrać też `type`:

```ts
const [product] = await db
  .select()
  .from(products)
  .where(eq(products.id, productId))
  .limit(1);
```

(Pełny `select()` już pobiera wszystkie pola — bez zmian w zapytaniu, dostęp przez `product.type`)

#### 4c. Zapisz klucze Stripe przy `db.insert(tenants)`

Dodaj do `.values({...})`:
```ts
stripeSecretKey,
stripePublishableKey,
```

#### 4d. W wywołaniu `/api/setup` dodaj `stripePublishableKey` do body

Znajdź sekcję `body: JSON.stringify({...})` i dodaj:
```ts
stripePublishableKey: stripePublishableKey ?? "",
```

Całe body:
```ts
body: JSON.stringify({
  tenantId,
  slug,
  adminName,
  adminEmail,
  adminPassword,
  services: (formData.get("services") as string) || "",
  stripePublishableKey: stripePublishableKey ?? "",
}),
```

### W funkcji `createProduct`

Odczytaj i zapisz `type`:

```ts
const type = (formData.get("type") as "hair" | "courses") || "hair";
```

Dodaj do walidacji — `type` jest opcjonalny (defaultuje do `"hair"`), nie wymaga sprawdzenia.

Dodaj do `db.insert(products).values({...})`:
```ts
type,
```

---

## Zmiana 5 — `src/app/(dashboard)/dashboard/products/new/page.tsx`

Formularz tworzenia produktu musi pozwalać wybrać typ (`hair` lub `courses`).

Dodaj pole select przed przyciskiem submit (po polu `appUrl`):

```tsx
<div>
  <label className={labelClass}>
    Typ produktu <span className="text-destructive">*</span>
  </label>
  <select name="type" className={fieldClass} defaultValue="hair">
    <option value="hair">HairSaaS — salony fryzjerskie</option>
    <option value="courses">CourseSaaS — kursy wideo</option>
  </select>
</div>
```

---

## Zmiana 6 — `src/app/(dashboard)/dashboard/products/[id]/new/page.tsx`

Przekaż `productType` do wizarda:

```tsx
<WizardClient
  productId={id}
  productName={product.name}
  baseDomain={product.baseDomain}
  productType={product.type}   // ← nowy prop
/>
```

---

## Zmiana 7 — `src/components/wizard/WizardClient.tsx`

To jest największa zmiana. Wizard musi obsługiwać dwa tryby: `hair` i `courses`.

### 7a. Nowy prop

Zmień sygnaturę komponentu:
```ts
export function WizardClient({
  productId,
  baseDomain,
  productType,
}: {
  productId: string;
  productName: string;
  baseDomain: string;
  productType: "hair" | "courses";
})
```

### 7b. Nowy stan dla kluczy Stripe

Dodaj poniżej istniejących `useQueryState`:
```ts
const [stripeSecretKey, setStripeSecretKey] = useState("");
const [stripePublishableKey, setStripePublishableKey] = useState("");
```

`useState` (NIE `useQueryState`) — secret key nie może być w URL.

### 7c. Krok 5 — warunkowy

Aktualny krok 5 to "Usługi startowe" (lista checkboxów dla HairSaaS). Zastąp ten blok logiką warunkową:

```tsx
{step === 5 && productType === "hair" && (
  // ISTNIEJĄCY kod kroku 5 "Usługi startowe" — bez zmian
  <div className="space-y-4">
    <h2 className="text-lg font-semibold">Usługi startowe</h2>
    {/* ... cały istniejący JSX ... */}
  </div>
)}

{step === 5 && productType === "courses" && (
  <div className="space-y-4">
    <h2 className="text-lg font-semibold">Płatności Stripe</h2>
    <p className="text-sm text-muted-foreground">
      Znajdziesz je w Stripe Dashboard → Developers → API keys.
      Możesz użyć kluczy testowych (sk_test_...) na początku.
    </p>
    <div>
      <label className={labelClass}>
        Secret Key <span className="text-destructive">*</span>
      </label>
      <input
        className={fieldClass}
        type="password"
        value={stripeSecretKey}
        onChange={(e) => setStripeSecretKey(e.target.value)}
        placeholder="sk_live_... lub sk_test_..."
      />
    </div>
    <div>
      <label className={labelClass}>
        Publishable Key <span className="text-destructive">*</span>
      </label>
      <input
        className={fieldClass}
        value={stripePublishableKey}
        onChange={(e) => setStripePublishableKey(e.target.value)}
        placeholder="pk_live_... lub pk_test_..."
      />
    </div>
    <div className="flex justify-between pt-2">
      <Button variant="outline" onClick={prev}>
        ← Wstecz
      </Button>
      <Button
        onClick={next}
        disabled={
          !stripeSecretKey.startsWith("sk_") ||
          !stripePublishableKey.startsWith("pk_")
        }
      >
        Dalej →
      </Button>
    </div>
  </div>
)}
```

### 7d. Krok 7 (potwierdzenie) — zamaskuj secret key

W sekcji potwierdzenia, po `<Row label="Admin" value={adminEmail} />`, dodaj dla CourseSaaS:

```tsx
{productType === "courses" && stripePublishableKey && (
  <Row label="Stripe" value={stripePublishableKey} mono />
)}
```

Secret key celowo NIE pokazujemy w potwierdzeniu.

### 7e. Hidden inputs w formularzu (krok 7)

W bloku `{step === 7}` wewnątrz `<form action={action}>`, po istniejących hidden inputach dodaj:

```tsx
<input type="hidden" name="stripeSecretKey" value={stripeSecretKey} />
<input type="hidden" name="stripePublishableKey" value={stripePublishableKey} />
```

---

## Kolejność wykonania

1. Zmień `schema.ts` → uruchom `npm run db:push`
2. Utwórz `src/app/api/tenant/credentials/route.ts`
3. Zaktualizuj `src/app/api/tenant/route.ts`
4. Zaktualizuj `src/app/actions/tenants.ts`
5. Zaktualizuj `src/app/(dashboard)/dashboard/products/new/page.tsx`
6. Zaktualizuj `src/app/(dashboard)/dashboard/products/[id]/new/page.tsx`
7. Zaktualizuj `src/components/wizard/WizardClient.tsx`

---

## Weryfikacja po zmianach

1. `npm run build` — musi przechodzić bez błędów TypeScript
2. Utwórz nowy produkt z typem `courses` — formularz musi pokazać select z opcją "CourseSaaS"
3. Wejdź w wizard dla produktu typu `courses` → krok 5 powinien pokazać pola Stripe zamiast checkboxów usług
4. Wykonaj pełny onboarding testowego klienta → sprawdź w bazie że `tenants.stripe_secret_key` jest uzupełniony
5. Wywołaj `GET /api/tenant/credentials?tenantId=<id>` z headerem `x-agency-secret` → powinien zwrócić `{ stripeSecretKey: "sk_..." }`
6. Wywołaj `GET /api/tenant?domain=<slug.baseDomain>` → odpowiedź powinna zawierać `stripePublishableKey`

---

## Czego NIE robimy (zakres prac)

- Nie robimy Stripe Connect OAuth
- Nie ruszamy istniejącej logiki HairSaaS — tylko dodajemy nową ścieżkę dla `courses`
- Nie zmieniamy logiki domen, DNS pollingu, ani usuwania klientów
- Nie szyfrujemy kluczy Stripe w bazie (zostawiamy na później)
