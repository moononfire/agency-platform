"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DnsPoller({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = () => {
    startTransition(() => {
      router.refresh();
      setLastChecked(new Date());
    });
  };

  useEffect(() => {
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
        {isPending ? "Sprawdzam…" : "Sprawdź ponownie"}
      </Button>
      {lastChecked && (
        <span>Ostatnie sprawdzenie: {lastChecked.toLocaleTimeString("pl-PL")}</span>
      )}
      <span className="text-xs">Auto-odświeżanie co 30s</span>
    </div>
  );
}
