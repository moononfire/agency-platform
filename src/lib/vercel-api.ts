const VERCEL_API = "https://api.vercel.com";

function getToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not set");
  return token;
}

async function vercelFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${VERCEL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel API ${res.status}: ${body}`);
  }
  return res.json();
}

export async function addDomain(projectId: string, domain: string) {
  return vercelFetch(`/v10/projects/${projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
}

export async function getDomainStatus(projectId: string, domain: string) {
  return vercelFetch(`/v9/projects/${projectId}/domains/${domain}`);
}

export async function removeDomain(projectId: string, domain: string) {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${projectId}/domains/${domain}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    }
  );
  if (!res.ok) throw new Error(`Vercel API ${res.status}`);
}
