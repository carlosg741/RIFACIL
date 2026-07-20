"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rafflePublicUrl, whatsappShareUrl } from "@/lib/urls";

export function RaffleSharePanel({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");

  useEffect(() => {
    const base = window.location.origin;
    setOrigin(base);
    const url = rafflePublicUrl(slug, base);
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: "#181a20", light: "#fcd535" },
    }).then(setQr);
  }, [slug]);

  const url = origin ? rafflePublicUrl(slug, origin) : `/r/${slug}`;

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  function downloadQr() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `rifacil-${slug}-qr.png`;
    a.click();
  }

  const waText = `Participa en la rifa *${title}* con Rifacil:\n${url}`;

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-5">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-primary">
        Comparte tu evento
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Envía este link o el QR a tus participantes para que elijan números.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="QR del talonario"
            className="mx-auto h-44 w-44 rounded-lg border border-border sm:mx-0"
          />
        ) : (
          <div className="mx-auto h-44 w-44 animate-pulse rounded-lg bg-muted sm:mx-0" />
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="break-all rounded-lg bg-secondary/80 px-3 py-2 font-binance-num text-sm">
            {url}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={copyLink}>
              Copiar link
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={downloadQr}>
              Descargar QR
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                window.open(whatsappShareUrl("", waText), "_blank")
              }
            >
              WhatsApp
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(url, "_blank")}
            >
              Abrir página pública
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
