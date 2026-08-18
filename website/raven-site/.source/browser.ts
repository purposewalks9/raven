// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"compiler.mdx": () => import("../content/docs/compiler.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "typeengine/array-types.mdx": () => import("../content/docs/typeengine/array-types.mdx?collection=docs"), "typeengine/function-types.mdx": () => import("../content/docs/typeengine/function-types.mdx?collection=docs"), "typeengine/literals.mdx": () => import("../content/docs/typeengine/literals.mdx?collection=docs"), "typeengine/optional-types.mdx": () => import("../content/docs/typeengine/optional-types.mdx?collection=docs"), "typeengine/primitive-types.mdx": () => import("../content/docs/typeengine/primitive-types.mdx?collection=docs"), "typeengine/recursive-types.mdx": () => import("../content/docs/typeengine/recursive-types.mdx?collection=docs"), "typeengine/tuple-types.mdx": () => import("../content/docs/typeengine/tuple-types.mdx?collection=docs"), "typeengine/type-equality.mdx": () => import("../content/docs/typeengine/type-equality.mdx?collection=docs"), "typeengine/type-intelligence.mdx": () => import("../content/docs/typeengine/type-intelligence.mdx?collection=docs"), "typeengine/type-normalization.mdx": () => import("../content/docs/typeengine/type-normalization.mdx?collection=docs"), "typeengine/union-types.mdx": () => import("../content/docs/typeengine/union-types.mdx?collection=docs"), }),
};
export default browserCollections;