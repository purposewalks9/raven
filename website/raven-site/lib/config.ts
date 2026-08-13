export const siteConfig = {
  name: "Raven",
  url: "https://raven-raven-site.vercel.app/",
  ogImage: "/opengraph-image.png",
  description:
    "A programming language that compiles to JavaScript, automatically inferring, registering, and propagating types across your workspace.",
  links: {
    tom: "https://x.com/purpose_walker",
    x: "https://x.com/intent/follow?screen_name=zzxxx__x",
    discord: "https://discord.gg/zxzAZvv8",
    github: "https://github.com/purposewalks9/raven",
  },
  keywords: [
    "Raven",
  ],
};


export type SiteConfig = typeof siteConfig;
export const getBaseURL = () => {

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }


  return `http://localhost:${process.env.PORT || 3000}`;
};