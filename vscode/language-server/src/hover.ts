import { Hover, MarkupKind } from "vscode-languageserver/node.js";
import type { HoverParams } from "vscode-languageserver/node.js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import type { TypeAnnotation } from "@raven/compiler";
import { symbolAt } from "./symbolAt.js";

function formatType(type: TypeAnnotation): string {
  if (type === "any") return "any";
  if (typeof type === "string") return type;
  if (type.kind === "array") return `${formatType(type.elementType)}[]`;
  if (type.kind === "record") {
    const fields = Object.entries(type.fields)
      .map(([key, value]) => `${key}: ${formatType(value)}`)
      .join("; ");
    return `{ ${fields} }`;
  }
  return "unknown";
}

export function onHover(document: TextDocument, params: HoverParams): Hover | null {
  const binding = symbolAt(document, params.position);
  if (!binding) return null;

  const keyword = binding.kind === "constant" ? "const" : binding.kind === "parameter" ? "param" : binding.kind === "function" ? "fn" : "let";
  const signature = binding.kind === "function"
    ? `fn ${binding.name}(...): ${formatType(binding.type)}`
    : `${keyword} ${binding.name}: ${formatType(binding.type)}`;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `\`\`\`raven\n${signature}\n\`\`\``,
    },
  };
}