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
import { toLocalDateTimeValue } from "@/lib/urls";
import type { Raffle, RafflePrize } from "@/db/schema";

type PrizeDraft = {
  key: string;
  title: string;
  description: string;
  imageUrl: string;
};

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
}: {
  raffle?: Raffle;
  initialPrizes?: RafflePrize[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [status, setStatus] = useState(raffle?.status || "active");
  const [drawAt, setDrawAt] = useState(
    raffle?.drawAt ? toLocalDateTimeValue(new Date(raffle.drawAt)) : "",
  );
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
          imageUrl: raffle.imageUrl || "",
        },
      ];
    }
    return [newPrize(1)];
  });
  const [donationsEnabled, setDonationsEnabled] = useState(
    raffle?.donationsEnabled ?? false,
  );
  const isEdit = Boolean(raffle);

  function updatePrize(index: number, patch: Partial<PrizeDraft>) {
    setPrizes((current) =>
      current.map((prize, prizeIndex) =>
        prizeIndex === index ? { ...prize, ...patch } : prize,
      ),
    );
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

  async function onImageSelected(index: number, file: File | undefined) {
    if (!file) return;
    setUploadingIndex(index);
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
        toast.error(data.error || "No se pudo subir la imagen");
        return;
      }
      updatePrize(index, { imageUrl: data.url });
      toast.success(`Imagen del premio ${index + 1} cargada`);
    } catch {
      toast.error("Error al subir la imagen");
    } finally {
      setUploadingIndex(null);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const drawFromForm = String(fd.get("drawAt") || drawAt || "");
    if (!drawFromForm) {
      toast.error("Elige la fecha del sorteo");
      return;
    }
    const normalizedPrizes = prizes.map((prize) => ({
      title: prize.title.trim(),
      description: prize.description.trim() || undefined,
      imageUrl: prize.imageUrl.trim() || undefined,
    }));
    if (normalizedPrizes.some((prize) => prize.title.length < 2)) {
      toast.error("Escribe el nombre de todos los premios.");
      return;
    }
    const firstPrize = normalizedPrizes[0]!;
    const payload = {
      title: String(fd.get("title") || ""),
      slug: String(fd.get("slug") || "") || undefined,
      description: String(fd.get("description") || ""),
      prize: firstPrize.title,
      pricePerTicket: Number(fd.get("pricePerTicket")),
      currency: String(fd.get("currency") || "PEN"),
      totalTickets: Number(fd.get("totalTickets")),
      reservationMinutes: Number(fd.get("reservationMinutes") || 30),
      winnerCount: normalizedPrizes.length,
      drawAt: drawFromForm,
      status: status as "draft" | "active" | "closed" | "drawn",
      imageUrl: firstPrize.imageUrl,
      prizes: normalizedPrizes,
      donationsEnabled,
    };

    start(async () => {
      if (isEdit && raffle) {
        const res = await updateRaffle(raffle.id, payload);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Rifa actualizada");
          router.refresh();
        }
      } else {
        const res = await createRaffle(payload);
        if (!res.ok) toast.error(res.error);
        else {
          toast.success("Rifa creada · copia el link y QR para compartir");
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
      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={raffle?.description || ""}
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pricePerTicket">Precio / número</Label>
          <Input
            id="pricePerTicket"
            name="pricePerTicket"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={raffle?.pricePerTicket || "10"}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={raffle?.currency || "PEN"}
            maxLength={3}
          />
        </div>
      </div>
      {!isEdit && (
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
      {isEdit && (
        <input type="hidden" name="totalTickets" value={raffle!.totalTickets} />
      )}
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
                rows={2}
              />
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
                disabled={uploadingIndex !== null || pending}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-accent"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  void onImageSelected(index, file);
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
                value={prize.imageUrl}
                onChange={(event) =>
                  updatePrize(index, { imageUrl: event.target.value })
                }
                placeholder="https://..."
              />
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
      <Button
        type="submit"
        disabled={pending || uploadingIndex !== null || !drawAt}
        className="w-full"
      >
        {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear rifa"}
      </Button>
    </form>
  );
}
