import { TypeAnnotation, SourceLocation } from "../ast/nodes.js";
import { sameType, diffShapes, formatShapeDiff } from "./types.js";

export interface PublishedModel {
  name: string;
  type: TypeAnnotation;
  external: boolean;
  file: string;
  location: SourceLocation;
}

export type PublishResult =
  | { ok: true }
  | { ok: false; message: string; existing: PublishedModel };

export class WorkspaceRegistry {
  private models = new Map<string, PublishedModel>();

  publish(name: string, type: TypeAnnotation, external: boolean, file: string, location: SourceLocation): PublishResult {
    const existing = this.models.get(name);

    if (!existing) {
      this.models.set(name, { name, type, external, file, location });
      return { ok: true };
    }

  
    if (existing.file === file) {
      return { ok: true };
    }

    if (external || existing.external) {
      return { ok: true };
    }

    if (sameType(existing.type, type)) {
      return { ok: true };
    }

    const diff = diffShapes(existing.type, type);
    const diffText = diff.length > 0 ? `\n${formatShapeDiff(diff)}` : "";

    return {
      ok: false,
      message: `Model '${name}' is already published with a different shape.${diffText}`,
      existing,
    };
  }

  lookup(name: string): PublishedModel | undefined {
    return this.models.get(name);
  }

  all(): PublishedModel[] {
    return [...this.models.values()];
  }

  names(): string[] {
    return [...this.models.keys()];
  }
}
