import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { compileFile, printErrors } from "../pipeline.js";

export function buildCommand(args: string[]): void {
  const sourceMapFlagIndex = args.findIndex(a => a === "--sourcemap" || a === "-s");
  const sourceMap = sourceMapFlagIndex !== -1;
  const positional = args.filter((_, i) => i !== sourceMapFlagIndex);
  const [file, outFile] = positional;

  if (!file) {
    console.error("Usage: raven build <file.rv> [out.js] [--sourcemap|-s]");
    process.exitCode = 1;
    return;
  }

  const { source, diagnostics, js, map } = compileFile(file, true, { sourceMap });
  if (js === null) {
    printErrors(file, diagnostics, source);
    process.exitCode = 1;
    return;
  }

  const outputFile = outFile ?? join(dirname(file), `${basename(file, ".rv")}.js`);

  if (sourceMap && map) {
    const mapFile = `${outputFile}.map`;
    const mapFileName = basename(mapFile);
    writeFileSync(outputFile, `${js}\n//# sourceMappingURL=${mapFileName}\n`);
    writeFileSync(mapFile, map.toString(basename(outputFile)));
    console.log(`Built ${outputFile} (+ ${mapFile})`);
    return;
  }

  writeFileSync(outputFile, js);
  console.log(`Built ${outputFile}`);
}