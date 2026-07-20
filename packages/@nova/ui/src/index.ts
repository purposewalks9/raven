// Placeholder registry — the typechecker resolves UI node names (card,
// input, button, ...) against this at compile time (see language/syntax.md).
export const NOVA_UI_COMPONENTS = [
  "center", "card", "heading", "text", "input", "checkbox", "button",
  "divider", "socialButton", "link", "footer",
] as const;
export type NovaUIComponent = (typeof NOVA_UI_COMPONENTS)[number];
