"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function DeleteClientButton({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        if (!confirm("Czy na pewno chcesz usunąć tego klienta? Tej operacji nie można cofnąć.")) return;
        startTransition(() => action(formData));
      }}
    >
      <Button variant="destructive" size="sm" type="submit" disabled={pending}>
        {pending ? "Usuwanie…" : "Usuń klienta"}
      </Button>
    </form>
  );
}
