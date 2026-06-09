# Agency Platform — Dokumentacja architektury

## Czym jest Agency Platform

Wewnętrzna aplikacja dla firmy zarządzająca wieloma produktami SaaS oferowanymi różnym branżom (fryzjerzy, kawiarnie, restauracje itd.). Pozwala szybko onboardować nowych klientów — każdy dostaje własną subdomenę lub własną domenę, bez ręcznej konfiguracji.

---

## Struktura systemu

```
Agency Dashboard (ta aplikacja)
│
├── Produkt: HairSaaS          ← osobny projekt Vercel + repo
│   ├── salon-anna.hairsaas.pl
│   ├── salon-jan.hairsaas.pl
│   └── wlasnadomena.pl        ← opcjonalne podpięcie własnej domeny
│
├── Produkt: CafeSaaS          ← osobny projekt Vercel + repo
│   ├── kawiarnia-marta.cafesaas.pl
│   └── ...
│
└── Produkt: RestaurantSaaS    ← osobny projekt Vercel + repo
    └── ...
```

Agency Dashboard zna tylko metadane (kto istnieje, gdzie, jaki status). Dane biznesowe klientów (wizyty, pracownicy, usługi) żyją w bazach poszczególnych produktów.

---

## Aplikacje w systemie

| Aplikacja | Opis | Hosting |
|---|---|---|
| **Agency Dashboard** | Wewnętrzny panel dla zespołu firmy | Vercel (osobny projekt) |
| **HairSaaS** | Aplikacja dla salonów fryzjerskich | Vercel (projekt: hair-style) |
| **CafeSaaS** | Aplikacja dla kawiarni | Vercel (nowe repo) |
| **RestaurantSaaS** | Aplikacja dla restauracji | Vercel (nowe repo) |

---

## Agency Dashboard — szczegóły

### Routing

```
/dashboard
  /products                  → lista wszystkich produktów
  /products/[id]             → lista klientów danego produktu
  /products/[id]/new         → wizard onboardingu nowego klienta
  /clients/[id]              → szczegóły klienta
  /clients/[id]/domain       → status domeny, rekordy DNS
  /clients/[id]/settings     → ustawienia klienta
```

### Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js (App Router) |
| Baza danych | Neon Postgres (Vercel Marketplace) |
| Auth | Clerk — tylko dla zespołu firmy |
| Vercel integracja | Vercel API (REST) |
| Hosting | Vercel |

### Baza danych Agency Dashboard

```sql
Product
  id, name, vercelProjectId, vercelToken, baseDomain
  -- np. { name: "HairSaaS", baseDomain: "hairsaas.pl", vercelProjectId: "prj_xxx" }

Tenant
  id, productId, slug, customDomain, status, schemaVersion, businessName, email
  -- np. { slug: "salon-anna", customDomain: "salon-anna.pl", status: "active" }

TenantOnboarding
  tenantId, currentStep, completedAt, dnsVerified, dnsVerifiedAt
```

---

## Onboarding nowego klienta

### Przepływ (wizard)

```
Krok 1: Dane firmy       → nazwa, adres, telefon, email
Krok 2: Subdomena        → slug np. "salon-anna" → salon-anna.hairsaas.pl
Krok 3: Własna domena    → opcjonalne, np. salon-anna.pl
Krok 4: Wygląd           → logo, kolory brandingowe
Krok 5: Usługi startowe  → import z szablonu branżowego
Krok 6: Potwierdzenie    → automatyczny setup
```

### Co dzieje się w tle (krok 6)

```
1. Tworzy rekord Tenant w bazie Agency Dashboard
2. Wywołuje Vercel API → dodaje subdomenę do projektu produktu
3. Jeśli własna domena → dodaje ją też, zwraca rekordy DNS
4. Wysyła email klientowi z instrukcją DNS (jeśli własna domena)
5. Subdomena hairsaas.pl działa natychmiast (wildcard skonfigurowany)
6. Polling statusu weryfikacji DNS dla własnej domeny
```

