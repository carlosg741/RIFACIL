import { RaffleForm } from "@/components/admin/raffle-form";

export default function NewRafflePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-primary">
          Nueva rifa
        </h1>
        <p className="text-muted-foreground">
          Configura el talonario y publícalo cuando esté listo
        </p>
      </div>
      <RaffleForm />
    </div>
  );
}
