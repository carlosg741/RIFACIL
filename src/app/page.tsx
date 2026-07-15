import Link from "next/link";
import { Mail } from "lucide-react";
import { getActiveDemoSlug } from "@/lib/actions/public";
import {
  CONTACT_EMAIL,
  CONTACT_WHATSAPP,
  contactMailto,
  contactWhatsAppUrl,
} from "@/lib/contact";
import { ButtonLink } from "@/components/button-link";
import { BrandLogo } from "@/components/brand-logo";
import { WhatsAppFloat } from "@/components/whatsapp-float";

/** Evita PGlite/DB en el build estático de Vercel */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let demoSlug = "demo";
  try {
    demoSlug = await getActiveDemoSlug();
  } catch {
    demoSlug = "demo";
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 md:px-10">
        <BrandLogo />
        <nav className="flex items-center gap-3">
          <Link
            href="#contacto"
            className="hidden text-sm text-muted-foreground hover:text-primary sm:inline"
          >
            Contacto
          </Link>
          <Link
            href={`/r/${demoSlug}`}
            className="hidden text-sm text-muted-foreground hover:text-primary sm:inline"
          >
            Ver demo
          </Link>
          <ButtonLink href="/login" variant="secondary" size="sm">
            Entrar
          </ButtonLink>
        </nav>
      </header>

      <main className="flex-1">
        <section className="hero-mesh relative min-h-[100svh] overflow-hidden px-6 pb-16 pt-28 md:px-10 md:pt-32">
          <div className="pointer-events-none absolute -right-16 top-28 h-72 w-72 rounded-full bg-primary/15 blur-3xl animate-float-slow" />
          <div className="pointer-events-none absolute bottom-16 left-8 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative mx-auto max-w-5xl">
            <div className="animate-fade-up mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/rifacil-logo.jpeg"
                alt="Rifacil"
                className="h-20 w-20 rounded-xl object-cover shadow-lg ring-2 ring-primary/40 sm:h-24 sm:w-24"
              />
            </div>
            <p className="animate-fade-up font-[family-name:var(--font-display)] text-6xl font-bold tracking-tight text-primary sm:text-7xl md:text-8xl">
              Rifacil
            </p>
            <h1 className="animate-fade-up mt-4 max-w-2xl text-2xl font-medium leading-snug text-foreground sm:text-3xl [animation-delay:80ms]">
              Talonario digital para organizar rifas de principio a fin
            </h1>
            <p className="animate-fade-up mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg [animation-delay:140ms]">
              Comparte link y QR, aparta números, cobra con Yape/Plin o
              transferencia, valida comprobantes y sortea con transparencia.
            </p>
            <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:200ms]">
              <ButtonLink
                href={`/r/${demoSlug}`}
                size="lg"
                className="animate-pulse-ring"
              >
                Probar rifa demo
              </ButtonLink>
              <ButtonLink href="/login" size="lg" variant="outline">
                Panel organizador
              </ButtonLink>
              <ButtonLink href="#contacto" size="lg" variant="secondary">
                Solicitar mi panel
              </ButtonLink>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card px-6 py-20 md:px-10">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
              Todo el proceso en un solo lugar
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Como Rifary: link del talonario, comprobantes manuales y ticket
              digital para WhatsApp.
            </p>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {[
                {
                  title: "Link + QR",
                  body: "Al crear la rifa generas un enlace y QR para enviar a tus participantes.",
                },
                {
                  title: "Pago con comprobante",
                  body: "Muestras Yape, Plin o transferencia y el participante adjunta la captura.",
                },
                {
                  title: "Ticket digital",
                  body: "Descárgalo o envíalo por WhatsApp desde el admin. No depende del correo.",
                },
              ].map((item) => (
                <div key={item.title}>
                  <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="contacto"
          className="border-t border-border px-6 py-20 md:px-10"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary">
              Solicita tu panel organizador
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Escríbenos por correo o WhatsApp y te activamos tu cuenta para
              crear y administrar tus propias rifas.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
              <a
                href={contactMailto()}
                className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm transition hover:border-primary/50"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Mail className="size-5" />
                </span>
                <span>
                  <span className="block font-medium text-foreground">
                    Correo
                  </span>
                  <span className="text-muted-foreground">{CONTACT_EMAIL}</span>
                </span>
              </a>
              <a
                href={contactWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm transition hover:border-[#25D366]/50"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-[#25D366]/20 text-[#25D366]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-5"
                    aria-hidden
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 9.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.85 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </span>
                <span>
                  <span className="block font-medium text-foreground">
                    WhatsApp
                  </span>
                  <span className="text-muted-foreground">
                    {CONTACT_WHATSAPP}
                  </span>
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-ink px-6 py-8 text-sm text-muted-foreground md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo showWordmark className="opacity-90" />
          <div className="flex flex-col gap-1 sm:items-end">
            <a
              href={contactMailto()}
              className="hover:text-primary"
            >
              {CONTACT_EMAIL}
            </a>
            <a
              href={contactWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              WhatsApp {CONTACT_WHATSAPP}
            </a>
          </div>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
