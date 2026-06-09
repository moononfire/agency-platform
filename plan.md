# Agency Platform — Plan implementacji

## Decyzje architektoniczne

| Kwestia | Decyzja | Uzasadnienie |
|---|---|---|
| Auth | **Sign in with Vercel** (OAuth 2.0) | Zespół już ma konta Vercel, brak osobnego serwisu auth, natywna integracja z ekosystemem |
| Auth library | **Auth.js v5** (NextAuth) z custom Vercel provider | Obsługa sesji, ciasteczek, middleware — bez pisania OAuth od zera |
| Framework | **Next.js App Router** | Zgodnie z doc |
| Baza | **Neon Postgres** (Vercel Marketplace) | Zgodnie z doc |
| ORM | **Drizzle ORM** | Lekki, typowany, działa świetnie z Neon |
| UI | **shadcn/ui + Tailwind** | Szybki development, spójny design system |
| Hosting | **Vercel** | Zgodnie z doc |

---

## Faza 1 — Szkielet projektu

### 1.1 Inicjalizacja

```bash
npx create-next-app@latest agency-platform --typescript --tailwind --app --src-dir
npx shadcn@latest init
```

Struktura katalogów:
```
src/
  app/
    (auth)/
      login/page.tsx          ← strona logowania
      api/auth/[...nextauth]/ ← Auth.js handler
    (dashboard)/
      layout.tsx              ← wymaga sesji
      dashboard/
        products/page.tsx
        products/[id]/page.tsx
        products/[id]/new/    ← wizard
        clients/[id]/page.tsx
        clients/[id]/domain/page.tsx
        clients/[id]/settings/page.tsx
  lib/
    auth.ts                   ← konfiguracja Auth.js
    db/
      schema.ts               ← Drizzle schema
      index.ts                ← klient Neon
    vercel-api.ts             ← wrapper Vercel REST API
  components/
    ui/                       ← shadcn components
    wizard/                   ← kroki onboardingu
```

### 1.2 Zależności

```bash
npm install next-auth@beta @auth/drizzle-adapter
npm install drizzle-orm @neondatabase/serverless
npm install drizzle-kit --save-dev
npm install @vercel/sdk          # oficjalny Vercel SDK (types + REST wrapper)
npm install zod react-hook-form @hookform/resolvers
npm install nuqs                 # state w URL (wizard steps)
```

---

## Faza 2 — Autentykacja (Sign in with Vercel)

### 2.1 Jak działa Sign in with Vercel

Vercel jest standardowym dostawcą OAuth 2.0:

| Endpoint | URL |
|---|---|
| Authorization | `https://vercel.com/oauth/authorize` |
| Token | `https://api.vercel.com/v2/oauth/access_token` |
| User info | `https://api.vercel.com/v2/user` |

Kroki konfiguracji:
1. Wejdź na `https://vercel.com/account/tokens` → **OAuth Apps** → **Create OAuth App**
2. Callback URL: `https://agency-platform.vercel.app/api/auth/callback/vercel` (+ `http://localhost:3000/...` dla dev)
3. Skopiuj `Client ID` i `Client Secret`

### 2.2 Konfiguracja Auth.js

```ts
// src/lib/auth.ts
import NextAuth from "next-auth";
import type { OAuthConfig } from "next-auth/providers";

const VercelProvider: OAuthConfig<any> = {
  id: "vercel",
  name: "Vercel",
  type: "oauth",
  authorization: {
    url: "https://vercel.com/oauth/authorize",
    params: { scope: "user" },
  },
  token: "https://api.vercel.com/v2/oauth/access_token",
  userinfo: "https://api.vercel.com/v2/user",
  profile(profile) {
    return {
      id: profile.user.id,
      name: profile.user.name,
      email: profile.user.email,
      image: profile.user.avatar,
    };
  },
  clientId: process.env.VERCEL_OAUTH_CLIENT_ID!,
  clientSecret: process.env.VERCEL_OAUTH_CLIENT_SECRET!,
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [VercelProvider],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
```

### 2.3 Middleware ochrony tras

```ts
// src/middleware.ts
export { auth as default } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

### 2.4 Zmienne środowiskowe (auth)

```env
VERCEL_OAUTH_CLIENT_ID=...
VERCEL_OAUTH_CLIENT_SECRET=...
AUTH_SECRET=...            # openssl rand -base64 32
AUTH_URL=https://agency-platform.vercel.app
```

---

## Faza 3 — Baza danych

### 3.1 Provisioning Neon

```bash
# Przez Vercel Marketplace — auto-dodaje DATABASE_URL do env
vercel integration add neon
```

### 3.2 Schema Drizzle

```ts
// src/lib/db/schema.ts
import { pgTable, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "pending", "active", "suspended"
]);

export const products = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  vercelProjectId: text("vercel_project_id").notNull(),
  vercelToken: text("vercel_token").notNull(),   // zaszyfrowany
  baseDomain: text("base_domain").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text("product_id").notNull().references(() => products.id),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenantOnboardings = pgTable("tenant_onboardings", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id),
  currentStep: text("current_step").default("1"),
  completedAt: timestamp("completed_at"),
  dnsVerified: boolean("dns_verified").default(false),
  dnsVerifiedAt: timestamp("dns_verified_at"),
});
```

### 3.3 Migracje

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Faza 4 — Vercel API integration

### 4.1 Wrapper

```ts
// src/lib/vercel-api.ts
const VERCEL_API = "https://api.vercel.com";

export async function addDomainToProject(
  projectId: string,
  token: string,
  domain: string
) {
  const res = await fetch(`${VERCEL_API}/v10/projects/${projectId}/domains`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: domain }),
  });
  if (!res.ok) throw new Error(`Vercel API error: ${res.statusText}`);
  return res.json();
}

