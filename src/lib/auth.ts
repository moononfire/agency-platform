import NextAuth from "next-auth";
import type { OAuthConfig } from "next-auth/providers";

const VercelProvider: OAuthConfig<{
  sub: string;
  name: string;
  email: string;
  picture: string;
  preferred_username: string;
}> = {
  id: "vercel",
  name: "Vercel",
  type: "oauth",
  client: { token_endpoint_auth_method: "client_secret_post" },
  issuer: "https://vercel.com",
  authorization: {
    url: "https://vercel.com/oauth/authorize",
    params: { scope: "openid email profile" },
  },
  token: "https://api.vercel.com/login/oauth/token",
  userinfo: "https://api.vercel.com/login/oauth/userinfo",
  profile(profile) {
    return {
      id: profile.sub,
      name: profile.name,
      email: profile.email,
      image: profile.picture,
    };
  },
  clientId: process.env.VERCEL_OAUTH_CLIENT_ID!,
  clientSecret: process.env.VERCEL_OAUTH_CLIENT_SECRET!,
};

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [VercelProvider],
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ user }) {
      if (ALLOWED_EMAILS.length === 0) return true;
      return ALLOWED_EMAILS.includes((user.email ?? "").toLowerCase());
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});
