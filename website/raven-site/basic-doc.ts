import { DocSchema } from "@/lib/types";

export const ravenDoc: DocSchema = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Introduction",
        id: "introduction",
        description: "What Raven is and why it exists.",
      },
      {
        title: "Installation",
        id: "installation",
        description: "Set up the Raven compiler and CLI locally.",
      },
      {
        title: "Quick Start",
        id: "quick-start",
        description: "Write and run your first Raven program.",
      },
    ],
  },

  {
    title: "Language Basics",
    items: [
      {
        title: "Variables",
        id: "variables",
        description: "Declaring bindings with val and rave.",
      },
      {
        title: "Data Types",
        id: "data-types",
        description: "Primitive types and type annotations.",
      },
      {
        title: "Operators",
        id: "operators",
        description: "Arithmetic, comparison, and word-based logical operators.",
      },
    ],
  },

  {
    title: "Control Flow",
    items: [
      {
        title: "Conditionals",
        id: "conditionals",
        description: "if/then/else/end branching.",
      },
      {
        title: "Loops",
        id: "loops",
        description: "Iteration constructs in Raven.",
      },
    ],
  },

  {
    title: "Functions",
    items: [
      {
        title: "Defining Functions",
        id: "defining-functions",
        description: "fn/do/end syntax and parameters.",
      },
      {
        title: "Recursion",
        id: "recursion",
        description: "Writing recursive functions in Raven.",
      },
    ],
  },

  {
    title: "Data Structures",
    items: [
      {
        title: "Arrays",
        id: "arrays",
        description: "Array literals and indexing.",
      },
      {
        title: "Generics",
        id: "generics",
        description: "The array<T> generic type annotation syntax.",
      },
      {
        title: "Member Access",
        id: "member-access",
        description: "Dot-property access via MemberExpression.",
      },
      {
        title: "Index Assignment",
        id: "index-assignment",
        description: "Mutating array elements by index.",
      },
    ],
  },

  {
    title: "Compiler Pipeline",
    items: [
      {
        title: "Overview",
        id: "compiler-overview",
        description: "How source code becomes running Node.js code.",
      },
      {
        title: "Lexer",
        id: "lexer",
        description: "Tokenizing Raven source.",
      },
      {
        title: "Parser",
        id: "parser",
        description: "Building the abstract syntax tree.",
      },
      {
        title: "Type Checker",
        id: "type-checker",
        description: "Static type validation before emission.",
      },
      {
        title: "Emitter",
        id: "emitter",
        description: "Generating executable Node.js output.",
      },
    ],
  },

  {
    title: "Examples",
    items: [
      {
        title: "Sorting Algorithms",
        id: "sorting-algorithms",
        description: "Implementing sort algorithms in Raven.",
      },
      {
        title: "Matrix Operations",
        id: "matrix-operations",
        description: "Working with nested arrays as matrices.",
      },
    ],
  },
];