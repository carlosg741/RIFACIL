import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const baseLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/rifas", label: "Rifas" },
  { href: "/admin/ordenes", label: "Órdenes" },
  { href: "/admin/donaciones", label: "Donaciones" },
  { href: "/admin/metodos-pago", label: "Métodos de pago" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user?.role === "disabled") {
    redirect("/login");
  }
  const isSuperAdmin = session?.user?.role === "super_admin";
  const links = isSuperAdmin
    ? [
        ...baseLinks,
        { href: "/admin/clientes", label: "Clientes" },
      ]
    : baseLinks;

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground md:w-56 md:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-5 md:block">
          <Link href="/admin" className="inline-flex items-center gap-2">
            <Image
              src="/rifacil-logo.jpeg"
              alt="Rifacil"
              width={32}
              height={32}
              className="rounded-md object-cover"
            />
            <span className="font-[family-name:var(--font-display)] text-xl font-bold text-primary">
              Rifacil
            </span>
          </Link>
          <p className="hidden text-xs text-sidebar-foreground/60 md:mt-2 md:block">
            {session?.user?.email}
            {isSuperAdmin ? (
              <span className="mt-0.5 block text-primary/80">Admin principal</span>
            ) : null}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:pb-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <form
          className="hidden px-4 pb-6 md:block"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button type="submit" variant="secondary" size="sm" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </aside>
      <main className="flex-1 bg-background p-4 md:p-8">{children}</main>
    </div>
  );
}
