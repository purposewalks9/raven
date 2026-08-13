
import type { Metadata } from "next";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { siteConfig } from "@/lib/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? siteConfig.url;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
export function constructMetadata({
  title = siteConfig.name,
  description = siteConfig.description,
  image,
  ...props
}: {
  title?: string;
  description?: string;
  image?: string;
} & Partial<Metadata> = {}): Metadata {

  const ogImage = image ?? absoluteUrl(siteConfig.ogImage);

  return {
    title,
    description,
    keywords: siteConfig.keywords,

    metadataBase: new URL(siteConfig.url),

    openGraph: {
      title,
      description,
      type: "website",
      url: siteConfig.url,
      siteName: siteConfig.name,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      creator: "@purpose_walker",
    },

    icons: "/icon.svg",

    ...props,
  };
}