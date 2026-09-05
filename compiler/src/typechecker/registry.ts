import { TypeAnnotation, SourceLocation } from "../ast/nodes.js";
import { NativeRegistry } from "../native.js";

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

const NATIVE = Symbol("nativeRegistry");

/**
 * Workspace-wide model registry. All state lives in the native binding; this
 * class is a thin marshalling wrapper that keeps the exact API surface of the
 * previous TypeScript implementation.
 */
export class WorkspaceRegistry {
  private [NATIVE] = new NativeRegistry();

  publish(
    name: string,
    type: TypeAnnotation,
    external: boolean,
    file: string,
    location: SourceLocation,
  ): PublishResult {
    const result = this[NATIVE].publish(
      name,
      JSON.stringify(type),
      external,
      file,
      JSON.stringify(location),
    );
    return JSON.parse(result) as PublishResult;
  }

  lookup(name: string): PublishedModel | undefined {
    const result = this[NATIVE].lookup(name);
    return result === null ? undefined : (JSON.parse(result) as PublishedModel);
  }

  all(): PublishedModel[] {
    return this[NATIVE].all().map(model => JSON.parse(model) as PublishedModel);
  }

  names(): string[] {
    return this[NATIVE].names();
  }
}

/**
 * Internal accessor so `TypeChecker` can pass the shared native registry into
 * `checkProgram`. Not part of the package's public API surface.
 */
export function nativeRegistryOf(registry: WorkspaceRegistry): NativeRegistry {
  return registry[NATIVE];
}