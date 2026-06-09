import NextAuth from "next-auth";
import type { OAuthConfig } from "next-auth/providers";

const VercelProvider: OAuthConfig<{
  user: { id: string; name: string; email: string; avatar: string };
}> = {
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
