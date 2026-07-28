"use client";

import Link from "next/link";
import { basicDoc } from "@/basic-doc";
import ShimmerText from "./spell-ui/shimmer-text";

export function HooksShowcase() {
  const hooks = basicDoc
    .filter((section) => section.title !== "Getting Started")
    .flatMap((section) => section.items);

  return (
    <section className="relative mx-auto pb-20 px-4 w-full max-w-[1400px]">
      
    
      <div className="mb-6 sm:mb-8">
        <ShimmerText className="text-[clamp(1.25rem,2.5vw,1.875rem)] font-semibold text-foreground tracking-tight">
          Every hook you&apos;ll actually need
        </ShimmerText>
      </div>

    
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {hooks.map((hook) => (
          <Link
            key={hook.id}
            href={`/docs/${hook.id}`}
            className="group block p-4 border-r  hover:bg-accent/40 hover:border-border/80 transition-all duration-200"
          >
            <h2 className="text-sm font-semibold text-foreground group-hover:text-foreground/80">
              {hook.title}
            </h2>

            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
              {hook.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}