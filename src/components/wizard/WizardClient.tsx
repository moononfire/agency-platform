"use client";

import { useQueryState, parseAsInteger, parseAsString } from "nuqs";
import { useActionState, useState } from "react";
import { createTenant } from "@/app/actions/tenants";
import { Button } from "@/components/ui/button";

const TOTAL_STEPS = 7;

const SERVICES = [
  "Strzyżenie damskie",
  "Strzyżenie męskie",
  "Koloryzacja",
  "Pielęgnacja brody",
  "Manicure",
  "Pedicure",
  "Masaż",
  "Makijaż",
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
              s === current
                ? "border-primary bg-primary text-primary-foreground"
                : s < current
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-white text-muted-foreground"
            }`}
          >
            {s < current ? "✓" : s}
          </div>
          {s < TOTAL_STEPS && (
            <div
              className={`h-0.5 w-8 ${s < current ? "bg-primary" : "bg-border"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function WizardClient({
  productId,
  baseDomain,
  productType,
}: {
  productId: string;
  productName: string;
  baseDomain: string;
  productType: "hair" | "courses";
}) {
  const [step, setStep] = useQueryState(
    "step",
    parseAsInteger.withDefault(1)
  );
  const [businessName, setBusinessName] = useQueryState(
    "bn",
    parseAsString.withDefault("")
  );
  const [email, setEmail] = useQueryState(
    "em",
    parseAsString.withDefault("")
  );
  const [phone, setPhone] = useQueryState(
    "ph",
    parseAsString.withDefault("")
  );
  const [address, setAddress] = useQueryState(
    "ad",
    parseAsString.withDefault("")
  );
  const [slug, setSlug] = useQueryState("sl", parseAsString.withDefault(""));
  const [customDomain, setCustomDomain] = useQueryState(
    "cd",
    parseAsString.withDefault("")
  );
  const [logoUrl, setLogoUrl] = useQueryState(
    "lu",
    parseAsString.withDefault("")
  );
  const [primaryColor, setPrimaryColor] = useQueryState(
    "pc",
    parseAsString.withDefault("#3b82f6")
  );
  const [services, setServices] = useQueryState(
    "sv",
    parseAsString.withDefault("")
  );
  const [adminName, setAdminName] = useQueryState(
    "an",
    parseAsString.withDefault("")
  );
  const [adminEmail, setAdminEmail] = useQueryState(
    "ae",
    parseAsString.withDefault("")
  );
  const [adminPassword, setAdminPassword] = useState("");

  const boundAction = createTenant.bind(null, productId);
  const [state, action, pending] = useActionState(boundAction, null);

  const selectedServices = services
    ? services.split(",").filter(Boolean)
    : [];

  const toggleService = (svc: string) => {
    const current = new Set(selectedServices);
    if (current.has(svc)) {
      current.delete(svc);
    } else {
      current.add(svc);
    }
    setServices([...current].join(","));
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const fieldClass =
    "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div className="bg-white rounded-xl border p-6">
      <StepIndicator current={step} />

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Dane firmy</h2>
          <div>
            <label className={labelClass}>
              Nazwa firmy <span className="text-destructive">*</span>
            </label>
            <input
              className={fieldClass}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Salon Anna"
            />
          </div>
          <div>
            <label className={labelClass}>
              Email <span className="text-destructive">*</span>
            </label>
            <input
              className={fieldClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kontakt@salon-anna.pl"
            />
          </div>
          <div>
            <label className={labelClass}>Telefon</label>
            <input
              className={fieldClass}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+48 123 456 789"
            />
          </div>
          <div>
            <label className={labelClass}>Adres</label>
            <input
              className={fieldClass}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ul. Kwiatowa 1, 00-001 Warszawa"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={next}
              disabled={!businessName || !email}
            >
              Dalej →
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Subdomena</h2>
          <div>
            <label className={labelClass}>
              Subdomena <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                className={fieldClass}
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="salon-anna"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                .{baseDomain}
              </span>
            </div>
            {slug && (
              <p className="text-sm text-muted-foreground mt-1">
                Adres klienta:{" "}
                <span className="font-mono text-foreground">
                  {slug}.{baseDomain}
                </span>
              </p>
            )}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prev}>
              ← Wstecz
            </Button>
            <Button onClick={next} disabled={!slug}>
              Dalej →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Własna domena</h2>
          <p className="text-sm text-muted-foreground">
            Opcjonalnie. DNS musisz skonfigurować po onboardingu.
          </p>
          <div>
            <label className={labelClass}>Własna domena</label>
            <input
              className={fieldClass}
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value.toLowerCase())}
              placeholder="www.salon-anna.pl"
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prev}>
              ← Wstecz
            </Button>
            <Button onClick={next}>Dalej →</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Wygląd</h2>
          <div>
            <label className={labelClass}>URL logo</label>
            <input
              className={fieldClass}
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div>
            <label className={labelClass}>Kolor główny</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border border-border"
              />
              <span className="text-sm font-mono text-muted-foreground">
                {primaryColor}
              </span>
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prev}>
              ← Wstecz
            </Button>
            <Button onClick={next}>Dalej →</Button>
          </div>
        </div>
      )}

      {step === 5 && productType === "hair" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Usługi startowe</h2>
          <p className="text-sm text-muted-foreground">
            Wybierz usługi do aktywacji od razu.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SERVICES.map((svc) => {
              const checked = selectedServices.includes(svc);
              return (
                <label
                  key={svc}
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checked
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleService(svc)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{svc}</span>
                </label>
              );
            })}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prev}>
              ← Wstecz
            </Button>
            <Button onClick={next}>Dalej →</Button>
          </div>
        </div>
      )}

      {step === 5 && productType === "courses" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Płatności Stripe</h2>
          <p className="text-sm text-muted-foreground">
            Klient połączy własne konto Stripe samodzielnie po utworzeniu —
            przyciskiem "Połącz Stripe" na stronie klienta. Do tego momentu
            aplikacja działa normalnie jako showcase; tylko przycisk płatności
            zwróci błąd, dopóki Stripe nie zostanie połączony.
          </p>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prev}>
              ← Wstecz
            </Button>
            <Button onClick={next}>Dalej →</Button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Konto admina</h2>
          <p className="text-sm text-muted-foreground">
            Pierwsze konto do logowania w aplikacji klienta.
          </p>
          <div>
            <label className={labelClass}>
              Imię i nazwisko <span className="text-destructive">*</span>
            </label>
            <input
              className={fieldClass}
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="Anna Kowalska"
            />
          </div>
          <div>
            <label className={labelClass}>
              Email logowania <span className="text-destructive">*</span>
            </label>
            <input
              className={fieldClass}
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="anna@salon-anna.pl"
            />
          </div>
          <div>
            <label className={labelClass}>
              Hasło <span className="text-destructive">*</span>
            </label>
            <input
              className={fieldClass}
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Minimum 8 znaków"
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={prev}>
              ← Wstecz
            </Button>
            <Button
              onClick={next}
              disabled={!adminName || !adminEmail || adminPassword.length < 8}
            >
              Dalej →
            </Button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Potwierdzenie</h2>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <Row label="Firma" value={businessName} />
            <Row label="Email" value={email} />
            {phone && <Row label="Telefon" value={phone} />}
            {address && <Row label="Adres" value={address} />}
            <Row
              label="Subdomena"
              value={`${slug}.${baseDomain}`}
              mono
            />
            {customDomain && (
              <Row label="Własna domena" value={customDomain} mono />
            )}
            {primaryColor && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Kolor</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <span className="font-mono">{primaryColor}</span>
                </div>
              </div>
            )}
            {selectedServices.length > 0 && (
              <Row
                label="Usługi"
                value={selectedServices.join(", ")}
              />
            )}
            <Row label="Admin" value={adminEmail} />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
              {state.error}
            </p>
          )}

          <form
            action={action}
            className="space-y-0"
          >
            <input type="hidden" name="businessName" value={businessName} />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="address" value={address} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="customDomain" value={customDomain} />
            <input type="hidden" name="logoUrl" value={logoUrl} />
            <input type="hidden" name="primaryColor" value={primaryColor} />
            <input type="hidden" name="services" value={services} />
            <input type="hidden" name="adminName" value={adminName} />
            <input type="hidden" name="adminEmail" value={adminEmail} />
            <input type="hidden" name="adminPassword" value={adminPassword} />
            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={prev}
                disabled={pending}
              >
                ← Wstecz
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Tworzenie…" : "Utwórz klienta"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : "font-medium"}>{value}</span>
    </div>
  );
}
