import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return auth(request as any);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
