"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { releaseExpiredNow } from "@/lib/actions/admin";

export function ReleaseExpiredButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await releaseExpiredNow();
          toast.success(`Liberadas ${res.count} reservas expiradas`);
        })
      }
    >
      Liberar expirados
    </Button>
  );
}
