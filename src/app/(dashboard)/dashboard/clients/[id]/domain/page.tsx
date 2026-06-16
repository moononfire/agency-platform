import { db } from "@/lib/db";
import { products, tenants, tenantOnboardings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDomainStatus } from "@/lib/vercel-api";
import { DnsPoller } from "@/components/DnsPoller";

export const dynamic = "force-dynamic";

type DnsRecord = {
  type: string;
  host: string;
  value: string;
};

function extractDnsRecords(
  domainData: Record<string, unknown>
): DnsRecord[] {
  const records: DnsRecord[] = [];

  const verification = domainData?.verification as
    | { type: string; domain: string; value: string }[]
    | undefined;

  if (Array.isArray(verification)) {
    for (const v of verification) {
      records.push({
        type: v.type ?? "TXT",
        host: v.domain ?? "@",
        value: v.value ?? "",
      });
    }
  }

  const apexName = domainData?.apexName as string | undefined;
  const fullName = domainData?.name as string | undefined;
  if (apexName && fullName && fullName !== apexName) {
    // Host must be the full name relative to the apex, not just the
    // first label — e.g. for "abc.chicken.example.com" with apex
    // "example.com" the host is "abc.chicken", not "abc".
    const host = fullName.endsWith(`.${apexName}`)
      ? fullName.slice(0, -(apexName.length + 1))
      : fullName.split(".")[0];
    records.push({
      type: "CNAME",
      host: host || "@",
      value: "cname.vercel-dns.com",
    });
  } else if (apexName) {
    records.push({
      type: "A",
      host: "@",
      value: "76.76.21.21",
    });
  }

  return records;
}

export default async function DomainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);

  if (!tenant) notFound();

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, tenant.productId))
    .limit(1);

  const [onboarding] = await db
    .select()
    .from(tenantOnboardings)
    .where(eq(tenantOnboardings.tenantId, id))
    .limit(1);

  const subdomain = `${tenant.slug}.${product?.baseDomain ?? ""}`;

  let subdomainData: Record<string, unknown> | null = null;
  let customDomainData: Record<string, unknown> | null = null;

  if (product) {
    try {
      subdomainData = await getDomainStatus(product.vercelProjectId, subdomain);
    } catch {
      // ignore
    }

    if (tenant.customDomain) {
      try {
        customDomainData = await getDomainStatus(product.vercelProjectId, tenant.customDomain);
      } catch {
        // ignore
      }
    }
  }

  const subdomainRecords = subdomainData
    ? extractDnsRecords(subdomainData)
    : [];
  const customDomainRecords = customDomainData
    ? extractDnsRecords(customDomainData)
    : [];

  const subdomainVerified =
    (subdomainData as { verified?: boolean } | null)?.verified ?? false;
  const customDomainVerified =
    (customDomainData as { verified?: boolean } | null)?.verified ?? false;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/clients/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {tenant.businessName}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Status DNS</h1>
      </div>

      {onboarding && !onboarding.dnsVerified && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          DNS jeszcze niezweryfikowany. Po skonfigurowaniu rekordów DNS
          weryfikacja następuje automatycznie (do 48h).{" "}
          <a
            href={`https://vercel.com/vs-projects-24dfb18b/${product?.vercelProjectId ?? ""}/settings/domains`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            Sprawdź w Vercel →
          </a>
        </div>
      )}

      <DomainSection
        title="Subdomena"
        domain={subdomain}
        verified={subdomainVerified}
        records={subdomainRecords}
        raw={subdomainData}
      />

      {tenant.customDomain && (
        <DomainSection
          title="Własna domena"
          domain={tenant.customDomain}
          verified={customDomainVerified}
          records={customDomainRecords}
          raw={customDomainData}
        />
      )}

      <DnsPoller tenantId={id} />
    </div>
  );
}

function DomainSection({
  title,
  domain,
  verified,
  records,
  raw,
}: {
  title: string;
  domain: string;
  verified: boolean;
  records: DnsRecord[];
  raw: Record<string, unknown> | null;
}) {
  return (
    <div className="bg-white rounded-xl border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            verified
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {verified ? "Zweryfikowany" : "Oczekuje"}
        </span>
      </div>
      <p className="text-sm font-mono text-muted-foreground">{domain}</p>

      {records.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">
            Wymagane rekordy DNS:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border rounded-lg overflow-hidden">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Typ</th>
                  <th className="text-left px-3 py-2 font-medium">Host</th>
                  <th className="text-left px-3 py-2 font-medium">Wartość</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono font-semibold">
                      {r.type}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.host}</td>
                    <td className="px-3 py-2 font-mono break-all">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!raw && (
        <p className="text-sm text-muted-foreground">
          Nie udało się pobrać statusu z Vercel API.
        </p>
      )}
    </div>
  );
}
