// @ts-nocheck
import * as __fd_glob_2 from "../content/docs/roadmap.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_0 from "../content/docs/features.mdx?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docs("docs", "content/docs", {}, {"features.mdx": __fd_glob_0, "index.mdx": __fd_glob_1, "roadmap.mdx": __fd_glob_2, });