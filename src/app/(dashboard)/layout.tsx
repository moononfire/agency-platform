import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-blue-950 px-6 py-3.5 flex items-center justify-between shadow-lg">
        <Link
          href="/dashboard/products"
          className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-white"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-black text-white text-sm select-none">
            A
          </div>
          Agency Platform
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-blue-300 hidden sm:block">
            {session.user.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-blue-200 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-900 cursor-pointer"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
