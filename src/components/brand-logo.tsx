import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: { width: 56, height: 26 },
  md: { width: 72, height: 34 },
  lg: { width: 104, height: 49 },
} as const;

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
  const dim = SIZE[size];

  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <Image
        src="/rifacil-logo.png"
        alt="Rifacil"
        width={dim.width}
        height={dim.height}
        className="h-auto w-auto object-contain"
        style={{ width: dim.width, height: "auto" }}
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
