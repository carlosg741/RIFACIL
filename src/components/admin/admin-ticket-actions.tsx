"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ticketPublicUrl, whatsappShareUrl } from "@/lib/urls";
import { formatTicketNumber } from "@/lib/format";

export function AdminTicketActions({
  slug,
  orderId,
  phone,
  name,
  raffleTitle,
  numbers,
}: {
  slug: string;
  orderId: string;
  phone: string;
  name: string;
  raffleTitle: string;
  numbers: number[];
}) {
  const path = `/r/${slug}/ticket/${orderId}`;

  function sendWhatsApp() {
    const origin = window.location.origin;
    const url = ticketPublicUrl(slug, orderId, origin);
    const nums = numbers.map((n) => formatTicketNumber(n)).join(", ");
    const text =
      `Hola ${name}, aquí tienes tu ticket de *${raffleTitle}* (Rifacil).\n` +
      `Números: ${nums}\n` +
      `${url}`;
    window.open(whatsappShareUrl(phone, text), "_blank");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={path}
        target="_blank"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Ver / descargar ticket
      </Link>
      <Button size="sm" variant="secondary" type="button" onClick={sendWhatsApp}>
        WhatsApp ticket
      </Button>
    </div>
  );
}