export async function getDomainVerification(
  projectId: string,
  token: string,
  domain: string
) {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${projectId}/domains/${domain}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

export async function removeDomainFromProject(
  projectId: string,
  token: string,
  domain: string
) {
  await fetch(`${VERCEL_API}/v9/projects/${projectId}/domains/${domain}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

---

## Faza 5 — Agency Dashboard UI

### 5.1 Lista produktów `/dashboard/products`

- Tabela: wszystkie produkty z licznikiem aktywnych/łącznych tenantów
- Przycisk "Dodaj klienta" → `/dashboard/products/[id]/new`

### 5.2 Lista klientów `/dashboard/products/[id]`

- Tabela tenantów danego produktu
- Kolumny: nazwa firmy, subdomena, własna domena, status, data onboardingu
- Filtry: status, wyszukiwarka
- Klik w wiersz → `/dashboard/clients/[id]`

### 5.3 Szczegóły klienta `/dashboard/clients/[id]`

- Karta z danymi firmy
- Status DNS (z live polling)
- Linki do subdomeny / własnej domeny
- Przyciski: Edytuj ustawienia, Usuń klienta

### 5.4 Status domeny `/dashboard/clients/[id]/domain`

- Tabela rekordów DNS do skonfigurowania (typ, host, wartość)
- Status weryfikacji (polling co 30s przez Server-Sent Events lub React Query)
- Możliwość ręcznego wyzwolenia re-weryfikacji

---

## Faza 6 — Wizard onboardingu

Lokalizacja: `/dashboard/products/[id]/new`

Stan wizarda trzymany w URL (`nuqs`) — można wrócić/odświeżyć bez utraty danych.

### Krok 1 — Dane firmy
Pola: `businessName`, `email`, `phone`, `address`

### Krok 2 — Subdomena
- Pole: `slug`
- Live preview: `slug.hairsaas.pl`
- Walidacja unikalności przez API call

### Krok 3 — Własna domena (opcjonalne)
- Pole: `customDomain`
- Wyjaśnienie że DNS trzeba skonfigurować po onboardingu

### Krok 4 — Wygląd
- Upload logo → Vercel Blob
- Color picker dla koloru głównego

### Krok 5 — Usługi startowe
- Lista szablonów branżowych (np. Strzyżenie, Koloryzacja dla HairSaaS)
- Multi-select

### Krok 6 — Potwierdzenie i setup
Sekwencja Server Action:
```
1. INSERT Tenant (status: "pending")
2. INSERT TenantOnboarding (currentStep: "6")
3. Vercel API → dodaj subdomenę slug.baseDomain
4. Jeśli customDomain → Vercel API → dodaj, pobierz rekordy DNS
5. Wyślij email z rekordami DNS (jeśli customDomain)
6. UPDATE Tenant status → "active"
7. UPDATE TenantOnboarding completedAt
8. Redirect → /dashboard/clients/[newTenantId]/domain
```

---

## Faza 7 — Publiczne API dla produktów

### Endpoint tenant lookup

```ts
// src/app/api/tenant/route.ts
// GET /api/tenant?domain=salon-anna.hairsaas.pl
// Używane przez middleware HairSaaS / CafeSaaS
```

Odpowiedź:
```json
{
  "tenantId": "salon-anna",
  "productId": "hairsaas",
  "status": "active",
  "schemaVersion": "1"
}
```

Zabezpieczenie: shared secret w nagłówku `X-Agency-Secret` (env var w każdym produkcie).

---

## Faza 8 — Integracja HairSaaS

### Middleware w projekcie HairSaaS

```ts
// middleware.ts (projekt HairSaaS)
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")!;
  
  const tenant = await fetch(
    `${process.env.AGENCY_API_URL}/api/tenant?domain=${hostname}`,
    { headers: { "X-Agency-Secret": process.env.AGENCY_SECRET! } }
  ).then(r => r.json());

  if (!tenant || tenant.status !== "active") {
    return NextResponse.rewrite(new URL("/404", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-tenant-id", tenant.tenantId);
  return response;
}
```

### RLS setup w HairSaaS

```sql
-- Raz per tabela przy inicjalizacji bazy
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON appointments
  USING (tenant_id = current_setting('app.current_tenant'));

-- W każdym DB connection przed zapytaniami
SET app.current_tenant = 'salon-anna';
```

---

## Kolejność realizacji

| # | Zadanie | Priorytet |
|---|---|---|
| 1 | `create-next-app` + shadcn + Tailwind | P0 |
| 2 | Auth.js + Sign in with Vercel | P0 |
| 3 | Neon + Drizzle schema + migracje | P0 |
| 4 | Layout dashboard + middleware auth | P0 |
| 5 | CRUD Products (lista + dodawanie) | P1 |
| 6 | CRUD Tenants (lista klientów) | P1 |
| 7 | Vercel API wrapper (dodaj/usuń domenę) | P1 |
| 8 | Wizard onboardingu (kroki 1-6) | P1 |
| 9 | DNS status polling (SSE / polling) | P2 |
| 10 | Publiczne API `/api/tenant` | P2 |
| 11 | Integracja HairSaaS middleware + RLS | P2 |
| 12 | Panel klienta (szczegóły, ustawienia) | P2 |

---

## Zmienne środowiskowe (pełna lista)

```env
# Baza danych (auto z Neon Marketplace)
DATABASE_URL=

# Auth (Sign in with Vercel)
VERCEL_OAUTH_CLIENT_ID=
VERCEL_OAUTH_CLIENT_SECRET=
AUTH_SECRET=
AUTH_URL=

# Wewnętrzne API (dla produktów SaaS)
AGENCY_API_SECRET=

# Email (np. Resend przez Vercel Marketplace)
RESEND_API_KEY=
```
