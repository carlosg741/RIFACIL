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
import { DonationCheckout } from "@/components/raffle/donation-checkout";
import { PaymentMethodDetails } from "@/components/raffle/payment-method-details";

type TicketView = {
  id: string;
  number: number;
  status: "available" | "reserved" | "paid" | "cancelled";
};

export function TicketGrid({
  raffle,
  tickets,
  paymentMethods,
}: {
  raffle: Raffle;
  tickets: TicketView[];
  paymentMethods: PaymentMethod[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [step, setStep] = useState<"grid" | "checkout" | "donate">("grid");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();
  const digits = padDigitsForTotal(raffle.totalTickets);

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

  const total = selected.length * Number(raffle.pricePerTicket);

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
    if (!name || !phone || !paymentMethodId) {
      toast.error("Completa nombre, teléfono y método de pago.");
      return;
    }
    startTransition(async () => {
      const res = await createReservation({
        raffleId: raffle.id,
        numbers: selected,
        name,
        phone,
        email,
        paymentMethodId,
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
        onBack={() => setStep("grid")}
      />
    );
  }

  if (step === "checkout") {
    const method = paymentMethods.find((m) => m.id === paymentMethodId);
    return (
      <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary">
            Completa tu participación
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.length} número(s):{" "}
            {selected.map((n) => formatTicketNumber(n, digits)).join(", ")} ·{" "}
            {formatMoney(total, raffle.currency)}
          </p>
        </div>

        <div className="space-y-4">
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
            <Label htmlFor="email">Email (opcional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <Select
              value={paymentMethodId}
              items={paymentMethods.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              onValueChange={(v) => setPaymentMethodId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Elige cómo pagar" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {method && (
          <PaymentMethodDetails
            method={method}
            amountLine={`Monto a pagar: ${formatMoney(total, raffle.currency)}`}
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
            {formatMoney(total, raffle.currency)}
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
