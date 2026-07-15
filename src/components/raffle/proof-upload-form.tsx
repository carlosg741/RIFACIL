"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ProofUploadForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona una imagen o PDF del comprobante.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("orderId", orderId);
      formData.set("proof", file);

      const res = await fetch("/api/upload-proof", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        ticketPath?: string | null;
      };

      if (!data.ok) {
        toast.error(data.error || "No se pudo subir");
        return;
      }
      toast.success("Comprobante enviado. Ya puedes ver tu ticket.");
      if (data.ticketPath) router.push(data.ticketPath);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="proof">Adjunta tu comprobante</Label>
        <input
          ref={inputRef}
          id="proof"
          name="proof"
          type="file"
          accept="image/*,application/pdf,.jpg,.jpeg,.png,.webp,.pdf"
          required
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-accent"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
        />
        {fileName && (
          <p className="text-xs text-primary">{fileName}</p>
        )}
        <p className="text-xs text-muted-foreground">
          JPG, PNG, WEBP o PDF · máx. 8MB
        </p>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando…" : "Enviar comprobante"}
      </Button>
    </form>
  );
}
