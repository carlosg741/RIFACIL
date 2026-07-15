import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listClients } from "@/lib/actions/admin";
import { ClientsManager } from "@/components/admin/clients-manager";

export default async function ClientesPage() {
  const session = await auth();
  if (session?.user?.role !== "super_admin") {
    redirect("/admin");
  }

  const clients = await listClients();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
          Clientes
        </h1>
        <p className="text-muted-foreground">
          Crea y administra cuentas para que otros organicen sus propias rifas
        </p>
      </div>
      <ClientsManager clients={clients} />
    </div>
  );
}
