"use client";

import { BlurReveal } from "@/components/spell-ui/blur-reveal";
import { RichButton } from "@/components/spell-ui/rich-button";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export function Hero() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <div className="flex flex-col items-center w-full pb-12 md:pb-24 gap-8 md:gap-16 px-4">
      <section className="relative flex flex-col items-center justify-center pb-20 px-4 text-center w-full max-w-[1400px] overflow-hidden bg-background">

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full bg-yellow-500/10 dark:bg-yellow-600/10 blur-[100px]" />

        <div className="flex flex-col items-center w-full pt-6 pb-6 md:pt-14 md:pb-24 gap-12 md:gap-20 px-4">
          <div className="flex flex-col items-center text-center gap-6 max-w-[700px]">
            <BlurReveal
              letterSpacing="-0.020em"
              className="font-medium text-3xl md:text-4xl lg:text-5xl tracking-tight text-foreground"
            >
             Craft immersive frontend interactions with powerful React hooks
            </BlurReveal>

            <p className="text-base md:text-lg leading-6 text-muted-foreground">
             Powerful frontend primitives for motion, effects, behavior, async workflows, and modern interactive UI development.
            </p>

            <div className="flex flex-row gap-3 mt-2 w-auto">
         
              {!isPending && !session?.user && (
                <RichButton
                  size="lg"
                  className="transition-transform rounded-md tracking-tight active:scale-[0.97] will-change-transform ease-out duration-150 px-6"
                  asChild
                >
                  <Link href="/login">Sign in</Link>
                </RichButton>
              )}

              <RichButton
                size="lg"
                color="yellow"
                className="transition-transform shadow-sm shadow-zinc-950/20 rounded-md tracking-tight px-6 active:scale-[0.97] will-change-transform ease-out duration-150"
                asChild
              >
                <Link href="/docs/doorway">Docs</Link>
              </RichButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}