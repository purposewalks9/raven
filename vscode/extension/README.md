# Raven VS Code Extension

The Raven Language extension provides language support for the Raven programming language in Visual Studio Code.

## Features

- **Diagnostics**: Real-time error checking and type-checking feedback
- **Hover Information**: Hover over symbols to see type signatures and documentation
- **Go to Definition**: Jump to symbol definitions with Ctrl+Click or Cmd+Click
- **Find References**: Find all usages of a symbol in your project

## Requirements

- VS Code 1.85 or later
- Node.js 18+ (included with VS Code)

## Installation

1. Build the extension:
   ```bash
   pnpm build
   ```

2. Package the extension:
   ```bash
   pnpm package
   ```

3. Install from the generated `.vsix` file in VS Code

## Development

### Setup

```bash
pnpm install
pnpm build
```

### Running in Development Mode

```bash
pnpm dev
```

Then press F5 in VS Code to launch the extension in a debug window.

### Building for Production

```bash
pnpm build
pnpm package
```

## Language Server

This extension uses the Raven Language Server (`@raven/language-server`) to provide intelligent features. The language server is automatically bundled with the extension during the build process.

## File Association

Files with the `.rv` extension are automatically recognized as Raven source files.

## License

MIT - See LICENSE file in the repository root
