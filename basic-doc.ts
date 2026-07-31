import { DocSchema } from "@/lib/types";

export const ravenDoc: DocSchema = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Introduction",
        id: "introduction",
        description: "What Raven is and why it exists.",
      }
    ],
  },
  {
    title: "Reference",
    items: [
      {
        title: "Features",
        id: "features",
        description: "What Raven can actually do today.",
      },
      {
        title: "Roadmap",
        id: "roadmap",
        description: "What's partial, stubbed, or still open.",
      },
    ],
  },
];