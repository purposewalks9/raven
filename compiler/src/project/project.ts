import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { tokenize } from "../lexer/token.js";
import { Parser } from "../parser/parser.js";
import { TypeChecker, FunctionSignature } from "../typechecker/checker.js";
import { WorkspaceRegistry } from "../typechecker/registry.js";
import { Diagnostic } from "../diagnostics/index.js";
import { Program, FunctionDeclaration, ImportDeclaration } from "../ast/nodes.js";

export interface ProjectFile {
  path: string;
  source: string;
  ast: Program;
}

export interface ProjectDiagnostic extends Diagnostic {
  file: string;
}

export interface ProjectResult {
  files: ProjectFile[];
  diagnostics: ProjectDiagnostic[];
  registry: WorkspaceRegistry;
  hasErrors: boolean;
}

function findRavenFiles(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      const stats = statSync(full);
      if (stats.isDirectory()) {
        walk(full);
      } else if (extname(full) === ".rv") {
        results.push(full);
      }
    }
  };
  walk(root);
  return results;
}

function resolveImportPath(fromFile: string, source: string, knownFiles: Set<string>): string | undefined {
  // No bare-package resolution (e.g. `import x from "some-lib"`) yet —
  // only relative/absolute paths within the project.
  if (!source.startsWith(".") && !isAbsolute(source)) return undefined;

  const base = resolve(dirname(fromFile), source);
  const candidates = [base, `${base}.rv`, join(base, "index.rv")];
  return candidates.find(candidate => knownFiles.has(candidate));
}

/**
 * Compiles an entire project directory (or a single file) with full
 * cross-file `model` resolution.
 *
 * Function signatures are always fully annotated by the parser, so imports
 * can be resolved with one static AST scan — no need to run the checker
 * first. Models are different: their shape is inferred, so we run the
 * checker in two rounds. Round 1 populates the WorkspaceRegistry (its
 * diagnostics are discarded, since files may reference models that haven't
 * been published yet on a first pass). Round 2 runs against the now-complete
 * registry and its diagnostics are authoritative.
 */
export function buildProject(root: string): ProjectResult {
  const rootPath = resolve(root);
  const isDir = statSync(rootPath).isDirectory();
  const filePaths = isDir ? findRavenFiles(rootPath) : [rootPath];

  const files: ProjectFile[] = [];
  const diagnostics: ProjectDiagnostic[] = [];

  for (const path of filePaths) {
    const source = readFileSync(path, "utf8");
    try {
      const ast = new Parser(tokenize(source, path)).parseProgram();
      files.push({ path, source, ast });
    } catch (error) {
      diagnostics.push({
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
        location: { file: path, start: 0, end: 0, line: 1, column: 1 },
        file: path,
      });
    }
  }

  const knownFiles = new Set(files.map(f => f.path));

  // Static signature scan: function params/return types are always
  // explicitly annotated, so exports can be resolved without checking.
  const exportedFunctions = new Map<string, Map<string, FunctionSignature>>();
  for (const file of files) {
    const signatures = new Map<string, FunctionSignature>();
    for (const stmt of file.ast.body) {
      if (stmt.type === "FunctionDeclaration") {
        const fn = stmt as FunctionDeclaration;
        signatures.set(fn.name, {
          params: fn.parameters.map(p => p.typeAnnotation ?? "any"),
          returnType: fn.returnType ?? "any",
        });
      }
    }
    exportedFunctions.set(file.path, signatures);
  }

  const importedFunctionsByFile = new Map<string, Map<string, FunctionSignature>>();
  for (const file of files) {
    const imports = new Map<string, FunctionSignature>();
    for (const stmt of file.ast.body) {
      if (stmt.type === "ImportDeclaration") {
        const imp = stmt as ImportDeclaration;
        const resolvedPath = resolveImportPath(file.path, imp.source, knownFiles);
        const sourceSignatures = resolvedPath ? exportedFunctions.get(resolvedPath) : undefined;
        for (const name of imp.names) {
          const sig = sourceSignatures?.get(name);
          if (sig) imports.set(name, sig);
        }
      }
    }
    importedFunctionsByFile.set(file.path, imports);
  }

  const registry = new WorkspaceRegistry();

  // Round 1 — populate the registry. Diagnostics discarded on purpose.
  for (const file of files) {
    const checker = new TypeChecker({
      registry,
      file: file.path,
      importedFunctions: importedFunctionsByFile.get(file.path),
    });
    checker.check(file.ast);
  }

  // Round 2 — registry is complete; these diagnostics are the real answer.
  for (const file of files) {
    const checker = new TypeChecker({
      registry,
      file: file.path,
      importedFunctions: importedFunctionsByFile.get(file.path),
    });
    const fileDiagnostics = checker.check(file.ast);
    for (const diagnostic of fileDiagnostics) {
      diagnostics.push({ ...diagnostic, file: file.path });
    }
  }

  return {
    files,
    diagnostics,
    registry,
    hasErrors: diagnostics.some(d => d.severity === "error"),
  };
}
