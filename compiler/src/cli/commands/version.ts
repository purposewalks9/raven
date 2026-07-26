export function versionCommand(): void {
  // NOTE: hardcoded for now. Once compiler/package.json's "version" field
  // is the source of truth you care about, read it via:
  //   import pkg from "../../package.json" with { type: "json" };
  // (requires Node 18.20+ / 20.10+ for import attributes, or a
  // readFileSync + JSON.parse fallback on older Node.)
  console.log("0.0.1");
}