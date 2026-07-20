import { RaffleForm } from "@/components/admin/raffle-form";

export default function NewRafflePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-primary">
          Nuevo evento
        </h1>
        <p className="text-muted-foreground">
          Elige el tipo de evento (rifa con sorteo o contribución / donación) y
          publícalo cuando esté listo
        </p>
      </div>
      <RaffleForm />
    </div>
  );
}
