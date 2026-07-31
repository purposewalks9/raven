import { TypeAnnotation } from "../ast/nodes.js";

export function sameType(left: TypeAnnotation, right: TypeAnnotation): boolean {
  if (left === "any" || right === "any") return true;

  if (typeof left === "string" && typeof right === "string") {
    return left === right;
  }
  if (typeof left === "string" || typeof right === "string") {
    return false;
  }
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "array" && right.kind === "array") {
    return sameType(left.elementType, right.elementType);
  }

  if (left.kind === "record" && right.kind === "record") {
    const leftKeys = Object.keys(left.fields);
    const rightKeys = Object.keys(right.fields);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(key => {
      const rightFieldType = right.fields[key];
      return rightFieldType !== undefined && sameType(left.fields[key]!, rightFieldType);
    });
  }

  return false;
}

export function formatType(type: TypeAnnotation | undefined): string {
  if (!type) return "unknown";
  if (type === "any") return "any";
  if (typeof type === "string") {
    return type;
  }
  if (type.kind === "array") {
    return `${formatType(type.elementType)}[]`;
  }
  if (type.kind === "record") {
    const fields = Object.entries(type.fields)
      .map(([key, fieldType]) => `${key}: ${formatType(fieldType)}`)
      .join(", ");
    return `{ ${fields} }`;
  }
  return "unknown";
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) grid[i]![0] = i;
  for (let j = 0; j < cols; j++) grid[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      grid[i]![j] = Math.min(
        grid[i - 1]![j]! + 1,
        grid[i]![j - 1]! + 1,
        grid[i - 1]![j - 1]! + cost,
      );
    }
  }

  return grid[rows - 1]![cols - 1]!;
}

/**
 * Finds the closest name to `target` among `candidates`, for "did you mean"
 * hints. Only suggests when the typo is plausibly close — short random
 * unrelated names shouldn't get suggested just because nothing else matched.
 */
export function closestMatch(target: string, candidates: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    if (candidate === target) continue;
    const distance = levenshtein(target, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  const threshold = Math.max(2, Math.floor(target.length / 3));
  return bestDistance <= threshold ? best : undefined;
}

export type ShapeDiffEntry =
  | { kind: "added"; field: string; type: TypeAnnotation }
  | { kind: "removed"; field: string; type: TypeAnnotation }
  | { kind: "changed"; field: string; from: TypeAnnotation; to: TypeAnnotation };

/**
 * Field-by-field diff between two record shapes — used to explain *why*
 * two `model` declarations of the same name conflict, instead of just
 * saying "different shape" and leaving the reader to spot it themselves.
 */
export function diffShapes(previous: TypeAnnotation, next: TypeAnnotation): ShapeDiffEntry[] {
  if (typeof previous === "string" || typeof next === "string") return [];
  if (previous.kind !== "record" || next.kind !== "record") return [];

  const entries: ShapeDiffEntry[] = [];
  const previousKeys = Object.keys(previous.fields);
  const nextKeys = Object.keys(next.fields);

  for (const key of nextKeys) {
    if (!(key in previous.fields)) {
      entries.push({ kind: "added", field: key, type: next.fields[key]! });
    }
  }
  for (const key of previousKeys) {
    if (!(key in next.fields)) {
      entries.push({ kind: "removed", field: key, type: previous.fields[key]! });
    }
  }
  for (const key of previousKeys) {
    if (key in next.fields && !sameType(previous.fields[key]!, next.fields[key]!)) {
      entries.push({ kind: "changed", field: key, from: previous.fields[key]!, to: next.fields[key]! });
    }
  }

  return entries;
}

export function formatShapeDiff(entries: ShapeDiffEntry[]): string {
  return entries
    .map(entry => {
      if (entry.kind === "added") return `  + ${entry.field}: ${formatType(entry.type)}`;
      if (entry.kind === "removed") return `  - ${entry.field}: ${formatType(entry.type)}`;
      return `  ~ ${entry.field}: ${formatType(entry.from)} -> ${formatType(entry.to)}`;
    })
    .join("\n");
}
