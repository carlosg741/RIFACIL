import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";
import { BrandLogo } from "@/components/brand-logo";

export default function LoginPage() {
  return (
    <div className="hero-mesh flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <BrandLogo className="mb-2" />
        <p className="mt-1 text-sm text-muted-foreground">
          Acceso al panel organizador
        </p>
        <div className="mt-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
