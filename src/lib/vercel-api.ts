const VERCEL_API = "https://api.vercel.com";

async function vercelFetch(
  path: string,
  token: string,
  options: RequestInit = {}
) {
  const res = await fetch(`${VERCEL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
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

export async function addDomain(
  projectId: string,
  token: string,
  domain: string
) {
  return vercelFetch(`/v10/projects/${projectId}/domains`, token, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });
}

export async function getDomainStatus(
  projectId: string,
  token: string,
  domain: string
) {
  return vercelFetch(`/v9/projects/${projectId}/domains/${domain}`, token);
}

export async function removeDomain(
  projectId: string,
  token: string,
  domain: string
) {
  const res = await fetch(
    `${VERCEL_API}/v9/projects/${projectId}/domains/${domain}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) throw new Error(`Vercel API ${res.status}`);
}
