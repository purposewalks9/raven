import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { compileFile, printErrors } from "../pipeline.js";

export function buildCommand(args: string[]): void {
  const sourceMapFlagIndex = args.findIndex(a => a === "--sourcemap" || a === "-s");
  const sourceMap = sourceMapFlagIndex !== -1;
  const [file, outFile] = args.filter((_, i) => i !== sourceMapFlagIndex);
  if (!file) { console.error("Usage: raven build <file.rv> [out.js] [--sourcemap|-s]"); process.exitCode = 1; return; }
  const { source, diagnostics, js, map } = compileFile(file, true, { sourceMap });
  if (js === null) { printErrors(file, diagnostics, source); process.exitCode = 1; return; }
  const outputFile = outFile ?? join(dirname(file), `${basename(file, ".rv")}.js`);
  if (sourceMap && map) {
    const mapFile = `${outputFile}.map`;
    writeFileSync(outputFile, `${js}\n//# sourceMappingURL=${basename(mapFile)}\n`);
    writeFileSync(mapFile, map.toString(basename(outputFile)));
    console.log(`Built ${outputFile} (+ ${mapFile})`);
    return;
  }
  writeFileSync(outputFile, js);
  console.log(`Built ${outputFile}`);
}
