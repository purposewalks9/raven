// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"features.mdx": () => import("../content/docs/features.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "roadmap.mdx": () => import("../content/docs/roadmap.mdx?collection=docs"), }),
};
export default browserCollections;