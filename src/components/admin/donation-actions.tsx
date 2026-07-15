"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmDonation, rejectDonation } from "@/lib/actions/admin";

export function DonationActions({ donationId }: { donationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await confirmDonation(donationId);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Donación confirmada");
              router.refresh();
            }
          })
        }
      >
        Confirmar
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await rejectDonation(donationId);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Donación rechazada");
              router.refresh();
            }
          })
        }
      >
        Rechazar
      </Button>
    </div>
  );
}
