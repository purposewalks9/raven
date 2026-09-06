// compiler/src/sourcemap/generator.ts
//
// IMPORTANT — this one's a genuine judgment call, not a mechanical port,
// and I didn't want to fake confidence on it:
//
// `emitProgram`/`compileSource` (native) now build the whole source map
// internally and hand back a finished `RawSourceMap` — there's no
// standalone `addMapping`/`toRaw` native binding, because nothing asked
// for incremental map-building outside of emission. So there are two real
// options depending on what your actual codebase does:
//
//   (a) If nothing outside `emitter.ts` imports `SourceMapGenerator` or
//       `encodeVlq` directly (check: `grep -rn "sourcemap/generator\|sourcemap/vlq"
//       compiler/`), then the old class-based implementation can just be
//       deleted, keeping only the type exports below.
//
//   (b) If something else DOES construct a `SourceMapGenerator` and call
//       `addMapping`/`setSourceContent`/`toRaw`/`toJSON`/`toDataUrl` on it
//       standalone (e.g. a test harness, or the LSP), tell me and I'll add
//       a dedicated `sourceMapGenerator*` native binding set (create /
///      addMapping / setSourceContent / toRaw as their own napi calls) —
//       don't just leave the old TS class in place next to the Rust one,
//       that's the exact "two live copies" AGENTS.md's phase discipline is
//       meant to prevent.
//
// Until you've checked (a) vs (b), keep the pre-port `SourceMapGenerator`
// class as-is here (not shown — it's your existing implementation) and
// only add these type exports so `emitter.ts`'s wrapper has something to
// import.

export interface RawMapping {
  generatedLine: number;
  generatedColumn: number;
  source: string;
  sourceLine: number;
  sourceColumn: number;
  name?: string;
}

export interface RawSourceMap {
  version: 3;
  file?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}
