import type { Expression, Program, Statement } from "../ast/index.js";

export function optimize(program: Program): Program {
  return { ...program, body: optimizeStatements(program.body) };
}

function optimizeStatements(statements: Statement[]): Statement[] {
  const optimized: Statement[] = [];

  for (const statement of statements) {
    if (optimized.some(stmt => stmt.type === "ReturnStatement")) break;
    const next = optimizeStatement(statement);
    if (next) optimized.push(next);
  }

  return optimized;
}

function optimizeStatement(statement: Statement): Statement | undefined {
  switch (statement.type) {
    case "VariableDeclaration":
    case "ConstantDeclaration":
      return { ...statement, value: optimizeExpression(statement.value) };
    case "Assignment":
      return { ...statement, value: optimizeExpression(statement.value) };
    case "PrintStatement":
      return { ...statement, argument: optimizeExpression(statement.argument) };
    case "ExpressionStatement":
      return { ...statement, expression: optimizeExpression(statement.expression) };
    case "ReturnStatement":
      return { ...statement, value: optimizeExpression(statement.value) };
    case "IfStatement": {
      const condition = optimizeExpression(statement.condition);
      if (condition.type === "BooleanLiteral") {
        return condition.value
          ? { type: "IfStatement", condition, consequent: optimizeStatements(statement.consequent) }
          : statement.alternate
            ? { type: "IfStatement", condition, consequent: optimizeStatements(statement.alternate) }
            : undefined;
      }
      const optimizedIf = {
        ...statement,
        condition,
        consequent: optimizeStatements(statement.consequent),
      };
      return statement.alternate
        ? { ...optimizedIf, alternate: optimizeStatements(statement.alternate) }
        : optimizedIf;
    }
    case "WhileStatement": {
      const condition = optimizeExpression(statement.condition);
      if (condition.type === "BooleanLiteral" && !condition.value) return undefined;
      return { ...statement, condition, body: optimizeStatements(statement.body) };
    }
    case "FunctionDeclaration":
      return { ...statement, body: optimizeStatements(statement.body) };
    case "BreakStatement":
    case "ContinueStatement":
      return statement;
  }
}

function optimizeExpression(expression: Expression): Expression {
  switch (expression.type) {
    case "BinaryExpression": {
      const left = optimizeExpression(expression.left);
      const right = optimizeExpression(expression.right);
      if (left.type === "NumberLiteral" && right.type === "NumberLiteral") {
        const folded = foldNumbers(expression.operator, left.value, right.value);
        if (folded !== undefined) return typeof folded === "boolean" ? { type: "BooleanLiteral", value: folded } : { type: "NumberLiteral", value: folded };
      }
      if (left.type === "BooleanLiteral" && right.type === "BooleanLiteral") {
        const folded = foldBooleans(expression.operator, left.value, right.value);
        if (folded !== undefined) return { type: "BooleanLiteral", value: folded };
      }
      return { ...expression, left, right };
    }
    case "UnaryExpression": {
      const argument = optimizeExpression(expression.argument);
      return argument.type === "BooleanLiteral" ? { type: "BooleanLiteral", value: !argument.value } : { ...expression, argument };
    }
    case "ArrayLiteral":
      return { ...expression, elements: expression.elements.map(optimizeExpression) };
    case "IndexExpression":
      return { ...expression, array: optimizeExpression(expression.array), index: optimizeExpression(expression.index) };
    case "CallExpression":
      return { ...expression, arguments: expression.arguments.map(optimizeExpression) };
    default:
      return expression;
  }
}

function foldNumbers(operator: string, left: number, right: number): number | boolean | undefined {
  switch (operator) {
    case "+": return left + right;
    case "-": return left - right;
    case "*": return left * right;
    case "/": return right === 0 ? undefined : left / right;
    case "%": return right === 0 ? undefined : left % right;
    case "==": return left === right;
    case "!=": return left !== right;
    case "<": return left < right;
    case "<=": return left <= right;
    case ">": return left > right;
    case ">=": return left >= right;
    default: return undefined;
  }
}

function foldBooleans(operator: string, left: boolean, right: boolean): boolean | undefined {
  switch (operator) {
    case "and": return left && right;
    case "or": return left || right;
    case "==": return left === right;
    case "!=": return left !== right;
    default: return undefined;
  }
}
