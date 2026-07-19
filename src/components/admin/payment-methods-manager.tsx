"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPaymentMethod,
  deletePaymentMethod,
  updatePaymentMethod,
} from "@/lib/actions/admin";
import { CURRENCY_OPTIONS, currencyLabel } from "@/lib/currencies";
import type { PaymentMethod } from "@/db/schema";

const ALL_CURRENCIES = "__all__";

const CURRENCY_SELECT_ITEMS = [
  { value: ALL_CURRENCIES, label: "Todas las monedas" },
  ...CURRENCY_OPTIONS.map((option) => ({
    value: option.code,
    label: option.label,
  })),
];

type MethodRow = {
  method: PaymentMethod;
  raffleTitle: string | null;
  raffleSlug: string | null;
};

type RaffleOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

export function PaymentMethodsManager({
  methods,
  raffles,
}: {
  methods: MethodRow[];
  raffles: RaffleOption[];
}) {
  const router = useRouter();
  const qrRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [raffleId, setRaffleId] = useState(raffles[0]?.id ?? "");
  const [name, setName] = useState("");
  const [accountInfo, setAccountInfo] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [instructions, setInstructions] = useState("");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [currency, setCurrency] = useState(ALL_CURRENCIES);

  async function uploadQr(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("image", file);
      const res = await fetch("/api/upload-raffle-image", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as {
        ok: boolean;
        url?: string;
        error?: string;
      };
      if (!data.ok || !data.url) {
        toast.error(data.error || "No se pudo subir el QR");
        return;
      }
      if (data.url.startsWith("data:")) {
        toast.error(
          "El QR no se guardó bien. Configura Blob Storage en Vercel.",
        );
        return;
      }
      setQrImageUrl(data.url);
      toast.success("QR cargado");
    } catch {
      toast.error("Error al subir el QR");
    } finally {
      setUploading(false);
      if (qrRef.current) qrRef.current.value = "";
    }
  }

  function resetForm() {
    setName("");
    setAccountInfo("");
    setAccountHolder("");
    setInstructions("");
    setQrImageUrl("");
    setCurrency(ALL_CURRENCIES);
  }

  function create() {
    if (!raffleId) {
      toast.error("Elige la rifa donde aparecerá este método");
      return;
    }
    start(async () => {
      const res = await createPaymentMethod({
        name,
        instructions,
        raffleId,
        accountInfo,
        accountHolder,
        qrImageUrl: qrImageUrl || undefined,
        currency: currency === ALL_CURRENCIES ? undefined : currency,
        active: true,
        sortOrder: methods.length + 1,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Método creado para esa rifa");
        resetForm();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      {raffles.length === 0 && (
        <p className="rounded-xl border border-amber-500/40 bg-card p-4 text-sm text-amber-200">
          Primero crea una rifa. Luego podrás asignarle métodos de pago.
        </p>
      )}

      <div className="space-y-3">
        {methods.map(({ method: m, raffleTitle, raffleSlug }) => (
          <div key={m.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 gap-4">
                {m.qrImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.qrImageUrl}
                    alt={`QR ${m.name}`}
                    className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover bg-white"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold text-primary">
                    {m.name}{" "}
                    {!m.active && (
                      <span className="text-xs text-muted-foreground">
                        (inactivo)
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Rifa:{" "}
                    {raffleSlug ? (
                      <a href={`/r/${raffleSlug}`} className="underline">
                        {raffleTitle || raffleSlug}
                      </a>
                    ) : (
                      <span className="text-amber-300">Sin rifa asignada</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Moneda:{" "}
                    {m.currency ? currencyLabel(m.currency) : "Todas las monedas"}
                  </p>
                  {m.accountHolder && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">A nombre de:</span>{" "}
                      {m.accountHolder}
                    </p>
                  )}
                  {m.accountInfo && (
                    <p className="font-binance-num text-sm">{m.accountInfo}</p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {m.instructions}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {raffles.length > 0 && (
                  <Select
                    value={m.raffleId || raffles[0]!.id}
                    items={raffles.map((r) => ({
                      value: r.id,
                      label: r.title,
                    }))}
                    onValueChange={(v) =>
                      start(async () => {
                        if (!v) return;
                        await updatePaymentMethod(m.id, { raffleId: v });
                        toast.success("Rifa del método actualizada");
                        router.refresh();
                      })
                    }
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Cambiar rifa" />
                    </SelectTrigger>
                    <SelectContent>
                      {raffles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select
                  value={m.currency || ALL_CURRENCIES}
                  items={CURRENCY_SELECT_ITEMS}
                  onValueChange={(v) =>
                    start(async () => {
                      if (!v) return;
                      await updatePaymentMethod(m.id, {
                        currency: v === ALL_CURRENCIES ? "" : v,
                      });
                      toast.success("Moneda del método actualizada");
                      router.refresh();
                    })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Moneda del método" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_SELECT_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await updatePaymentMethod(m.id, { active: !m.active });
                        router.refresh();
                      })
                    }
                  >
                    {m.active ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await deletePaymentMethod(m.id);
                        toast.success("Eliminado");
                        router.refresh();
                      })
                    }
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="max-w-lg space-y-4 rounded-xl border bg-card p-6">
        <h2 className="font-semibold text-primary">Agregar método</h2>

        <div className="space-y-2">
          <Label>Rifa donde aparecerá</Label>
          <Select
            value={raffleId}
            items={raffles.map((r) => ({
              value: r.id,
              label: `${r.title} (/r/${r.slug})`,
            }))}
            onValueChange={(v) => setRaffleId(v ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elige una rifa" />
            </SelectTrigger>
            <SelectContent>
              {raffles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title} (/r/{r.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Solo se mostrará en el talonario de esa rifa (demo vs reales separados).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Nombre del método</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yape, Plin, PayPal, Wise, Binance…"
          />
        </div>

        <div className="space-y-2">
          <Label>Moneda que acepta</Label>
          <Select
            value={currency}
            items={CURRENCY_SELECT_ITEMS}
            onValueChange={(v) => setCurrency(v ?? ALL_CURRENCIES)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todas las monedas" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_SELECT_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Al elegir una moneda, este método solo se mostrará a quienes paguen
            en esa moneda.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Número / cuenta</Label>
          <Input
            value={accountInfo}
            onChange={(e) => setAccountInfo(e.target.value)}
            placeholder="999 888 777 o número de cuenta"
          />
        </div>

        <div className="space-y-2">
          <Label>Nombre de la persona (titular)</Label>
          <Input
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="Nombre como aparece en la billetera o cuenta"
          />
        </div>

        <div className="space-y-2">
          <Label>Instrucciones</Label>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="Indica cómo deben pagar y qué deben subir como comprobante"
          />
        </div>

        <div className="space-y-2">
          <Label>QR del método de pago (opcional)</Label>
          {qrImageUrl ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="QR método de pago"
                className="h-40 w-40 rounded-lg border border-border object-contain bg-white p-2"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => setQrImageUrl("")}
              >
                Quitar QR
              </Button>
            </div>
          ) : null}
          <input
            ref={qrRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            disabled={uploading || pending}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-accent"
            onChange={(e) => uploadQr(e.target.files?.[0])}
          />
        </div>

        <Button
          disabled={
            pending ||
            uploading ||
            !name ||
            !instructions ||
            !raffleId ||
            raffles.length === 0
          }
          onClick={create}
        >
          Guardar método
        </Button>
      </div>
    </div>
  );
}
