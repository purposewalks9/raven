import { TypeAnnotation } from "../ast/nodes.js";

export function isDirectSelfAlias(type: TypeAnnotation, selfName: string): boolean {
    return typeof type === "object" && type.kind === "ref" && type.name === selfName;
}