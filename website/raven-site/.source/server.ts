// @ts-nocheck
import * as __fd_glob_6 from "../content/docs/type-intelligence.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/roadmap.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/improvements.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/getting-started.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/features.mdx?collection=docs"
import * as __fd_glob_0 from "../content/docs/compiler.mdx?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.docs("docs", "content/docs", {}, {"compiler.mdx": __fd_glob_0, "features.mdx": __fd_glob_1, "getting-started.mdx": __fd_glob_2, "improvements.mdx": __fd_glob_3, "index.mdx": __fd_glob_4, "roadmap.mdx": __fd_glob_5, "type-intelligence.mdx": __fd_glob_6, });