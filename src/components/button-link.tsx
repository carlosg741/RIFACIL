import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ButtonLink({
  href,
  children,
  variant = "default",
  size = "default",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "xs";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
    </Link>
  );
}
