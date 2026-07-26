import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function newCommand(args: string[]): void {
  const name = args[0] ?? "hello-raven";
  mkdirSync(name, { recursive: true });
  writeFileSync(join(name, "main.rv"), 'print("Hello from Raven!")\n');
  console.log(`Created ${name}/main.rv`);
}