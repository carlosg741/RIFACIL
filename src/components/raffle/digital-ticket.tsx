"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ticketPublicUrl, whatsappShareUrl } from "@/lib/urls";
import {
  formatMoney,
  formatTicketNumber,
  padDigitsForTotal,
} from "@/lib/format";

type Props = {
  slug: string;
  orderId: string;
  raffleTitle: string;
  prize: string;
  participantName: string;
  participantPhone: string;
  numbers: number[];
  totalTickets: number;
  totalAmount: string;
  currency: string;
  status: string;
  drawAt?: Date | string | null;
  raffleStatus?: string;
  /** Si true, muestra acciones de admin (WhatsApp al teléfono del cliente) */
  adminMode?: boolean;
};

export function DigitalTicket({
  slug,
  orderId,
  raffleTitle,
  prize,
  participantName,
  participantPhone,
  numbers,
  totalTickets,
  totalAmount,
  currency,
  status,
  drawAt,
  raffleStatus,
  adminMode,
}: Props) {
  const ticketRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState("");
  const [origin, setOrigin] = useState("");
  const digits = padDigitsForTotal(totalTickets);
  const drawDate = drawAt ? new Date(drawAt) : null;
  const hasValidDraw =
    drawDate && !Number.isNaN(drawDate.getTime()) ? drawDate : null;
  const sorteoPath = `/r/${slug}/sorteo`;

  useEffect(() => {
    const base = window.location.origin;
    setOrigin(base);
    QRCode.toDataURL(ticketPublicUrl(slug, orderId, base), {
      width: 160,
      margin: 1,
      color: { dark: "#181a20", light: "#ffffff" },
    }).then(setQr);
  }, [slug, orderId]);

  const ticketUrl = origin
    ? ticketPublicUrl(slug, orderId, origin)
    : `/r/${slug}/ticket/${orderId}`;

  const statusLabel =
    status === "paid"
      ? "CONFIRMADO"
      : status === "under_review"
        ? "EN REVISIÓN"
        : status === "pending_payment"
          ? "PENDIENTE DE PAGO"
          : status.toUpperCase();

  async function copyLink() {
    await navigator.clipboard.writeText(ticketUrl);
    toast.success("Link del ticket copiado");
  }

  function printTicket() {
    window.print();
  }

  function sendWhatsApp() {
    const nums = numbers.map((n) => formatTicketNumber(n, digits)).join(", ");
    const drawLine = hasValidDraw
      ? `\nSorteo: ${format(hasValidDraw, "d MMM yyyy · HH:mm", { locale: es })}`
      : "";
    const text =
      `Tu ticket Rifacil — ${raffleTitle}\n` +
      `Números: ${nums}\n` +
      `Estado: ${statusLabel}` +
      drawLine +
      `\nVer / descargar: ${ticketUrl}` +
      `\nGanadores: ${origin || ""}${sorteoPath}`;
    window.open(whatsappShareUrl(participantPhone, text), "_blank");
  }

  return (
    <div className="space-y-4">
      <div
        ref={ticketRef}
        id="rifacil-ticket"
        className="overflow-hidden rounded-2xl border-2 border-primary bg-card text-card-foreground shadow-lg print:border-black print:shadow-none"
      >
        <div className="flex items-center justify-between gap-3 bg-primary px-5 py-3 text-primary-foreground">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/rifacil-logo.jpeg"
              alt=""
              className="h-8 w-8 rounded object-cover"
            />
            <span className="font-[family-name:var(--font-display)] text-lg font-bold">
              Rifacil
            </span>
          </div>
          <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-bold tracking-wide">
            {statusLabel}
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Rifa
              </p>
              <p className="font-[family-name:var(--font-display)] text-xl font-semibold">
                {raffleTitle}
              </p>
              <p className="text-sm text-muted-foreground">Premio: {prize}</p>
            </div>
            {hasValidDraw && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Fecha y hora del sorteo
                </p>
                <p className="font-binance-num font-semibold text-primary">
                  {format(hasValidDraw, "d MMMM yyyy · HH:mm", { locale: es })}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Participante
              </p>
              <p className="font-medium">{participantName}</p>
              <p className="text-sm text-muted-foreground">{participantPhone}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Números
              </p>
              <p className="font-binance-num text-3xl font-bold text-primary">
                {numbers.map((n) => formatTicketNumber(n, digits)).join(" · ")}
              </p>
            </div>
            <p className="font-binance-num text-sm text-muted-foreground">
              Total: {formatMoney(totalAmount, currency)} · ID{" "}
              {orderId.slice(0, 10)}
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-2">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR ticket"
                className="h-32 w-32 rounded bg-white p-1"
              />
            ) : (
              <div className="h-32 w-32 animate-pulse rounded bg-muted" />
            )}
            <p className="max-w-[8rem] text-center text-[10px] text-muted-foreground">
              Escanea para verificar
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="button" onClick={printTicket}>
          Imprimir / PDF
        </Button>
        <Button type="button" variant="outline" onClick={copyLink}>
          Copiar link del ticket
        </Button>
        <Link
          href={sorteoPath}
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          {raffleStatus === "drawn" ? "Ver ganadores" : "Ver resultado del sorteo"}
        </Link>
        {(adminMode || participantPhone) && (
          <Button type="button" variant="secondary" onClick={sendWhatsApp}>
            Enviar por WhatsApp
          </Button>
        )}
      </div>
    </div>
  );
}
