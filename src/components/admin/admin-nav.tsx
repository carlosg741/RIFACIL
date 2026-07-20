"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

type NavLink = { href: string; label: string };

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function routeKey(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ""}`;
}

function AdminLoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center bg-background/40 pt-[30vh] backdrop-blur-[1px] md:pl-56">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-lg">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Cargando…</span>
      </div>
    </div>
  );
}

function AdminNavInner({
  links,
  supportUrl,
}: {
  links: NavLink[];
  supportUrl: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const current = routeKey(pathname, search);
  const [pending, setPending] = useState(false);

  // Apaga el overlay al completar la navegación.
  useEffect(() => {
    setPending(false);
  }, [current]);

  // Cualquier clic en un enlace interno /admin muestra "Cargando…".
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const hrefAttr = anchor.getAttribute("href");
      if (!hrefAttr || hrefAttr.startsWith("#") || hrefAttr.startsWith("mailto:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(hrefAttr, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/admin")) return;

      const next = routeKey(url.pathname, url.search.replace(/^\?/, ""));
      if (next === current) return;

      setPending(true);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [current]);

  // Seguridad: si la navegación falla o tarda demasiado, oculta el overlay.
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(false), 12000);
    return () => window.clearTimeout(t);
  }, [pending]);

  return (
    <>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:pb-4">
        {links.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "hover:bg-sidebar-accent"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {l.label}
            </Link>
          );
        })}
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
      <AdminLoadingOverlay show={pending} />
    </>
  );
}

export function AdminNav(props: { links: NavLink[]; supportUrl: string }) {
  return (
    <Suspense
      fallback={
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:pb-4">
          {props.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      }
    >
      <AdminNavInner {...props} />
    </Suspense>
  );
}
