import { describe, it, expect } from "vitest";
import { TypeChecker } from "../src/typechecker/checker.js";
import type { Program } from "../src/ast/index.js";

describe("TypeChecker", () => {
  // ========== VARIABLE DECLARATIONS ==========
  
  describe("Variable Declarations", () => {
    it("passes when annotation matches the value's type", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "name",
          value: { type: "StringLiteral", value: "World" },
          typeAnnotation: "string",
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("passes when there is no annotation (type inference)", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "name",
          value: { type: "StringLiteral", value: "World" },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("infers boolean type correctly", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "isReady",
          value: { type: "BooleanLiteral", value: true },
          typeAnnotation: "boolean",
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("reports a type mismatch between annotation and value", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "age",
          value: { type: "StringLiteral", value: "oops" },
          typeAnnotation: "number",
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("age");
      expect(errors[0].message).toContain("number");
      expect(errors[0].message).toContain("string");
    });

    it("catches a boolean/string mismatch", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "isReady",
          value: { type: "StringLiteral", value: "yes" },
          typeAnnotation: "boolean",
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("isReady");
      expect(errors[0].message).toContain("boolean");
      expect(errors[0].message).toContain("string");
    });

    it("rejects duplicate variable declarations", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "VariableDeclaration",
            name: "x",
            value: { type: "NumberLiteral", value: 5 },
          },
          {
            type: "VariableDeclaration",
            name: "x",
            value: { type: "NumberLiteral", value: 10 },
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("already been declared");
    });
  });

  // ========== CONSTANT DECLARATIONS ==========
  
  describe("Constant Declarations", () => {
    it("allows const declaration with matching type", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "ConstantDeclaration",
          name: "pi",
          value: { type: "NumberLiteral", value: 3.14 },
          typeAnnotation: "number",
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows const without type annotation (inferred)", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "ConstantDeclaration",
          name: "message",
          value: { type: "StringLiteral", value: "Hello" },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects reassigning a const constant", () => {
      const ast: Program = {
        type: "Program",
        body: [
          { 
            type: "ConstantDeclaration", 
            name: "pi", 
            value: { type: "NumberLiteral", value: 3 } 
          },
          { 
            type: "Assignment", 
            name: "pi", 
            value: { type: "NumberLiteral", value: 4 } 
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Cannot reassign");
      expect(errors[0].message).toContain("const");
    });

    it("allows reassigning a let variable", () => {
      const ast: Program = {
        type: "Program",
        body: [
          { 
            type: "VariableDeclaration", 
            name: "age", 
            value: { type: "NumberLiteral", value: 5 } 
          },
          { 
            type: "Assignment", 
            name: "age", 
            value: { type: "NumberLiteral", value: 6 } 
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects reassigning a let variable with wrong type", () => {
      const ast: Program = {
        type: "Program",
        body: [
          { 
            type: "VariableDeclaration", 
            name: "age", 
            value: { type: "NumberLiteral", value: 5 } 
          },
          { 
            type: "Assignment", 
            name: "age", 
            value: { type: "StringLiteral", value: "six" } 
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Type mismatch");
      expect(errors[0].message).toContain("age");
    });
  });

  // ========== ASSIGNMENTS ==========
  
  describe("Assignments", () => {
    it("rejects assigning to an undeclared variable", () => {
      const ast: Program = {
        type: "Program",
        body: [{ 
          type: "Assignment", 
          name: "ghost", 
          value: { type: "NumberLiteral", value: 1 } 
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("undeclared variable");
    });

    it("allows assigning a compatible type to a declared variable", () => {
      const ast: Program = {
        type: "Program",
        body: [
          { 
            type: "VariableDeclaration", 
            name: "count", 
            value: { type: "NumberLiteral", value: 0 } 
          },
          { 
            type: "Assignment", 
            name: "count", 
            value: { type: "NumberLiteral", value: 5 } 
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });
  });

  // ========== CONTROL FLOW ==========
  
  describe("Control Flow", () => {
    it("requires a boolean if-condition", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "IfStatement",
          condition: { type: "NumberLiteral", value: 5 },
          consequent: [],
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("boolean");
    });

    it("allows if with boolean condition", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "IfStatement",
          condition: { type: "BooleanLiteral", value: true },
          consequent: [
            {
              type: "VariableDeclaration",
              name: "x",
              value: { type: "NumberLiteral", value: 1 },
            },
          ],
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("requires a boolean while-condition", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "WhileStatement",
          condition: { type: "NumberLiteral", value: 5 },
          body: [],
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("boolean");
    });

    it("allows while with boolean condition", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "WhileStatement",
          condition: { type: "BooleanLiteral", value: true },
          body: [
            {
              type: "VariableDeclaration",
              name: "x",
              value: { type: "NumberLiteral", value: 1 },
            },
          ],
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("handles if-else with different scopes", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "IfStatement",
          condition: { type: "BooleanLiteral", value: true },
          consequent: [
            {
              type: "VariableDeclaration",
              name: "x",
              value: { type: "NumberLiteral", value: 1 },
            },
          ],
          alternate: [
            {
              type: "VariableDeclaration",
              name: "y",
              value: { type: "NumberLiteral", value: 2 },
            },
          ],
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });
  });

  // ========== BINARY EXPRESSIONS ==========
  
  describe("Binary Expressions", () => {
    it("allows adding two numbers", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "BinaryExpression",
            operator: "+",
            left: { type: "NumberLiteral", value: 2 },
            right: { type: "NumberLiteral", value: 3 },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows string concatenation", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "greeting",
          value: {
            type: "BinaryExpression",
            operator: "+",
            left: { type: "StringLiteral", value: "Hello " },
            right: { type: "StringLiteral", value: "World" },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows string + number (string concatenation)", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "BinaryExpression",
            operator: "+",
            left: { type: "StringLiteral", value: "Hello " },
            right: { type: "NumberLiteral", value: 5 },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows number + string (string concatenation)", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "BinaryExpression",
            operator: "+",
            left: { type: "NumberLiteral", value: 5 },
            right: { type: "StringLiteral", value: " times" },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects adding a number and a string with invalid operator", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "BinaryExpression",
            operator: "-",
            left: { type: "NumberLiteral", value: 2 },
            right: { type: "StringLiteral", value: "oops" },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("number");
    });

    it("allows comparing two numbers", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          typeAnnotation: "boolean",
          value: {
            type: "BinaryExpression",
            operator: ">",
            left: { type: "NumberLiteral", value: 5 },
            right: { type: "NumberLiteral", value: 3 },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows comparing two strings", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          typeAnnotation: "boolean",
          value: {
            type: "BinaryExpression",
            operator: "==",
            left: { type: "StringLiteral", value: "hello" },
            right: { type: "StringLiteral", value: "world" },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects comparing different types", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "BinaryExpression",
            operator: "==",
            left: { type: "NumberLiteral", value: 5 },
            right: { type: "StringLiteral", value: "5" },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Cannot compare");
    });

    it("allows logical AND with booleans", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          typeAnnotation: "boolean",
          value: {
            type: "BinaryExpression",
            operator: "and",
            left: { type: "BooleanLiteral", value: true },
            right: { type: "BooleanLiteral", value: false },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows logical OR with booleans", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          typeAnnotation: "boolean",
          value: {
            type: "BinaryExpression",
            operator: "or",
            left: { type: "BooleanLiteral", value: true },
            right: { type: "BooleanLiteral", value: false },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects logical AND with non-booleans", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "BinaryExpression",
            operator: "and",
            left: { type: "NumberLiteral", value: 5 },
            right: { type: "BooleanLiteral", value: true },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("requires two booleans");
    });
  });

  // ========== UNARY EXPRESSIONS ==========
  
  describe("Unary Expressions", () => {
    it("allows 'not' with boolean", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          typeAnnotation: "boolean",
          value: {
            type: "UnaryExpression",
            operator: "not",
            argument: { type: "BooleanLiteral", value: true },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects 'not' with non-boolean", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "UnaryExpression",
            operator: "not",
            argument: { type: "NumberLiteral", value: 5 },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("not");
    });
  });

  // ========== PRINT STATEMENTS ==========
  
  describe("Print Statements", () => {
    it("allows printing a declared variable", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "VariableDeclaration",
            name: "name",
            value: { type: "StringLiteral", value: "World" },
          },
          {
            type: "PrintStatement",
            argument: { type: "Identifier", name: "name" },
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("reports an undeclared variable used in print", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "PrintStatement",
          argument: { type: "Identifier", name: "ghost" },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Undeclared variable");
      expect(errors[0].message).toContain("ghost");
    });

    it("allows printing any type", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "PrintStatement",
            argument: { type: "StringLiteral", value: "Hello" },
          },
          {
            type: "PrintStatement",
            argument: { type: "NumberLiteral", value: 42 },
          },
          {
            type: "PrintStatement",
            argument: { type: "BooleanLiteral", value: true },
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });
  });

  // ========== FUNCTIONS ==========
  
  describe("Functions", () => {
    it("allows declaring a simple function", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "FunctionDeclaration",
          name: "add",
          parameters: [
            { name: "a", typeAnnotation: "number" },
            { name: "b", typeAnnotation: "number" },
          ],
          returnType: "number",
          body: [
            {
              type: "ReturnStatement",
              value: {
                type: "BinaryExpression",
                operator: "+",
                left: { type: "Identifier", name: "a" },
                right: { type: "Identifier", name: "b" },
              },
            },
          ],
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows calling a declared function", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "FunctionDeclaration",
            name: "add",
            parameters: [
              { name: "a", typeAnnotation: "number" },
              { name: "b", typeAnnotation: "number" },
            ],
            returnType: "number",
            body: [
              {
                type: "ReturnStatement",
                value: {
                  type: "BinaryExpression",
                  operator: "+",
                  left: { type: "Identifier", name: "a" },
                  right: { type: "Identifier", name: "b" },
                },
              },
            ],
          },
          {
            type: "VariableDeclaration",
            name: "result",
            value: {
              type: "CallExpression",
              callee: "add",
              arguments: [
                { type: "NumberLiteral", value: 2 },
                { type: "NumberLiteral", value: 3 },
              ],
            },
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects calling an undeclared function", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "result",
          value: {
            type: "CallExpression",
            callee: "foo",
            arguments: [],
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Undeclared function");
    });

    it("rejects function call with wrong argument count", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "FunctionDeclaration",
            name: "add",
            parameters: [
              { name: "a", typeAnnotation: "number" },
              { name: "b", typeAnnotation: "number" },
            ],
            returnType: "number",
            body: [
              {
                type: "ReturnStatement",
                value: { type: "NumberLiteral", value: 0 },
              },
            ],
          },
          {
            type: "VariableDeclaration",
            name: "result",
            value: {
              type: "CallExpression",
              callee: "add",
              arguments: [
                { type: "NumberLiteral", value: 2 },
              ],
            },
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("expects");
      expect(errors[0].message).toContain("argument");
    });

    it("rejects function call with wrong argument type", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "FunctionDeclaration",
            name: "add",
            parameters: [
              { name: "a", typeAnnotation: "number" },
              { name: "b", typeAnnotation: "number" },
            ],
            returnType: "number",
            body: [
              {
                type: "ReturnStatement",
                value: { type: "NumberLiteral", value: 0 },
              },
            ],
          },
          {
            type: "VariableDeclaration",
            name: "result",
            value: {
              type: "CallExpression",
              callee: "add",
              arguments: [
                { type: "StringLiteral", value: "2" },
                { type: "NumberLiteral", value: 3 },
              ],
            },
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Argument");
      expect(errors[0].message).toContain("expected");
    });

    it("rejects duplicate function declarations", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "FunctionDeclaration",
            name: "foo",
            parameters: [],
            returnType: "number",
            body: [
              {
                type: "ReturnStatement",
                value: { type: "NumberLiteral", value: 1 },
              },
            ],
          },
          {
            type: "FunctionDeclaration",
            name: "foo",
            parameters: [],
            returnType: "number",
            body: [
              {
                type: "ReturnStatement",
                value: { type: "NumberLiteral", value: 2 },
              },
            ],
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("already been declared");
    });

    it("handles return type mismatch", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "FunctionDeclaration",
          name: "foo",
          parameters: [],
          returnType: "number",
          body: [
            {
              type: "ReturnStatement",
              value: { type: "StringLiteral", value: "hello" },
            },
          ],
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Return type mismatch");
    });
  });

  // ========== ARRAYS ==========
  
  describe("Arrays", () => {
    it("allows declaring an empty array", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "items",
          value: {
            type: "ArrayLiteral",
            elements: [],
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows declaring an array with elements", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "numbers",
          value: {
            type: "ArrayLiteral",
            elements: [
              { type: "NumberLiteral", value: 1 },
              { type: "NumberLiteral", value: 2 },
              { type: "NumberLiteral", value: 3 },
            ],
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects array with mixed types", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "mixed",
          value: {
            type: "ArrayLiteral",
            elements: [
              { type: "NumberLiteral", value: 1 },
              { type: "StringLiteral", value: "two" },
              { type: "NumberLiteral", value: 3 },
            ],
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("same type");
    });

    it("allows array indexing", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "VariableDeclaration",
            name: "numbers",
            value: {
              type: "ArrayLiteral",
              elements: [
                { type: "NumberLiteral", value: 1 },
                { type: "NumberLiteral", value: 2 },
              ],
            },
          },
          {
            type: "VariableDeclaration",
            name: "first",
            value: {
              type: "IndexExpression",
              array: { type: "Identifier", name: "numbers" },
              index: { type: "NumberLiteral", value: 0 },
            },
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("rejects indexing a non-array", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "IndexExpression",
            array: { type: "StringLiteral", value: "hello" },
            index: { type: "NumberLiteral", value: 0 },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain("Cannot index");
    });

    it("allows array concatenation with +", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "combined",
          value: {
            type: "BinaryExpression",
            operator: "+",
            left: {
              type: "ArrayLiteral",
              elements: [{ type: "NumberLiteral", value: 1 }],
            },
            right: {
              type: "ArrayLiteral",
              elements: [{ type: "NumberLiteral", value: 2 }],
            },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows appending to array with +", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "numbers",
          value: {
            type: "BinaryExpression",
            operator: "+",
            left: {
              type: "ArrayLiteral",
              elements: [{ type: "NumberLiteral", value: 1 }],
            },
            right: { type: "NumberLiteral", value: 2 },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });
it("rejects appending wrong type to array", () => {
  const ast: Program = {
    type: "Program",
    body: [{
      type: "VariableDeclaration",
      name: "mixed",
      value: {
        type: "BinaryExpression",
        operator: "+",
        left: {
          type: "ArrayLiteral",
          elements: [{ type: "NumberLiteral", value: 1 }],
        },
        right: { type: "StringLiteral", value: "oops" },
      },
    }],
  };
  const errors = new TypeChecker().check(ast);
  expect(errors.length).toBe(1);
  expect(errors[0].message).toContain("Cannot append");
});
  });

  // ========== SCOPE ==========
  
  describe("Scope", () => {
    it("allows variable shadowing in nested scope", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "VariableDeclaration",
            name: "x",
            value: { type: "NumberLiteral", value: 1 },
          },
          {
            type: "IfStatement",
            condition: { type: "BooleanLiteral", value: true },
            consequent: [
              {
                type: "VariableDeclaration",
                name: "x",
                value: { type: "NumberLiteral", value: 2 },
              },
            ],
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows accessing outer scope variable inside if", () => {
      const ast: Program = {
        type: "Program",
        body: [
          {
            type: "VariableDeclaration",
            name: "x",
            value: { type: "NumberLiteral", value: 1 },
          },
          {
            type: "IfStatement",
            condition: { type: "BooleanLiteral", value: true },
            consequent: [
              {
                type: "PrintStatement",
                argument: { type: "Identifier", name: "x" },
              },
            ],
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });
  });

  // ========== BUILT-IN FUNCTIONS ==========
  
  describe("Built-in Functions", () => {
    it("allows abs function", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "CallExpression",
            callee: "abs",
            arguments: [{ type: "NumberLiteral", value: -5 }],
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows len function", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "CallExpression",
            callee: "len",
            arguments: [{
              type: "ArrayLiteral",
              elements: [
                { type: "NumberLiteral", value: 1 },
                { type: "NumberLiteral", value: 2 },
              ],
            }],
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows sqrt function", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "CallExpression",
            callee: "sqrt",
            arguments: [{ type: "NumberLiteral", value: 25 }],
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows toString function", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          value: {
            type: "CallExpression",
            callee: "toString",
            arguments: [{ type: "NumberLiteral", value: 42 }],
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });
  });

  // ========== COMPLEX EXPRESSIONS ==========
  
  describe("Complex Expressions", () => {
    it("allows nested binary expressions", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "result",
          value: {
            type: "BinaryExpression",
            operator: "*",
            left: {
              type: "BinaryExpression",
              operator: "+",
              left: { type: "NumberLiteral", value: 2 },
              right: { type: "NumberLiteral", value: 3 },
            },
            right: { type: "NumberLiteral", value: 4 },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });

    it("allows comparison of expressions", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "x",
          typeAnnotation: "boolean",
          value: {
            type: "BinaryExpression",
            operator: ">",
            left: {
              type: "BinaryExpression",
              operator: "+",
              left: { type: "NumberLiteral", value: 2 },
              right: { type: "NumberLiteral", value: 3 },
            },
            right: { type: "NumberLiteral", value: 4 },
          },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors).toEqual([]);
    });
  });

  // ========== ERROR MESSAGES ==========
  
  describe("Error Messages", () => {
    it("provides clear error message for type mismatch", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "VariableDeclaration",
          name: "age",
          value: { type: "StringLiteral", value: "oops" },
          typeAnnotation: "number",
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors[0].message).toContain("age");
      expect(errors[0].message).toContain("number");
      expect(errors[0].message).toContain("string");
    });

    it("provides clear error message for undeclared variable", () => {
      const ast: Program = {
        type: "Program",
        body: [{
          type: "PrintStatement",
          argument: { type: "Identifier", name: "ghost" },
        }],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors[0].message).toContain("Undeclared variable");
      expect(errors[0].message).toContain("ghost");
    });

    it("provides clear error message for const reassignment", () => {
      const ast: Program = {
        type: "Program",
        body: [
          { 
            type: "ConstantDeclaration", 
            name: "pi", 
            value: { type: "NumberLiteral", value: 3 } 
          },
          { 
            type: "Assignment", 
            name: "pi", 
            value: { type: "NumberLiteral", value: 4 } 
          },
        ],
      };
      const errors = new TypeChecker().check(ast);
      expect(errors[0].message).toContain("Cannot reassign");
      expect(errors[0].message).toContain("const");
    });
  });
});