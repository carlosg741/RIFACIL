import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  CONTACT_WHATSAPP,
  ORGANIZER_SUPPORT_MESSAGE,
  contactWhatsAppUrl,
} from "@/lib/contact";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const baseLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/rifas", label: "Rifas" },
  { href: "/admin/ordenes", label: "Órdenes" },
  { href: "/admin/donaciones", label: "Donaciones" },
  { href: "/admin/metodos-pago", label: "Métodos de pago" },
  { href: "/admin/cuenta", label: "Mi cuenta" },
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

  const supportUrl = contactWhatsAppUrl(ORGANIZER_SUPPORT_MESSAGE);

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground md:w-56 md:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-5 md:block">
          <Link href="/admin" className="inline-flex items-center gap-2">
            <Image
              src="/rifacil-logo.png"
              alt="Rifacil"
              width={56}
              height={26}
              className="h-7 w-auto object-contain"
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
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:pb-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent"
            >
              {l.label}
            </Link>
          ))}
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-primary hover:bg-sidebar-accent"
          >
            <MessageCircle className="size-4 shrink-0" />
            Soporte
          </a>
        </nav>
        <div className="mx-2 mb-4 hidden rounded-xl border border-primary/25 bg-sidebar-accent/40 p-3 md:block">
          <p className="text-xs font-medium text-primary">¿Necesitas ayuda?</p>
          <p className="mt-1 text-xs text-sidebar-foreground/70">
            Escríbenos por WhatsApp y resolvemos dudas del panel.
          </p>
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <MessageCircle className="size-3.5" />
            WhatsApp {CONTACT_WHATSAPP}
          </a>
        </div>
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
