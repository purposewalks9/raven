import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { GithubStars } from "@/components/github-stars";
import HighlightedText from "@/components/spell-ui/highlighted-text";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background font-sans">
      <main className="flex flex-1 w-full max-w-3xl min-h-screen flex-col  items-center justify-between py-32 px-16 gap-y-30 sm:items-start">

        <div className="flex flex-row justify-between w-full">
          <h1 className="font-medium text-1xl flex flex-row items-center md:text-2xl lg:text-2xl tracking-tight text-[#B7D50B]">
            Raven
          </h1>

          <div className="flex gap-2 lg:gap-3 items-center">
            <GithubStars />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="w-full text-3xl font-semibold  text-foreground">
            Write <HighlightedText className=" text-[#B7D50B] rounded-sm ">JavaScript</HighlightedText> applications without managing types.
          </h1>
          <p className="w-full text-lg leading-8 text-muted-foreground">
            Raven’s compiler automatically understands your code and builds a project-wide type registry, so you spend less time managing types and more time building.{" "}
            {" "}
            <Link
              href="https://github.com/purposewalks9/raven"
              className="font-medium text-foreground underline underline-[#B7D50B] underline-offset-4"
            >
              Open Source
            </Link>{" "}
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            className="flex h-12 w-full items-center justify-center  gap-2 rounded-full bg-[#B7D50B] px-5 text-primary-foreground transition-colors hover:opacity-90 md:w-[158px]"
            href="/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Download
          </Link>
          <Link
            className="flex h-12 w-full items-center justify-center rounded-full border border-border px-5 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:w-[158px]"
            href="/docs"

          >
            Documentation
          </Link>
        </div>
      </main>
    </div>
  );
}