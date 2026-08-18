import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export function versionCommand(): void {

  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, "..", "..", "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    console.log(pkg.version ?? "unknown");
  } catch {
    console.log("unknown");
  }
}
