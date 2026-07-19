"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaymentMethod } from "@/db/schema";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar ${label}`}
      title={`Copiar ${label}`}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground transition hover:border-primary hover:text-primary"
    >
      {copied ? (
        <Check className="size-3.5 text-primary" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}

export function PaymentMethodDetails({
  method,
  amountLine,
  framed = true,
}: {
  method: PaymentMethod;
  amountLine?: string;
  framed?: boolean;
}) {
  const [qrOpen, setQrOpen] = useState(false);

  async function downloadQr() {
    if (!method.qrImageUrl) return;
    try {
      const res = await fetch(method.qrImageUrl);
      const blob = await res.blob();
      const ext =
        blob.type.includes("png")
          ? "png"
          : blob.type.includes("webp")
            ? "webp"
            : "jpg";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${method.name.toLowerCase().replace(/\s+/g, "-")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("QR descargado");
    } catch {
      window.open(method.qrImageUrl, "_blank", "noopener,noreferrer");
      toast.message("Abre la imagen y guárdala desde tu dispositivo");
    }
  }

  const body = (
    <>
      <div className="flex flex-wrap items-start gap-4">
        {method.qrImageUrl && (
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="group relative shrink-0 rounded-lg border border-border bg-white p-1 transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Ver QR en grande"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={method.qrImageUrl}
              alt={`QR ${method.name}`}
              className="h-32 w-32 object-contain"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-lg bg-black/55 py-1 text-center text-[10px] font-medium text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              Toca para ampliar
            </span>
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-primary">{method.name}</p>
          {method.accountHolder && (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1">
                <span className="text-muted-foreground">A nombre de:</span>{" "}
                <span className="break-words">{method.accountHolder}</span>
              </p>
              <CopyButton value={method.accountHolder} label="Nombre" />
            </div>
          )}
          {method.accountInfo && (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 font-binance-num text-base break-all">
                {method.accountInfo}
              </p>
              <CopyButton value={method.accountInfo} label="Número / cuenta" />
            </div>
          )}
          {method.documentId && (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1">
                <span className="text-muted-foreground">Cédula / DNI / ID:</span>{" "}
                <span className="font-binance-num break-all">
                  {method.documentId}
                </span>
              </p>
              <CopyButton value={method.documentId} label="Documento" />
            </div>
          )}
          {method.contactEmail && (
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 break-all">
                <span className="text-muted-foreground">Email:</span>{" "}
                {method.contactEmail}
              </p>
              <CopyButton value={method.contactEmail} label="Email" />
            </div>
          )}
          <p className="text-muted-foreground">{method.instructions}</p>
        </div>
      </div>
      {amountLine ? <p className="font-semibold">{amountLine}</p> : null}
    </>
  );

  return (
    <>
      {framed ? (
        <div className="space-y-3 rounded-xl bg-secondary/60 p-4 text-sm">
          {body}
        </div>
      ) : (
        <div className="space-y-3 text-sm">{body}</div>
      )}

      {method.qrImageUrl && (
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="sm:max-w-md" showCloseButton>
            <DialogHeader>
              <DialogTitle className="text-primary">
                QR · {method.name}
              </DialogTitle>
              <DialogDescription>
                Amplía el código para escanearlo o descárgalo a tu dispositivo.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={method.qrImageUrl}
                alt={`QR grande ${method.name}`}
                className="w-full max-w-[320px] rounded-xl border border-border bg-white object-contain p-3"
              />
              <Button type="button" className="w-full" onClick={downloadQr}>
                <Download className="size-4" />
                Descargar QR
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
