export function formatRaven(source: string): string {
  const lines = source.split(/\r?\n/);
  let indent = 0;
  const formatted: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === "end" || line.startsWith("else")) indent = Math.max(0, indent - 1);
    formatted.push(`${"  ".repeat(indent)}${line}`);
    if (/\b(then|do)$/.test(line) || line.startsWith("else")) indent++;
  }

  return `${formatted.join("\n")}\n`;
}
