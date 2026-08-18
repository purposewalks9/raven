import { encodeVlq } from "./vlq.js";

export interface RawMapping {
  generatedLine: number;
  generatedColumn: number;
  source: string;
  sourceLine: number;
  sourceColumn: number;
  name?: string;
}

export interface RawSourceMap {
  version: 3;
  file?: string;
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

export class SourceMapGenerator {
  private mappings: RawMapping[] = [];
  private sources: string[] = [];
  private sourceContents = new Map<string, string>();
  private names: string[] = [];

  addMapping(mapping: RawMapping): void {
    if (!this.sources.includes(mapping.source)) {
      this.sources.push(mapping.source);
    }
    if (mapping.name !== undefined && !this.names.includes(mapping.name)) {
      this.names.push(mapping.name);
    }
    this.mappings.push(mapping);
  }

  setSourceContent(source: string, content: string): void {
    if (!this.sources.includes(source)) {
      this.sources.push(source);
    }
    this.sourceContents.set(source, content);
  }

  toJSON(file?: string): RawSourceMap {
    const sorted = [...this.mappings].sort((a, b) =>
      a.generatedLine !== b.generatedLine
        ? a.generatedLine - b.generatedLine
        : a.generatedColumn - b.generatedColumn,
    );

    let mappingsText = "";
    let prevGeneratedLine = 0;
    let prevGeneratedColumn = 0;
    let prevSourceIndex = 0;
    let prevSourceLine = 0;
    let prevSourceColumn = 0;
    let prevNameIndex = 0;
    let firstSegmentOnLine = true;
    let lastEmittedGeneratedColumn: number | null = null;

    for (const mapping of sorted) {
      if (mapping.generatedLine !== prevGeneratedLine) {
        mappingsText += ";".repeat(mapping.generatedLine - prevGeneratedLine);
        prevGeneratedLine = mapping.generatedLine;
        prevGeneratedColumn = 0;
        firstSegmentOnLine = true;
        lastEmittedGeneratedColumn = null;
      }

      if (lastEmittedGeneratedColumn === mapping.generatedColumn) {
        continue;
      }

      if (!firstSegmentOnLine) {
        mappingsText += ",";
      }
      firstSegmentOnLine = false;

      const sourceIndex = this.sources.indexOf(mapping.source);
      const segment = [
        mapping.generatedColumn - prevGeneratedColumn,
        sourceIndex - prevSourceIndex,
        mapping.sourceLine - prevSourceLine,
        mapping.sourceColumn - prevSourceColumn,
      ];
      if (mapping.name !== undefined) {
        segment.push(this.names.indexOf(mapping.name) - prevNameIndex);
        prevNameIndex = this.names.indexOf(mapping.name);
      }

      mappingsText += encodeVlq(segment);

      prevGeneratedColumn = mapping.generatedColumn;
      lastEmittedGeneratedColumn = mapping.generatedColumn;
      prevSourceIndex = sourceIndex;
      prevSourceLine = mapping.sourceLine;
      prevSourceColumn = mapping.sourceColumn;
    }

    const sourcesContent = this.sources.map(s => this.sourceContents.get(s) ?? null);
    const hasAnyContent = sourcesContent.some(c => c !== null);

    return {
      version: 3,
      file,
      sources: this.sources,
      ...(hasAnyContent ? { sourcesContent } : {}),
      names: this.names,
      mappings: mappingsText,
    };
  }

  toString(file?: string): string {
    return JSON.stringify(this.toJSON(file));
  }

  /** A `data:` URI suitable for an inline `//# sourceMappingURL=` comment. */
  toDataUrl(file?: string): string {
    const json = this.toString(file);
    return `data:application/json;base64,${Buffer.from(json, "utf8").toString("base64")}`;
  }
}
