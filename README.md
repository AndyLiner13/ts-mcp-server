# ts-mcp-server

[![npm version](https://img.shields.io/npm/v/ts-mcp-server)](https://www.npmjs.com/package/ts-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/ts-mcp-server)](https://www.npmjs.com/package/ts-mcp-server)
[![license](https://img.shields.io/npm/l/ts-mcp-server)](./LICENSE)

A lightweight [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for **TypeScript and JavaScript refactoring**. Rename symbols, move files, reorganize folders, find references, get diagnostics — and have every `import`, `require`, re-export, and reference updated automatically across your entire codebase. Powered by the native TypeScript compiler.

## Why

AI coding assistants can read and write code, but they struggle with **structural changes** that ripple across many files. Renaming a function, moving a React component, or reorganizing a folder means updating every reference and import that touches it. Miss one and the build breaks.

`ts-mcp-server` gives any MCP-compatible client — [VS Code Copilot](https://code.visualstudio.com/), [Claude Desktop](https://claude.ai/), [Cursor](https://cursor.sh/), [Windsurf](https://codeium.com/windsurf), [Continue](https://continue.dev/), and others — the ability to perform these refactors **correctly and completely**, using TypeScript's own compiler infrastructure.

## Features

- **Rename symbols** — variables, functions, classes, types, properties, interfaces, enums — all references updated across every file
- **Find all references** — locate every usage of a symbol across the project, grouped by file with line context
- **Get diagnostics** — retrieve type errors, warnings, and suggestions for any file
- **Rename / move files** — `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`
- **Rename / move folders** — all imports referencing files inside the folder are updated
- **Automatic project discovery** — `tsconfig.json` is detected automatically; no configuration needed
- **Multi-project support** — monorepos, project references, and composite builds work out of the box
- **Preview mode** — see exactly what would change before applying anything
- **Cross-platform** — Windows, macOS, and Linux

## How It Works

Under the hood, `ts-mcp-server` communicates with TypeScript's `tsserver` over Node IPC — the same protocol that VS Code uses.

- **Symbol renames** use `rename` + `renameLocations` to find every reference to a symbol across the project, then apply text edits to each file.
- **File/folder renames** use `getEditsForFileRename` to compute every import path that needs updating, apply the edits to disk, then move the file or folder.
- **Find references** uses `references` to return every usage of a symbol, grouped by file.
- **Diagnostics** use `semanticDiagnosticsSync` + `suggestionDiagnosticsSync` to fetch type errors, warnings, and suggestions.

There is no regex, no custom path resolution, no heuristics. The TypeScript compiler does all the work.

## Quick Start

### Install

```bash
npx ts-mcp-server
```

### Configure Your MCP Client

Add `ts-mcp-server` to your client's MCP configuration.

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "ts-mcp-server": {
      "command": "npx",
      "args": ["ts-mcp-server"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ts-mcp-server": {
      "command": "npx",
      "args": ["ts-mcp-server"]
    }
  }
}
```

**Cursor, Windsurf, Continue** — follow each client's MCP server documentation using the same `npx ts-mcp-server` command.

## Tool Reference

### `rename_symbol`

Rename a TypeScript/JavaScript symbol and update all references across the project.

| Parameter | Type      | Required | Description                                                                                   |
| --------- | --------- | -------- | --------------------------------------------------------------------------------------------- |
| `file`    | `string`  | ✅       | File path containing the symbol (absolute or relative to cwd)                                 |
| `line`    | `number`  | ✅       | 1-based line number where the symbol appears                                                  |
| `offset`  | `number`  | ✅       | 1-based character offset on the line                                                          |
| `newName` | `string`  | ✅       | New name for the symbol                                                                       |
| `preview` | `boolean` | —        | If `true`, returns a summary of what would change without applying anything. Default: `false` |

**Examples:**

```
# Rename a function
rename_symbol  file="src/utils/helpers.ts"  line=5  offset=17  newName="formatCurrency"

# Rename a React component
rename_symbol  file="src/components/Button.tsx"  line=10  offset=17  newName="PrimaryButton"

# Rename an interface
rename_symbol  file="src/types.ts"  line=3  offset=11  newName="UserProfile"

# Preview changes without applying
rename_symbol  file="src/utils/helpers.ts"  line=5  offset=17  newName="formatCurrency"  preview=true
```

### `rename_file_or_dir`

Rename or move a TypeScript/JavaScript file or folder and update all import paths across the project.

| Parameter | Type      | Required | Description                                                                                   |
| --------- | --------- | -------- | --------------------------------------------------------------------------------------------- |
| `from`    | `string`  | ✅       | Current file or folder path (absolute or relative to cwd)                                     |
| `to`      | `string`  | ✅       | New file or folder path (absolute or relative to cwd)                                         |
| `preview` | `boolean` | —        | If `true`, returns a summary of what would change without applying anything. Default: `false` |

**Examples:**

```
# Rename a file
rename_file_or_dir  from="src/utils/helpers.ts"  to="src/utils/string-helpers.ts"

# Move a file to a different directory
rename_file_or_dir  from="src/Button.tsx"  to="src/components/ui/Button.tsx"

# Rename a folder
rename_file_or_dir  from="src/components/primitives"  to="src/components/ui"

# Preview changes without applying
rename_file_or_dir  from="src/old-name.ts"  to="src/new-name.ts"  preview=true
```

### `find_all_references`

Find all usages of a symbol across the project. Returns references grouped by file with line text for context.

| Parameter | Type     | Required | Description                                  |
| --------- | -------- | -------- | -------------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd)      |
| `line`    | `number` | ✅       | 1-based line number where the symbol appears |
| `offset`  | `number` | ✅       | 1-based character offset on the line         |

**Examples:**

```
# Find all usages of a function
find_all_references  file="src/utils/helpers.ts"  line=5  offset=17

# Find all usages of a type
find_all_references  file="src/types.ts"  line=3  offset=11

# Find all usages of a React component
find_all_references  file="src/components/Button.tsx"  line=10  offset=17
```

### `get_diagnostics`

Get all errors, warnings, and suggestions for a TypeScript/JavaScript file. Reports type errors, unused variables, unused imports, unreachable code, and more.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |

**Examples:**

```
# Get diagnostics for a file
get_diagnostics  file="src/utils/helpers.ts"

# Check a component for errors
get_diagnostics  file="src/components/Button.tsx"
```

**Note:** Unused-code diagnostics (unused variables, unused imports) only appear if your `tsconfig.json` has `noUnusedLocals` and/or `noUnusedParameters` enabled.

## Supported Languages & Frameworks

`ts-mcp-server` works with any project that TypeScript's language service understands:

- **TypeScript** (`.ts`, `.tsx`, `.mts`, `.cts`)
- **JavaScript** (`.js`, `.jsx`, `.mjs`, `.cjs`)
- **React** / **Next.js** / **Remix** / **Astro**
- **Vue** (script blocks)
- **Node.js** / **Express** / **Fastify** / **NestJS**
- **Angular**
- **Svelte** (script blocks)
- **Electron**
- **React Native**
- **Monorepos** (Turborepo, Nx, Lerna, pnpm workspaces)

If your project has a `tsconfig.json` (or `jsconfig.json`), it works.

## System Requirements

| Requirement    | Version                                       |
| -------------- | --------------------------------------------- |
| **Node.js**    | 22 or later (current LTS)                     |
| **TypeScript** | 5.x (installed automatically as a dependency) |
| **OS**         | Windows, macOS, Linux                         |

No additional dependencies or global tools are required. The server bundles everything it needs.

## FAQ

**Does it work without a `tsconfig.json`?**
Yes. TypeScript will create an inferred project, but explicit configuration gives better results.

**Does it update `package.json` or non-code files?**
No. It updates TypeScript/JavaScript import and export statements, and path-related entries in `tsconfig.json` (`files`, `include`, `exclude`, `paths`).

**Can I use it with JavaScript-only projects?**
Yes. Add a `jsconfig.json` (which is equivalent to `tsconfig.json` with `allowJs: true`) and the server will discover your project.

**Does it work with path aliases (`@/components/...`)?**
Yes. `tsserver` resolves path aliases defined in `tsconfig.json`'s `paths` and `baseUrl` settings.
