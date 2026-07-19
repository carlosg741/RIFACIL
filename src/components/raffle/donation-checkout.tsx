"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDonation } from "@/lib/actions/public";
import { currencyLabel } from "@/lib/currencies";
import { formatMoney } from "@/lib/format";
import type { PaymentMethod, Raffle } from "@/db/schema";
import type { CurrencyView } from "@/components/raffle/ticket-grid";
import { PaymentMethodDetails } from "@/components/raffle/payment-method-details";

export function DonationCheckout({
  raffle,
  paymentMethods,
  currencies,
  onBack,
}: {
  raffle: Raffle;
  paymentMethods: PaymentMethod[];
  currencies: CurrencyView[];
  onBack: () => void;
}) {
  const router = useRouter();
  const proofRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const currencyList = currencies.length
    ? currencies
    : [{ code: raffle.currency, pricePerTicket: raffle.pricePerTicket }];
  const [currencyCode, setCurrencyCode] = useState(currencyList[0]!.code);
  const methodsForCurrency = useMemo(
    () =>
      paymentMethods.filter((m) => !m.currency || m.currency === currencyCode),
    [paymentMethods, currencyCode],
  );
  const [paymentMethodId, setPaymentMethodId] = useState(
    methodsForCurrency[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();

  function changeCurrency(code: string) {
    setCurrencyCode(code);
    const nextMethods = paymentMethods.filter(
      (m) => !m.currency || m.currency === code,
    );
    setPaymentMethodId((current) =>
      nextMethods.some((m) => m.id === current)
        ? current
        : (nextMethods[0]?.id ?? ""),
    );
  }

  const method = methodsForCurrency.find((m) => m.id === paymentMethodId);
  const amountNum = Number(amount);

  function submit() {
    if (!name || !phone || !paymentMethodId) {
      toast.error("Completa nombre, teléfono y método de pago.");
      return;
    }
    if (!amountNum || amountNum <= 0) {
      toast.error("Ingresa un monto válido para donar.");
      return;
    }
    const file = proofRef.current?.files?.[0];
    if (!file) {
      toast.error("Adjunta el comprobante de tu donación.");
      return;
    }

    startTransition(async () => {
      const created = await createDonation({
        raffleId: raffle.id,
        amount: amountNum,
        name,
        phone,
        email,
        paymentMethodId,
        currency: currencyCode,
      });
      if (!created.ok) {
        toast.error(created.error);
        return;
      }

      const body = new FormData();
      body.set("donationId", created.donationId);
      body.set("proof", file);
      const res = await fetch("/api/upload-donation-proof", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        toast.error(data.error || "No se pudo subir el comprobante");
        router.push(`/r/${created.slug}/donacion/${created.donationId}`);
        return;
      }

      toast.success("Donación enviada. Gracias por colaborar.");
      router.push(`/r/${created.slug}/donacion/${created.donationId}`);
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary">
          Completa tu donación
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aporta a “{raffle.title}” sin necesidad de tomar un número de la rifa.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="donor-name">Nombre completo</Label>
          <Input
            id="donor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="donor-phone">WhatsApp / teléfono</Label>
          <Input
            id="donor-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="999 888 777"
          />
        </div>
        {currencyList.length > 1 && (
          <div className="space-y-2">
            <Label>Moneda de la donación</Label>
            <Select
              value={currencyCode}
              items={currencyList.map((c) => ({
                value: c.code,
                label: currencyLabel(c.code),
              }))}
              onValueChange={(v) => changeCurrency(v ?? currencyCode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige tu moneda" />
              </SelectTrigger>
              <SelectContent>
                {currencyList.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {currencyLabel(c.code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="donor-amount">Monto a donar ({currencyCode})</Label>
          <Input
            id="donor-amount"
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ej. 20"
          />
        </div>
        <div className="space-y-2">
          <Label>Método de pago</Label>
            <Select
              value={paymentMethodId}
              items={methodsForCurrency.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              onValueChange={(v) => setPaymentMethodId(v ?? "")}
            >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elige cómo pagar" />
            </SelectTrigger>
            <SelectContent>
              {methodsForCurrency.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {methodsForCurrency.length === 0 && (
            <p className="text-xs text-amber-400">
              No hay métodos de pago para esta moneda. Elige otra moneda.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="donor-email">Email (opcional)</Label>
          <Input
            id="donor-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
          />
        </div>
      </div>

      {method && (
        <PaymentMethodDetails
          method={method}
          amountLine={
            amountNum > 0
              ? `Monto a donar: ${formatMoney(amountNum, currencyCode)}`
              : undefined
          }
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="donation-proof">Comprobante de pago</Label>
        <input
          ref={proofRef}
          id="donation-proof"
          type="file"
          accept="image/*,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
          required
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground"
        />
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onBack}
          disabled={pending}
        >
          Volver
        </Button>
        <Button
          className="flex-1"
          onClick={submit}
          disabled={pending || paymentMethods.length === 0}
        >
          {pending ? "Enviando…" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
