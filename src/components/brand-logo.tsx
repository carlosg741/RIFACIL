import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandLogo({
  href = "/",
  size = "md",
  showWordmark = true,
  className,
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}) {
  const dim = size === "sm" ? 28 : size === "lg" ? 48 : 36;

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <Image
        src="/rifacil-logo.jpeg"
        alt="Rifacil"
        width={dim}
        height={dim}
        className="rounded-md object-cover"
        priority
      />
      {showWordmark && (
        <span className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-primary sm:text-xl">
          Rifacil
        </span>
      )}
    </Link>
  );
}
