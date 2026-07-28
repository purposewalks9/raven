"use client";

import { usePathname } from "next/navigation";
import { DocSchema } from "@/lib/types";
import { MobileNav } from "./mobile-nav";
import { HookLogo } from "./hook-logo";
import { ThemeToggle } from "./theme-toggle";
import { GithubStars } from "./github-stars";
import { UserDropdown } from "./user-dropdown";
import Link from "next/link";

export default function SiteHeader({ docSchema }: { docSchema?: DocSchema }) {
  const pathname = usePathname();

  const isDocs = pathname.startsWith("/docs");
  const isSponsor = pathname.startsWith("/sponsor");

  return (
    <header className="fixed bg-background top-0 left-0 right-0 z-50 w-full border-b border-border">
      <div className="flex justify-between w-full h-14 items-center gap-4 3xl:max-w-screen-2xl px-4 mx-auto">

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {docSchema && <MobileNav docSchema={docSchema} className="md:hidden" />}
            <Link href="/" className="flex items-center gap-1.5">
              <HookLogo size={100} />
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-4 md:gap-6 text-sm">
            <Link
              href="/docs/introduction"
              className={`transition-colors ${
                isDocs
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Docs
            </Link>

            <Link
              href="/sponsor"
              className={`transition-colors ${
                isSponsor
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sponsor
            </Link>
          </nav>
        </div>

        <div className="flex gap-2 lg:gap-3 items-center">
          <GithubStars />
          <ThemeToggle />
          <UserDropdown />  {/* ← shows avatar + dropdown when signed in */}
        </div>

      </div>
    </header>
  );
}