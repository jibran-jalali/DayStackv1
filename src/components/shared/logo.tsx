import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  href?: string;
  priority?: boolean;
}

export function Logo({ className, href = "/", priority = false }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full px-1 py-1 transition-opacity duration-200 hover:opacity-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
        className,
      )}
      aria-label="DayStack home"
    >
      <Image
        src="/brand/daystack-logo.png"
        alt="DayStack"
        width={2852}
        height={834}
        priority={priority}
        className="h-10 w-auto md:h-11"
      />
    </Link>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/daystack-mark.png"
      alt="DayStack mark"
      width={512}
      height={512}
      className={cn("h-12 w-12 rounded-2xl", className)}
    />
  );
}
