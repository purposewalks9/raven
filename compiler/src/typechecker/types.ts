import { TypeAnnotation } from "../ast/nodes.js";

export function makeUnion(members: TypeAnnotation[]): TypeAnnotation {
  return unionType(members);
}


export function sameType(left: TypeAnnotation, right: TypeAnnotation): boolean {
  const normalizedLeft = normalizeType(left);
  const normalizedRight = normalizeType(right);

  if (normalizedLeft === "any" || normalizedRight === "any") return true;

  if (typeof normalizedLeft === "string" && typeof normalizedRight === "string") {
    return normalizedLeft === normalizedRight;
  }
  if (typeof normalizedLeft === "string" || typeof normalizedRight === "string") {
    return false;
  }
  if (normalizedLeft.kind !== normalizedRight.kind) {
    return false;
  }

  if (normalizedLeft.kind === "array" && normalizedRight.kind === "array") {
    return sameType(normalizedLeft.elementType, normalizedRight.elementType);
  }

  if (normalizedLeft.kind === "record" && normalizedRight.kind === "record") {
    const leftKeys = Object.keys(normalizedLeft.fields);
    const rightKeys = Object.keys(normalizedRight.fields);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every(key => {
      const rightFieldType = normalizedRight.fields[key];
      return rightFieldType !== undefined && sameType(normalizedLeft.fields[key]!, rightFieldType);
    });
  }

  if (normalizedLeft.kind === "tuple" && normalizedRight.kind === "tuple") {
    return normalizedLeft.elements.length === normalizedRight.elements.length
        && normalizedLeft.elements.every((el, i) => sameType(el, normalizedRight.elements[i]!));
}

  if (normalizedLeft.kind === "optional" && normalizedRight.kind === "optional") {
    return sameType(normalizedLeft.inner, normalizedRight.inner);
  }

  if (normalizedLeft.kind === "union" && normalizedRight.kind === "union") {
    return normalizedLeft.variants.length === normalizedRight.variants.length
      && normalizedLeft.variants.every(leftVariant => normalizedRight.variants.some(rightVariant => sameType(leftVariant, rightVariant)));
  }

  if (normalizedLeft.kind === "function" && normalizedRight.kind === "function") {
  return normalizedLeft.params.length === normalizedRight.params.length
    && normalizedLeft.params.every((param, index) =>
      sameType(param, normalizedRight.params[index]!)
    )
    && sameType(normalizedLeft.returnType, normalizedRight.returnType);
}

  if (normalizedLeft.kind === "literal" && normalizedRight.kind === "literal") {
    return normalizedLeft.value === normalizedRight.value;
  }

  return false;
}

export function normalizeType(type: TypeAnnotation): TypeAnnotation {
  if (typeof type === "string") return type;

  if (type.kind === "array") {
    return { kind: "array", elementType: normalizeType(type.elementType) };
  }

  if (type.kind === "record") {
    const fields: Record<string, TypeAnnotation> = {};
    for (const [key, fieldType] of Object.entries(type.fields)) {
      fields[key] = normalizeType(fieldType);
    }
    return { kind: "record", fields };
  }
if (type.kind === "tuple") {
    return { kind: "tuple", elements: type.elements.map(normalizeType) };
}
  if (type.kind === "optional") {
    return { kind: "optional", inner: normalizeType(type.inner) };
  }

  if (type.kind === "literal") {
    return { kind: "literal", value: type.value };
  }
if (type.kind === "function") {
  return {
    kind: "function",
    params: type.params.map(normalizeType),
    returnType: normalizeType(type.returnType),
  };
}
  const variants = type.variants.flatMap(variant => {
    const normalized = normalizeType(variant);
    return typeof normalized === "object" && normalized.kind === "union" ? normalized.variants : [normalized];
  });

  if (variants.some(variant => variant === "any")) return "any";

  const unique: TypeAnnotation[] = [];
  for (const variant of variants) {
    if (!unique.some(existing => sameType(existing, variant))) {
      unique.push(variant);
    }
  }

  if (unique.length === 0) return "any";
  if (unique.length === 1) return unique[0]!;
  return { kind: "union", variants: unique };
}

export function optionalType(inner: TypeAnnotation): TypeAnnotation {
  const normalized = normalizeType(inner);
  if (typeof normalized === "object" && normalized.kind === "optional") return normalized;
  return { kind: "optional", inner: normalized };
}

export function unionType(variants: TypeAnnotation[]): TypeAnnotation {
  return normalizeType({ kind: "union", variants });
}

