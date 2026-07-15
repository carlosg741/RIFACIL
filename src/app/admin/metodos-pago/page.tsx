import {
  listPaymentMethods,
  listRafflesForSelect,
} from "@/lib/actions/admin";
import { PaymentMethodsManager } from "@/components/admin/payment-methods-manager";

export default async function PaymentMethodsPage() {
  const [methods, raffles] = await Promise.all([
    listPaymentMethods(),
    listRafflesForSelect(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
          Métodos de pago
        </h1>
        <p className="text-muted-foreground">
          Cada método pertenece a una rifa · así demo y reales no se mezclan
        </p>
      </div>
      <PaymentMethodsManager methods={methods} raffles={raffles} />
    </div>
  );
}
