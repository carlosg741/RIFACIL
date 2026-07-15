import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export default async function AccountPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
          Mi cuenta
        </h1>
        <p className="text-muted-foreground">
          {session?.user?.email} · Cambia la contraseña con la que accedes al
          panel.
        </p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
