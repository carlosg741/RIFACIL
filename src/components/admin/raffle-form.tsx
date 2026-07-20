"use client";

import { useState, useTransition } from "react";
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
import { createRaffle, updateRaffle } from "@/lib/actions/admin";
import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { toLocalDateTimeValue } from "@/lib/urls";
import type { Raffle, RaffleCurrency, RafflePrize } from "@/db/schema";

type PrizeDraft = {
  key: string;
  title: string;
  description: string;
  imageUrl: string;
};

type CurrencyDraft = {
  key: string;
  code: string;
  price: string;
};

function currencyOptionsFor(code: string) {
  if (CURRENCY_OPTIONS.some((option) => option.code === code)) {
    return CURRENCY_OPTIONS;
  }
  return [{ code, label: code }, ...CURRENCY_OPTIONS];
}

function newPrize(position: number, key = `new-prize-${position}`): PrizeDraft {
  return {
    key,
    title: position === 1 ? "" : `${position}.º premio`,
    description: "",
    imageUrl: "",
  };
}

export function RaffleForm({
  raffle,
  initialPrizes = [],
  initialCurrencies = [],
}: {
  raffle?: Raffle;
  initialPrizes?: RafflePrize[];
  initialCurrencies?: RaffleCurrency[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [status, setStatus] = useState(raffle?.status || "active");
  const [drawAt, setDrawAt] = useState(
    raffle?.drawAt ? toLocalDateTimeValue(new Date(raffle.drawAt)) : "",
  );
  const [coverImageUrl, setCoverImageUrl] = useState(raffle?.imageUrl || "");
  const [prizes, setPrizes] = useState<PrizeDraft[]>(() => {
    if (initialPrizes.length > 0) {
      return initialPrizes.map((prize) => ({
        key: prize.id,
        title: prize.title,
        description: prize.description || "",
        imageUrl: prize.imageUrl || "",
      }));
    }
    if (raffle) {
      return [
        {
          key: `${raffle.id}-legacy`,
          title: raffle.prize,
          description: "",
          imageUrl: "",
        },
      ];
    }
    return [newPrize(1)];
  });
  const [currencies, setCurrencies] = useState<CurrencyDraft[]>(() => {
    if (initialCurrencies.length > 0) {
      return initialCurrencies.map((item) => ({
        key: item.id,
        code: item.code,
        price: String(item.pricePerTicket),
      }));
    }
    if (raffle) {
      return [
        {
          key: `${raffle.id}-legacy-currency`,
          code: raffle.currency,
          price: String(raffle.pricePerTicket),
        },
      ];
    }
    return [{ key: "currency-1", code: "PEN", price: "10" }];
  });
  const [donationsEnabled, setDonationsEnabled] = useState(
    raffle?.donationsEnabled ?? false,
  );
  const [type, setType] = useState<"raffle" | "collection">(
    (raffle?.type as "raffle" | "collection") || "raffle",
  );
  const [goalAmount, setGoalAmount] = useState(
    raffle?.goalAmount ? String(raffle.goalAmount) : "",
  );
  const [totalTicketsForConvert, setTotalTicketsForConvert] = useState("100");
  const isEdit = Boolean(raffle);
  const isCollection = type === "collection";
  // Al editar: ¿esta rifa era una recolecta sin números? (para permitir convertir)
  const wasCollection = (raffle?.type as string) === "collection";
  const uploading = uploadingCover || uploadingIndex !== null;

  function updatePrize(index: number, patch: Partial<PrizeDraft>) {
    setPrizes((current) =>
      current.map((prize, prizeIndex) =>
        prizeIndex === index ? { ...prize, ...patch } : prize,
      ),
    );
  }

  function updateCurrency(index: number, patch: Partial<CurrencyDraft>) {
    setCurrencies((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function moveCurrency(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= currencies.length) return;
    setCurrencies((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  function movePrize(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= prizes.length) return;
    setPrizes((current) => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  async function uploadImage(file: File) {
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
      throw new Error(data.error || "No se pudo subir la imagen");
    }
    if (data.url.startsWith("data:")) {
      throw new Error(
        "La imagen no se guardó bien en el servidor. Configura Blob Storage en Vercel e inténtalo de nuevo.",
      );
    }
    return data.url;
  }

  async function onCoverImageSelected(file: File | undefined) {
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadImage(file);
      setCoverImageUrl(url);
      toast.success("Imagen del evento cargada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setUploadingCover(false);
    }
  }

  async function onPrizeImageSelected(index: number, file: File | undefined) {
    if (!file) return;
    setUploadingIndex(index);
    try {
      const url = await uploadImage(file);
      updatePrize(index, { imageUrl: url });
      toast.success(`Imagen del premio ${index + 1} cargada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setUploadingIndex(null);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const drawFromForm = String(fd.get("drawAt") || drawAt || "");
    // Convertir recolecta → rifa también exige fecha de sorteo.
    if (!isCollection && !drawFromForm) {
      toast.error("Elige la fecha del sorteo");
      return;
    }

    // En recolecta no hay premios; usamos el título como referencia.
    const normalizedPrizes = isCollection
      ? []
      : prizes.map((prize) => ({
          title: prize.title.trim(),
          description: prize.description.trim() || undefined,
          imageUrl: prize.imageUrl.trim() || undefined,
        }));
    if (!isCollection) {
      if (normalizedPrizes.some((prize) => prize.title.length < 2)) {
        toast.error("Escribe el nombre de todos los premios.");
        return;
      }
      if (
        normalizedPrizes.some((prize) => (prize.description?.length ?? 0) > 2000)
      ) {
        toast.error("La descripción de un premio supera los 2000 caracteres.");
        return;
      }
      if (
        normalizedPrizes.some(
          (prize) =>
            prize.imageUrl &&
            (prize.imageUrl.startsWith("data:") ||
              prize.imageUrl.length > 2000),
        )
      ) {
        toast.error(
          "La imagen del premio debe subirse con “Adjuntar imagen” o usar una URL http/https. No pegues la imagen en base64.",
        );
        return;
      }
    }
    const firstPrize = normalizedPrizes[0];

    const normalizedCurrencies = currencies.map((item) => ({
      code: item.code.trim().toUpperCase(),
      // En recolecta no hay precio por número; el monto lo elige el donante.
      pricePerTicket: isCollection ? 1 : Number(item.price),
    }));
    if (normalizedCurrencies.some((item) => item.code.length < 2)) {
      toast.error("Cada moneda necesita un código válido.");
      return;
    }
    if (
      !isCollection &&
      normalizedCurrencies.some(
        (item) => !item.pricePerTicket || item.pricePerTicket <= 0,
      )
    ) {
      toast.error("Cada moneda necesita un precio mayor a 0.");
      return;
    }
    const codes = normalizedCurrencies.map((item) => item.code);
    if (new Set(codes).size !== codes.length) {
      toast.error("Hay monedas repetidas. Cada moneda debe ser distinta.");
      return;
    }
    const firstCurrency = normalizedCurrencies[0]!;

    const goalNum = Number(goalAmount);
    // Números al convertir recolecta → rifa (solo si no tenía números).
    const convertTickets =
      isEdit && wasCollection && !isCollection
        ? Number(totalTicketsForConvert)
        : Number(fd.get("totalTickets"));

    const payload = {
      title: String(fd.get("title") || ""),
      slug: String(fd.get("slug") || "") || undefined,
      description: String(fd.get("description") || ""),
      type,
      goalAmount: isCollection && goalNum > 0 ? goalNum : undefined,
      prize: firstPrize?.title ?? String(fd.get("title") || ""),
      pricePerTicket: firstCurrency.pricePerTicket,
      currency: firstCurrency.code,
      currencies: normalizedCurrencies,
      totalTickets: isCollection ? 0 : convertTickets,
      reservationMinutes: Number(fd.get("reservationMinutes") || 30),
      winnerCount: isCollection ? 1 : normalizedPrizes.length,
      drawAt: isCollection ? "" : drawFromForm,
      status: status as "draft" | "active" | "closed" | "drawn",
      imageUrl: coverImageUrl.trim(),
      prizes: isCollection ? undefined : normalizedPrizes,
      donationsEnabled: isCollection ? true : donationsEnabled,
    };

    start(async () => {
      if (isEdit && raffle) {
        const res = await updateRaffle(raffle.id, payload);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success(isCollection ? "Recolecta actualizada" : "Rifa actualizada");
          router.refresh();
        }
      } else {
        const res = await createRaffle(payload);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success(
            isCollection
              ? "Recolecta creada · copia el link y QR para compartir"
              : "Rifa creada · copia el link y QR para compartir",
          );
          router.push(`/admin/rifas/${res.id}`);
        }
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" defaultValue={raffle?.title} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Slug (URL)</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={raffle?.slug}
          placeholder="mi-rifa"
          disabled={isEdit}
        />
      </div>
      <div className="space-y-2 rounded-xl border border-primary/30 bg-secondary/30 p-4">
        <Label>Tipo de página</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setType("raffle")}
            className={`rounded-lg border p-3 text-left transition ${
              type === "raffle"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <span className="block font-semibold text-primary">
              Rifa con sorteo
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Números, premios y fecha de sorteo.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setType("collection")}
            className={`rounded-lg border p-3 text-left transition ${
              type === "collection"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <span className="block font-semibold text-primary">
              Recolecta / Donación
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Solo aportes, sin números ni sorteo.
            </span>
          </button>
        </div>
        {isEdit && wasCollection !== isCollection && (
          <p className="text-xs text-amber-400">
            Estás cambiando el tipo de esta página. Revisa los campos antes de
            guardar.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={raffle?.description || ""}
          rows={6}
        />
        <p className="text-xs text-muted-foreground">
          Los saltos de línea y espacios entre párrafos se respetan en la página
          pública.
        </p>
      </div>

      {isCollection && (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-secondary/30 p-4">
          <Label htmlFor="goalAmount">Meta de recaudación (opcional)</Label>
          <Input
            id="goalAmount"
            type="number"
            min="0"
            step="0.01"
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            placeholder="Ej. 5000"
          />
          <p className="text-xs text-muted-foreground">
            Si defines una meta, se mostrará una barra de progreso en la página
            pública (en la moneda principal). Déjalo vacío para no mostrar meta.
          </p>
        </div>
      )}
      <div className="space-y-3 rounded-xl border border-primary/30 bg-secondary/30 p-4">
        <div>
          <Label>{isCollection ? "Monedas aceptadas" : "Monedas y precios"}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {isCollection
              ? "Monedas en las que se puede donar. El monto lo elige cada donante. La primera es la moneda principal (se usa para la meta)."
              : "Agrega las monedas en las que se puede pagar la rifa, cada una con su precio por número. La primera es la moneda principal."}
          </p>
        </div>

        {currencies.map((item, index) => (
          <div
            key={item.key}
            className="space-y-2 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary">
                {index === 0 ? "Moneda principal" : `Moneda ${index + 1}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => moveCurrency(index, -1)}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={currencies.length === 1}
                  onClick={() =>
                    setCurrencies((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Quitar
                </Button>
              </div>
            </div>
            <div
              className={
                isCollection ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"
              }
            >
              <div className="space-y-1">
                <Label htmlFor={`currency-code-${index}`}>Moneda</Label>
                <Select
                  value={item.code}
                  items={currencyOptionsFor(item.code).map((option) => ({
                    value: option.code,
                    label: option.label,
                  }))}
                  onValueChange={(v) =>
                    updateCurrency(index, { code: v ?? item.code })
                  }
                >
                  <SelectTrigger id={`currency-code-${index}`} className="w-full">
                    <SelectValue placeholder="Elige la moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptionsFor(item.code).map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isCollection && (
                <div className="space-y-1">
                  <Label htmlFor={`currency-price-${index}`}>
                    Precio / número
                  </Label>
                  <Input
                    id={`currency-price-${index}`}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={item.price}
                    onChange={(event) =>
                      updateCurrency(index, { price: event.target.value })
                    }
                    required
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={currencies.length >= 20}
          onClick={() =>
            setCurrencies((current) => {
              const used = new Set(current.map((c) => c.code));
              const nextCode =
                CURRENCY_OPTIONS.find((option) => !used.has(option.code))
                  ?.code ?? "USD";
              return [
                ...current,
                {
                  key: crypto.randomUUID(),
                  code: nextCode,
                  price: current[0]?.price || "10",
                },
              ];
            })
          }
        >
          Agregar otra moneda
        </Button>
      </div>
      {!isCollection && !isEdit && (
        <div className="space-y-2">
          <Label htmlFor="totalTickets">Cantidad de números</Label>
          <Input
            id="totalTickets"
            name="totalTickets"
            type="number"
            min={10}
            max={10000}
            defaultValue={100}
            required
          />
          <p className="text-xs text-muted-foreground">
            No se puede cambiar después de crear la rifa.
          </p>
        </div>
      )}
      {!isCollection && isEdit && !wasCollection && (
        <input type="hidden" name="totalTickets" value={raffle!.totalTickets} />
      )}
      {!isCollection && isEdit && wasCollection && (
        <div className="space-y-2">
          <Label htmlFor="totalTicketsConvert">Cantidad de números</Label>
          <Input
            id="totalTicketsConvert"
            type="number"
            min={10}
            max={10000}
            value={totalTicketsForConvert}
            onChange={(e) => setTotalTicketsForConvert(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Al convertir la recolecta en rifa se generarán estos números.
          </p>
        </div>
      )}
      {!isCollection && (
        <div className="space-y-2">
          <Label htmlFor="reservationMinutes">Minutos de reserva</Label>
          <Input
            id="reservationMinutes"
            name="reservationMinutes"
            type="number"
            defaultValue={raffle?.reservationMinutes || 30}
          />
          <p className="text-xs text-muted-foreground">
            Se sorteará un ganador por cada premio agregado.
          </p>
        </div>
      )}
      {!isCollection && (
        <div className="space-y-2">
          <Label htmlFor="drawAt">Fecha del sorteo</Label>
          {/* Native input: Base UI datetime-local no propaga bien el valor */}
          <input
            id="drawAt"
            name="drawAt"
            type="datetime-local"
            value={drawAt}
            onChange={(e) => setDrawAt(e.target.value)}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {drawAt ? (
            <p className="text-xs text-primary">Seleccionado: {drawAt.replace("T", " ")}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Obligatorio para comunicar la fecha a tus participantes.</p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label>Estado</Label>
        <Select
          value={status}
          items={[
            { value: "draft", label: "Borrador" },
            { value: "active", label: "Activa" },
            { value: "closed", label: "Cerrada" },
          ]}
          onValueChange={(v) => setStatus((v as typeof status) || "active")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="active">Activa</SelectItem>
            <SelectItem value="closed">Cerrada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!isCollection && (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-secondary/30 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={donationsEnabled}
              onChange={(e) => setDonationsEnabled(e.target.checked)}
              className="mt-1 size-4 accent-[var(--primary)]"
            />
            <span>
              <span className="font-medium text-primary">
                Activar botón “Donar / Colaborar”
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Permite aportes sin tomar números de la rifa. Aparece en el
                talonario público.
              </span>
            </span>
          </label>
        </div>
      )}

      <div className="space-y-3 rounded-xl border border-primary/30 bg-secondary/30 p-4">
        <div>
          <Label>Imagen del evento</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Identifica la causa: foto de una persona, logo de una marca o
            imagen de la institución. Es aparte de los premios.
          </p>
        </div>

        {coverImageUrl ? (
          <div className="relative flex max-h-64 min-h-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-black/10 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt="Vista previa de la imagen del evento"
              className="max-h-60 max-w-full rounded-md object-contain"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute right-2 top-2"
              onClick={() => setCoverImageUrl("")}
            >
              Quitar
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="cover-image">Adjuntar imagen</Label>
          <input
            id="cover-image"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            disabled={uploading || pending}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-accent"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void onCoverImageSelected(file);
            }}
          />
          <p className="text-xs text-muted-foreground">
            JPG, PNG o WEBP · máx. 8MB
            {uploadingCover ? " · Subiendo…" : ""}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cover-image-url">O URL de imagen</Label>
          <Input
            id="cover-image-url"
            value={coverImageUrl}
            onChange={(event) => setCoverImageUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      {!isCollection && (
      <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
        <div>
          <Label>Premios e imágenes</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            El orden define 1.º, 2.º, 3.º premio y así sucesivamente. Cada
            premio tendrá un ganador.
          </p>
        </div>

        {prizes.map((prize, index) => (
          <div
            key={prize.key}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-primary">
                Premio #{index + 1}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => movePrize(index, -1)}
                >
                  Subir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === prizes.length - 1}
                  onClick={() => movePrize(index, 1)}
                >
                  Bajar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={prizes.length === 1}
                  onClick={() =>
                    setPrizes((current) =>
                      current.filter((_, prizeIndex) => prizeIndex !== index),
                    )
                  }
                >
                  Eliminar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`prize-title-${index}`}>Nombre del premio</Label>
              <Input
                id={`prize-title-${index}`}
                value={prize.title}
                onChange={(event) =>
                  updatePrize(index, { title: event.target.value })
                }
                placeholder="Ej. Televisor 55 pulgadas"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`prize-description-${index}`}>
                Descripción (opcional)
              </Label>
              <Textarea
                id={`prize-description-${index}`}
                value={prize.description}
                onChange={(event) =>
                  updatePrize(index, { description: event.target.value })
                }
                rows={5}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {prize.description.length}/2000 caracteres
              </p>
            </div>

            {prize.imageUrl ? (
              <div className="relative flex max-h-64 min-h-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-black/10 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={prize.imageUrl}
                  alt={`Vista previa del premio ${index + 1}`}
                  className="max-h-60 max-w-full rounded-md object-contain"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute right-2 top-2"
                  onClick={() => updatePrize(index, { imageUrl: "" })}
                >
                  Quitar foto
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor={`raffle-image-${index}`}>Adjuntar imagen</Label>
              <input
                id={`raffle-image-${index}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={uploading || pending}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-accent"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void onPrizeImageSelected(index, file);
                }}
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG o WEBP · máx. 8MB
                {uploadingIndex === index ? " · Subiendo…" : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`image-url-${index}`}>O URL de imagen</Label>
              <Input
                id={`image-url-${index}`}
                value={
                  prize.imageUrl.startsWith("data:") ? "" : prize.imageUrl
                }
                onChange={(event) => {
                  const value = event.target.value.trim();
                  if (value.startsWith("data:")) {
                    toast.error(
                      "No pegues la imagen aquí. Usa “Adjuntar imagen” para subirla.",
                    );
                    return;
                  }
                  updatePrize(index, { imageUrl: event.target.value });
                }}
                placeholder="https://..."
              />
              {prize.imageUrl.startsWith("data:") ? (
                <p className="text-xs text-amber-400">
                  Hay una imagen pegada en texto (base64). Quítala y súbela con
                  “Adjuntar imagen”.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Solo URLs http/https. Para archivos locales usa “Adjuntar
                  imagen”.
                </p>
              )}
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={prizes.length >= 50}
          onClick={() =>
            setPrizes((current) => [
              ...current,
              newPrize(current.length + 1, crypto.randomUUID()),
            ])
          }
        >
          Agregar otro premio
        </Button>
      </div>
      )}
      <Button
        type="submit"
        disabled={pending || uploading || (!isCollection && !drawAt)}
        className="w-full"
      >
        {pending
          ? "Guardando…"
          : isEdit
            ? "Guardar cambios"
            : isCollection
              ? "Crear recolecta"
              : "Crear rifa"}
      </Button>
    </form>
  );
}
