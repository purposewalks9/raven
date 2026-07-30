"use client";

import { usePathname } from "next/navigation";
import { DocSchema } from "@/lib/types";
import Image from "next/image";
import { ThemeToggle } from "./theme-toggle";
import { GithubStars } from "./github-stars";
import Link from "next/link";
import { SearchForm } from "./command-menu";

export default function SiteHeader({ docSchema }: { docSchema?: DocSchema }) {
  const pathname = usePathname();



  return (
    <header className="fixed bg-background border-b  max-w-5xl z-50 w-full">
      <div className="flex justify-between w-full h-14 items-center gap-4 3xl:max-w-screen-2xl px-4 mx-auto">

        <div className="flex flex-row justify-between w-full">
           <h1 className="font-medium text-1xl flex flex-row items-center md:text-2xl lg:text-2xl tracking-tight text-[#B7D50B]">
            Raven
          </h1>

          <div className="flex gap-2 lg:gap-3 items-center">
            {docSchema && <SearchForm docSchema={docSchema} />}
            <GithubStars />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}