### Vercel API — dodanie domeny

```bash
POST https://api.vercel.com/v10/projects/{projectId}/domains
Authorization: Bearer {VERCEL_TOKEN}
Body: { "name": "salon-anna.hairsaas.pl" }

# Odpowiedź dla własnej domeny zawiera rekordy DNS:
{
  "verification": [
    { "type": "TXT", "domain": "_vercel", "value": "vc-domain-verify=..." }
  ]
}
```

---

## Jak produkt (HairSaaS) identyfikuje klienta

```
Użytkownik wchodzi na salon-anna.hairsaas.pl
           ↓
middleware.ts czyta hostname
           ↓
odpytuje Agency Dashboard API: GET /api/tenant?domain=salon-anna.hairsaas.pl
           ↓
dostaje: { tenantId: "salon-anna", status: "active", ... }
           ↓
SET app.current_tenant = 'salon-anna'  ← ustawia kontekst w bazie
           ↓
wszystkie zapytania zwracają tylko dane tego salonu
```

---

## Baza danych produktu (np. HairSaaS)

### Struktura

Jedna wspólna baza Neon Postgres dla wszystkich klientów danego produktu. Każda tabela ma kolumnę `tenant_id`.

```sql
-- Wszyscy pracownicy wszystkich salonów w jednej tabeli
employees    (id, tenant_id, name, ...)
services     (id, tenant_id, name, price, duration, ...)
appointments (id, tenant_id, employee_id, client_id, date, ...)
clients      (id, tenant_id, name, phone, email, ...)
time_blocks  (id, tenant_id, ...)
```

### Row Level Security (RLS)

Zabezpieczenie na poziomie bazy — nawet jeśli kod aplikacji zapomni o filtrze `WHERE tenant_id`, baza sama blokuje dostęp do cudzych danych.

```sql
-- Konfiguracja raz per tabela
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON appointments
  USING (tenant_id = current_setting('app.current_tenant'));

-- W middleware przed każdym zapytaniem:
SET app.current_tenant = 'salon-anna';
-- Od tej chwili SELECT * FROM appointments zwraca TYLKO wizyty salon-anna
```

### Osobne bazy per produkt

```
neon-agency   ← Agency Dashboard (metadane, produkty, tenanci)
neon-hair     ← HairSaaS (dane wszystkich salonów)
neon-cafe     ← CafeSaaS (dane wszystkich kawiarni)
neon-restaurant
```

Dane fryzjerów nie mieszają się z danymi kawiarni. Agency Dashboard nie przechowuje danych biznesowych klientów.

---

## Konfiguracja Vercel per produkt

Każdy produkt potrzebuje:
- Wildcard domeny: `*.hairsaas.pl` skonfigurowanej w projekcie Vercel
- `VERCEL_TOKEN` z dostępem do projektu (przechowywany w Agency Dashboard)
- `AGENCY_API_URL` — adres Agency Dashboard API (do lookupów tenanta)

---

## Migracje bazy produktu

Przy wspólnej bazie z RLS migracje dotykają wszystkich klientów jednocześnie — na etapie do ~50 klientów jest to akceptowalne i proste. Przy większej skali lub potrzebie pełnej izolacji można przejść na osobne schematy Postgres per tenant i migrować sekwencyjnie klient po kliencie, śledząc `schema_version` w tabeli `Tenant` w Agency Dashboard.

---

## Co budujemy najpierw

1. Agency Dashboard — szkielet aplikacji, auth (Clerk), baza z tabelami Product/Tenant
2. Integracja Vercel API — dodawanie domen, polling DNS
3. Wizard onboardingu — kroki 1-6
4. Integracja z istniejącym projektem HairSaaS — middleware tenant lookup, RLS
5. Panel klienta — status, ustawienia, zmiana domeny
