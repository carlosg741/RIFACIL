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
import { createRaffle, updateRaffle } from "@/lib/actions/admin";
import { toLocalDateTimeValue } from "@/lib/urls";
import type { Raffle } from "@/db/schema";

export function RaffleForm({ raffle }: { raffle?: Raffle }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(raffle?.status || "active");
  const [drawAt, setDrawAt] = useState(
    raffle?.drawAt ? toLocalDateTimeValue(new Date(raffle.drawAt)) : "",
  );
  const [imageUrl, setImageUrl] = useState(raffle?.imageUrl || "");
  const [donationsEnabled, setDonationsEnabled] = useState(
    raffle?.donationsEnabled ?? false,
  );
  const isEdit = Boolean(raffle);

  async function onImageSelected(file: File | undefined) {
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
        toast.error(data.error || "No se pudo subir la imagen");
        return;
      }
      setImageUrl(data.url);
      toast.success("Imagen cargada");
    } catch {
      toast.error("Error al subir la imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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
    const urlFromInput = String(fd.get("imageUrl") || imageUrl || "").trim();
    const payload = {
      title: String(fd.get("title") || ""),
      slug: String(fd.get("slug") || "") || undefined,
      description: String(fd.get("description") || ""),
      prize: String(fd.get("prize") || ""),
      pricePerTicket: Number(fd.get("pricePerTicket")),
      currency: String(fd.get("currency") || "PEN"),
      totalTickets: Number(fd.get("totalTickets")),
      reservationMinutes: Number(fd.get("reservationMinutes") || 30),
      winnerCount: Number(fd.get("winnerCount") || 1),
      drawAt: drawFromForm,
      status: status as "draft" | "active" | "closed" | "drawn",
      imageUrl: urlFromInput || undefined,
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
        <Label htmlFor="prize">Premio</Label>
        <Input id="prize" name="prize" defaultValue={raffle?.prize} required />
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="reservationMinutes">Minutos de reserva</Label>
          <Input
            id="reservationMinutes"
            name="reservationMinutes"
            type="number"
            defaultValue={raffle?.reservationMinutes || 30}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="winnerCount">Ganadores</Label>
          <Input
            id="winnerCount"
            name="winnerCount"
            type="number"
            min={1}
            defaultValue={raffle?.winnerCount || 1}
          />
        </div>
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

      <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
        <div>
          <Label>Imagen del premio / persona</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjunta una foto o pega una URL. Se muestra en el talonario público.
          </p>
        </div>

        {imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Vista previa"
              className="max-h-56 w-full object-cover"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute right-2 top-2"
              onClick={() => setImageUrl("")}
            >
              Quitar
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="raffleImage">Adjuntar imagen</Label>
          <input
            ref={fileRef}
            id="raffleImage"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            disabled={uploading || pending}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-accent"
            onChange={(e) => onImageSelected(e.target.files?.[0])}
          />
          <p className="text-xs text-muted-foreground">
            JPG, PNG o WEBP · máx. 8MB
            {uploading ? " · Subiendo…" : ""}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl">O URL de imagen</Label>
          <Input
            id="imageUrl"
            name="imageUrl"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>
      <Button
        type="submit"
        disabled={pending || uploading || !drawAt}
        className="w-full"
      >
        {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear rifa"}
      </Button>
    </form>
  );
}
