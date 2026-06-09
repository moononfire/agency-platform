import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Agency Platform</h1>
          <p className="text-sm text-muted-foreground">
            Zaloguj się kontem Vercel aby kontynuować
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("vercel", { redirectTo: "/dashboard/products" });
          }}
        >
          <Button type="submit" className="w-full">
            Zaloguj się przez Vercel
          </Button>
        </form>
      </div>
    </div>
  );
}
