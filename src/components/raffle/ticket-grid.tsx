"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dices, HeartHandshake } from "lucide-react";
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
import { createReservation } from "@/lib/actions/public";
import {
  formatMoney,
  formatTicketNumber,
  padDigitsForTotal,
} from "@/lib/format";
import type { PaymentMethod, Raffle } from "@/db/schema";
import { currencyLabel } from "@/lib/currencies";
import { DonationCheckout } from "@/components/raffle/donation-checkout";
import { PaymentMethodDetails } from "@/components/raffle/payment-method-details";

type TicketView = {
  id: string;
  number: number;
  status: "available" | "reserved" | "paid" | "cancelled";
};

export type CurrencyView = {
  code: string;
  pricePerTicket: string;
};

export function TicketGrid({
  raffle,
  tickets,
  paymentMethods,
  currencies,
}: {
  raffle: Raffle;
  tickets: TicketView[];
  paymentMethods: PaymentMethod[];
  currencies: CurrencyView[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [step, setStep] = useState<"grid" | "checkout" | "donate">("grid");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [documentId, setDocumentId] = useState("");
  const currencyList = currencies.length
    ? currencies
    : [{ code: raffle.currency, pricePerTicket: raffle.pricePerTicket }];
  const [currencyCode, setCurrencyCode] = useState(currencyList[0]!.code);
  const activeCurrency =
    currencyList.find((c) => c.code === currencyCode) ?? currencyList[0]!;
  const methodsForCurrency = useMemo(
    () =>
      paymentMethods.filter(
        (m) => !m.currency || m.currency === activeCurrency.code,
      ),
    [paymentMethods, activeCurrency.code],
  );
  const [paymentMethodId, setPaymentMethodId] = useState(
    methodsForCurrency[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();
  const digits = padDigitsForTotal(raffle.totalTickets);

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

  const stats = useMemo(() => {
    const available = tickets.filter((t) => t.status === "available").length;
    const reserved = tickets.filter((t) => t.status === "reserved").length;
    const paid = tickets.filter((t) => t.status === "paid").length;
    return { available, reserved, paid };
  }, [tickets]);

  const availableNumbers = useMemo(
    () => tickets.filter((t) => t.status === "available").map((t) => t.number),
    [tickets],
  );

  const total = selected.length * Number(activeCurrency.pricePerTicket);

  function toggle(n: number, status: TicketView["status"]) {
    if (status !== "available") return;
    setSelected((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : [...prev, n].sort((a, b) => a - b),
    );
  }

  function pickRandom() {
    const free = availableNumbers.filter((n) => !selected.includes(n));
    if (free.length === 0) {
      toast.error("No hay tickets disponibles para seleccionar al azar.");
      return;
    }
    const pick = free[Math.floor(Math.random() * free.length)]!;
    setSelected((prev) => [...prev, pick].sort((a, b) => a - b));
    toast.success(
      `Ticket ${formatTicketNumber(pick, digits)} seleccionado al azar`,
    );
  }

  function submit() {
    const method = methodsForCurrency.find((m) => m.id === paymentMethodId);
    if (!name || !phone || !paymentMethodId) {
      toast.error("Completa nombre, teléfono y método de pago.");
      return;
    }
    if (method?.requiresDocumentId && documentId.trim().length < 4) {
      toast.error("Ingresa tu cédula / DNI / ID.");
      return;
    }
    if (method?.requiresEmail && !email.trim()) {
      toast.error("Ingresa tu email.");
      return;
    }
    startTransition(async () => {
      const res = await createReservation({
        raffleId: raffle.id,
        numbers: selected,
        name,
        phone,
        email,
        documentId,
        paymentMethodId,
        currency: activeCurrency.code,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Números apartados. Sube tu comprobante.");
      router.push(`/r/${raffle.slug}/orden/${res.orderId}`);
    });
  }

  if (step === "donate") {
    return (
      <DonationCheckout
        raffle={raffle}
        paymentMethods={paymentMethods}
        currencies={currencyList}
        onBack={() => setStep("grid")}
      />
    );
  }

  if (step === "checkout") {
    const method = methodsForCurrency.find((m) => m.id === paymentMethodId);
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary">
            Completa tu participación
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.length} número(s):{" "}
            {selected.map((n) => formatTicketNumber(n, digits)).join(", ")} ·{" "}
            {formatMoney(total, activeCurrency.code)}
          </p>
        </div>

        <div className="space-y-4">
          {currencyList.length > 1 && (
            <div className="space-y-2">
              <Label>Moneda de pago</Label>
              <Select
                value={activeCurrency.code}
                items={currencyList.map((c) => ({
                  value: c.code,
                  label: `${currencyLabel(c.code)} · ${formatMoney(
                    c.pricePerTicket,
                    c.code,
                  )} / número`,
                }))}
                onValueChange={(v) => changeCurrency(v ?? activeCurrency.code)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elige tu moneda" />
                </SelectTrigger>
                <SelectContent>
                  {currencyList.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {currencyLabel(c.code)} ·{" "}
                      {formatMoney(c.pricePerTicket, c.code)} / número
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp / teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="999 888 777"
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
          {method?.requiresDocumentId && (
            <div className="space-y-2">
              <Label htmlFor="documentId">Cédula / DNI / ID</Label>
              <Input
                id="documentId"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                placeholder="Número de documento"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email{method?.requiresEmail ? "" : " (opcional)"}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required={Boolean(method?.requiresEmail)}
            />
          </div>
        </div>

        {method && (
          <PaymentMethodDetails
            method={method}
            amountLine={`Monto a pagar: ${formatMoney(total, activeCurrency.code)}`}
          />
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setStep("grid")}
            disabled={pending}
          >
            Volver
          </Button>
          <Button className="flex-1" onClick={submit} disabled={pending}>
            {pending ? "Apartando…" : "Apartar y continuar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 pb-28">
      {currencyList.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Pagar en:</span>
          {currencyList.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => changeCurrency(c.code)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                c.code === activeCurrency.code
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50"
              }`}
            >
              {c.code} · {formatMoney(c.pricePerTicket, c.code)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm border bg-white" /> Disponibles{" "}
          {stats.available}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-amber-200" /> Apartados{" "}
          {stats.reserved}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-emerald-700" /> Pagados{" "}
          {stats.paid}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {tickets.map((t) => {
          const isSelected = selected.includes(t.number);
          const cls =
            t.status === "paid"
              ? "ticket-paid"
              : t.status === "reserved"
                ? "ticket-reserved"
                : isSelected
                  ? "ticket-selected"
                  : "ticket-available";
          return (
            <button
              key={t.id}
              type="button"
              disabled={t.status !== "available"}
              onClick={() => toggle(t.number, t.status)}
              className={`aspect-square rounded-lg border text-sm font-semibold transition ${cls}`}
            >
              {formatTicketNumber(t.number, digits)}
            </button>
          );
        })}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex justify-center gap-2 px-4 sm:bottom-28">
        <button
          type="button"
          onClick={pickRandom}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-semibold text-[#0b8a8a] shadow-lg transition hover:scale-[1.02]"
        >
          <Dices className="size-4" />
          Seleccionar al azar
        </button>
        {raffle.donationsEnabled && (
          <button
            type="button"
            onClick={() => setStep("donate")}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-[1.02]"
          >
            <HeartHandshake className="size-4" />
            Donar / Colaborar
          </button>
        )}
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
        <div>
          <p className="text-sm text-muted-foreground">
            {selected.length === 0
              ? "Escoge 1 o más tickets"
              : `${selected.length} seleccionados`}
          </p>
          <p className="font-binance-num font-semibold text-primary">
            {formatMoney(total, activeCurrency.code)}
          </p>
        </div>
        <Button
          size="lg"
          disabled={selected.length === 0 || paymentMethods.length === 0}
          onClick={() => setStep("checkout")}
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