export function isAssignableTo(source: TypeAnnotation, target: TypeAnnotation): boolean {
  const normalizedSource = normalizeType(source);
  const normalizedTarget = normalizeType(target);

  if (normalizedSource === "any" || normalizedTarget === "any") return true;

  if (typeof normalizedSource === "object" && normalizedSource.kind === "optional") {
    return typeof normalizedTarget === "object" && normalizedTarget.kind === "optional"
      && isAssignableTo(normalizedSource.inner, normalizedTarget.inner);
  }

  if (typeof normalizedTarget === "object" && normalizedTarget.kind === "optional") {
    return isAssignableTo(normalizedSource, normalizedTarget.inner);
  }

  if (typeof normalizedSource === "object" && normalizedSource.kind === "union") {
    return normalizedSource.variants.every(variant => isAssignableTo(variant, normalizedTarget));
  }

  if (typeof normalizedTarget === "object" && normalizedTarget.kind === "union") {
    return normalizedTarget.variants.some(variant => isAssignableTo(normalizedSource, variant));
  }

  if (typeof normalizedSource === "object" && normalizedSource.kind === "literal") {
    if (typeof normalizedTarget === "object" && normalizedTarget.kind === "literal") {
      return normalizedSource.value === normalizedTarget.value;
    }
    if (typeof normalizedTarget === "string") {
      return typeof normalizedSource.value === normalizedTarget;
    }
    return false;
  }
  if (typeof normalizedTarget === "object" && normalizedTarget.kind === "literal") {
    return false;
  }

  if (typeof normalizedSource === "string" && typeof normalizedTarget === "string") {
    return normalizedSource === normalizedTarget;
  }
  if (typeof normalizedSource === "string" || typeof normalizedTarget === "string") {
    return false;
  }
  if (normalizedSource.kind !== normalizedTarget.kind) {
    return false;
  }

  if (normalizedSource.kind === "array" && normalizedTarget.kind === "array") {
    return isAssignableTo(normalizedSource.elementType, normalizedTarget.elementType);
  }

  if (normalizedSource.kind === "record" && normalizedTarget.kind === "record") {
    return Object.entries(normalizedTarget.fields).every(([key, targetField]) => {
      const sourceField = normalizedSource.fields[key];
      return sourceField === undefined
        ? isOptionalType(targetField)
        : isAssignableTo(sourceField, targetField);
    });
  }
  if (normalizedSource.kind === "tuple" && normalizedTarget.kind === "tuple") {
    return normalizedSource.elements.length === normalizedTarget.elements.length
        && normalizedSource.elements.every((el, i) => isAssignableTo(el, normalizedTarget.elements[i]!));
}
  if (normalizedSource.kind === "function" && normalizedTarget.kind === "function") {
  if (normalizedSource.params.length !== normalizedTarget.params.length) {
    return false;
  }

  const paramsAssignable = normalizedSource.params.every((sourceParam, index) => {
    const targetParam = normalizedTarget.params[index]!;
    return isAssignableTo(targetParam, sourceParam);
  });

  if (!paramsAssignable) {
    return false;
  }

  return isAssignableTo(
    normalizedSource.returnType,
    normalizedTarget.returnType
  );
}
  return false;
}

export function isOptionalType(type: TypeAnnotation): boolean {
  const normalized = normalizeType(type);
  return typeof normalized === "object" && normalized.kind === "optional";
}

export function formatType(type: TypeAnnotation | undefined): string {
  if (!type) return "unknown";
  const normalized = normalizeType(type);
  if (normalized === "any") return "any";
  if (typeof normalized === "string") {
    return normalized;
  }
  if (normalized.kind === "array") {
    const elementNormalized = normalizeType(normalized.elementType);
    const needsParens = typeof elementNormalized === "object"
      && (elementNormalized.kind === "union" || elementNormalized.kind === "optional");
    const elementText = formatType(normalized.elementType);
    return needsParens ? `(${elementText})[]` : `${elementText}[]`;
  }
  if (normalized.kind === "record") {
    const fields = Object.entries(normalized.fields)
      .map(([key, fieldType]) => `${key}: ${formatType(fieldType)}`)
      .join(", ");
    return `{ ${fields} }`;
  }

  if (normalized.kind === "tuple") {
    return `[${normalized.elements.map(formatType).join(", ")}]`;
}
  if (normalized.kind === "optional") {
    return `${formatType(normalized.inner)}?`;
  }
  if (normalized.kind === "union") {
    return normalized.variants.map(formatType).join(" | ");
  }
  if (normalized.kind === "literal") {
    return typeof normalized.value === "string" ? JSON.stringify(normalized.value) : String(normalized.value);
  }
  if (normalized.kind === "function") {
  const params = normalized.params
    .map(formatType)
    .join(", ");

  return `(${params}) -> ${formatType(normalized.returnType)}`;
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
