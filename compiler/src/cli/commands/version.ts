import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export function versionCommand(): void {
  // Read the version straight from package.json so this can never drift
  // from what's actually published. readFileSync (not an import attribute)
  // so this keeps working on Node 18.x, which the "engines" field promises.
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/cli/commands/ -> package.json sits two levels up from dist/cli/
  const pkgPath = join(here, "..", "..", "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    console.log(pkg.version ?? "unknown");
  } catch {
    console.log("unknown");
  }
}

// cd ~/raven && raven run examples/raven/demo.rv
// cd ~/raven/compiler && pnpm build