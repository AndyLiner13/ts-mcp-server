# ts-mcp-server

[![npm version](https://img.shields.io/npm/v/ts-mcp-server)](https://www.npmjs.com/package/ts-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/ts-mcp-server)](https://www.npmjs.com/package/ts-mcp-server)
[![license](https://img.shields.io/npm/l/ts-mcp-server)](./LICENSE)

A lightweight [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for **TypeScript and JavaScript refactoring and code intelligence**. Every tool maps directly to a `tsserver` protocol command — the output is the raw, unmodified response from TypeScript's compiler. Rename symbols, extract functions, move declarations between files, reorganize imports, navigate type hierarchies, explore call graphs, search symbols across your workspace, and more — with every `import`, `require`, re-export, and reference updated automatically across your entire codebase.

## Why

AI coding assistants can read and write code, but they struggle with **structural changes** that ripple across many files. Renaming a function, extracting a helper, moving a React component, or reorganizing a folder means updating every reference and import that touches it. Miss one and the build breaks.

`ts-mcp-server` gives any MCP-compatible client — [VS Code Copilot](https://code.visualstudio.com/), [Claude Desktop](https://claude.ai/), [Cursor](https://cursor.sh/), [Windsurf](https://codeium.com/windsurf), [Continue](https://continue.dev/), and others — the ability to perform these refactors **correctly and completely**, using TypeScript's own compiler infrastructure.

## Features

- **28 tools** — each a 1:1 mapping to a native `tsserver` protocol command

### Refactoring (12 tools)

- **Rename symbols** — variables, functions, classes, types, properties, interfaces, enums — all references updated across every file
- **Rename / move files and folders** — all import paths updated automatically
- **Extract function** — extract a code range into a new function with auto-detected parameters and return type
- **Extract constant** — extract an expression into a named constant with inferred type
- **Extract type** — extract an inline type annotation into a named type alias
- **Infer return type** — add an explicit return type annotation to a function, inferred by TypeScript
- **Move symbol** — move top-level declarations to another file, all imports rewired automatically
- **Inline variable** — replace all references with the variable's initializer and delete the declaration
- **Organize imports** — sort, coalesce, and remove unused imports
- **Get code fixes** — retrieve available auto-fixes for specific diagnostics (missing imports, type mismatches, etc.)
- **Get diagnostics** — retrieve type errors, warnings, and suggestions for any file
- **Find all references** — locate every usage of a symbol across the project

### Code Intelligence (16 tools)

- **Quick info** — full type information, documentation, and JSDoc tags for any symbol (hover info)
- **Navigation tree** — complete hierarchical structure of a file (all declarations and their nesting)
- **Go to definition** — jump to where a symbol is declared
- **Go to type definition** — jump to the type's definition, not the variable's declaration
- **Go to implementation** — find concrete implementations of an interface or abstract class
- **Navigate to symbol** — workspace-wide symbol search by name
- **File references** — find every file that imports a given file (reverse dependency graph)
- **Prepare call hierarchy** — get call hierarchy entry point for a function/method
- **Incoming calls** — find all callers of a function ("who calls this?")
- **Outgoing calls** — find all callees of a function ("what does this call?")
- **Project info** — get tsconfig.json path, file list, and language service status
- **Completion info** — autocomplete suggestions at a position
- **Completion entry details** — full documentation and type signature for a completion item
- **Signature help** — function parameter info and overloads at a call site
- **Document highlights** — all occurrences of a symbol within a file, with read/write distinction
- **Get applicable refactors** — discover what refactorings are available at a position or selection

### Design Principles

- **Pure tsserver output** — every tool returns the raw, unmodified `tsserver` response as JSON
- **Preview mode** — see exactly what would change before applying anything
- **Automatic project discovery** — `tsconfig.json` is detected automatically; no configuration needed
- **Multi-project support** — monorepos, project references, and composite builds work out of the box
- **Cross-platform** — Windows, macOS, and Linux

## How It Works

Under the hood, `ts-mcp-server` communicates with TypeScript's `tsserver` over Node IPC — the same protocol that VS Code uses. Every tool is a thin wrapper that:

1. Passes your input directly to a `tsserver` protocol command
2. Returns the raw response — no formatting, no grouping, no filtering

**Refactoring tools:**

| Tool                  | tsserver command(s)                                     |
| --------------------- | ------------------------------------------------------- |
| `rename_symbol`       | `rename-full` → `renameLocations-full`                  |
| `rename_file_or_dir`  | `getEditsForFileRename-full`                            |
| `find_all_references` | `references`                                            |
| `get_diagnostics`     | `semanticDiagnosticsSync` + `suggestionDiagnosticsSync` |
| `organize_imports`    | `organizeImports-full`                                  |
| `get_code_fixes`      | `getCodeFixes`                                          |
| `extract_function`    | `getEditsForRefactor-full`                              |
| `extract_constant`    | `getEditsForRefactor-full`                              |
| `extract_type`        | `getEditsForRefactor-full`                              |
| `infer_return_type`   | `getEditsForRefactor-full`                              |
| `move_symbol`         | `getEditsForRefactor-full`                              |
| `inline_variable`     | `getEditsForRefactor-full`                              |

**Code intelligence tools:**

| Tool                                | tsserver command                    |
| ----------------------------------- | ----------------------------------- |
| `quickinfo`                         | `quickinfo`                         |
| `navtree`                           | `navtree`                           |
| `definition`                        | `definition`                        |
| `typeDefinition`                    | `typeDefinition`                    |
| `implementation`                    | `implementation`                    |
| `navto`                             | `navto`                             |
| `fileReferences`                    | `fileReferences`                    |
| `prepareCallHierarchy`              | `prepareCallHierarchy`              |
| `provideCallHierarchyIncomingCalls` | `provideCallHierarchyIncomingCalls` |
| `provideCallHierarchyOutgoingCalls` | `provideCallHierarchyOutgoingCalls` |
| `projectInfo`                       | `projectInfo`                       |
| `completion_info`                   | `completionInfo`                    |
| `completion_entry_details`          | `completionEntryDetails`            |
| `signature_help`                    | `signatureHelp`                     |
| `document_highlights`               | `documentHighlights`                |
| `get_applicable_refactors`          | `getApplicableRefactors`            |

There is no regex, no custom path resolution, no heuristics, no output formatting. The TypeScript compiler does all the work.

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

| Parameter | Type      | Required | Description                                                   |
| --------- | --------- | -------- | ------------------------------------------------------------- |
| `file`    | `string`  | ✅       | File path containing the symbol (absolute or relative to cwd) |
| `line`    | `number`  | ✅       | 1-based line number where the symbol appears                  |
| `offset`  | `number`  | ✅       | 1-based character offset on the line                          |
| `newName` | `string`  | ✅       | New name for the symbol                                       |
| `preview` | `boolean` | —        | If `true`, return changes without applying. Default: `false`  |

**Examples:**

```
rename_symbol  file="src/utils/helpers.ts"  line=5  offset=17  newName="formatCurrency"
rename_symbol  file="src/components/Button.tsx"  line=10  offset=17  newName="PrimaryButton"
rename_symbol  file="src/types.ts"  line=3  offset=11  newName="UserProfile"
rename_symbol  file="src/utils/helpers.ts"  line=5  offset=17  newName="formatCurrency"  preview=true
```

---

### `rename_file_or_dir`

Rename or move a TypeScript/JavaScript file or folder and update all import paths across the project.

| Parameter | Type      | Required | Description                                                  |
| --------- | --------- | -------- | ------------------------------------------------------------ |
| `from`    | `string`  | ✅       | Current file or folder path (absolute or relative to cwd)    |
| `to`      | `string`  | ✅       | New file or folder path (absolute or relative to cwd)        |
| `preview` | `boolean` | —        | If `true`, return changes without applying. Default: `false` |

**Examples:**

```
rename_file_or_dir  from="src/utils/helpers.ts"  to="src/utils/string-helpers.ts"
rename_file_or_dir  from="src/Button.tsx"  to="src/components/ui/Button.tsx"
rename_file_or_dir  from="src/components/primitives"  to="src/components/ui"
rename_file_or_dir  from="src/old-name.ts"  to="src/new-name.ts"  preview=true
```

---

### `find_all_references`

Find all usages of a symbol across the project.

| Parameter | Type     | Required | Description                                  |
| --------- | -------- | -------- | -------------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd)      |
| `line`    | `number` | ✅       | 1-based line number where the symbol appears |
| `offset`  | `number` | ✅       | 1-based character offset on the line         |

**Examples:**

```
find_all_references  file="src/utils/helpers.ts"  line=5  offset=17
find_all_references  file="src/types.ts"  line=3  offset=11
```

---

### `get_diagnostics`

Get all errors, warnings, and suggestions for a file. Returns semantic diagnostics and suggestion diagnostics as separate arrays.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |

**Examples:**

```
get_diagnostics  file="src/utils/helpers.ts"
get_diagnostics  file="src/components/Button.tsx"
```

> **Note:** Unused-code diagnostics (unused variables, unused imports) only appear if your `tsconfig.json` has `noUnusedLocals` and/or `noUnusedParameters` enabled.

---

### `organize_imports`

Sort, coalesce, and remove unused imports in a file.

| Parameter | Type      | Required | Description                                                  |
| --------- | --------- | -------- | ------------------------------------------------------------ |
| `file`    | `string`  | ✅       | File path (absolute or relative to cwd)                      |
| `preview` | `boolean` | —        | If `true`, return changes without applying. Default: `false` |

**Examples:**

```
organize_imports  file="src/utils/helpers.ts"
organize_imports  file="src/components/Button.tsx"  preview=true
```

---

### `get_code_fixes`

Get available code fixes for specific error codes at a range in a file. Use `get_diagnostics` first to discover error codes and ranges, then pass them here.

| Parameter     | Type       | Required | Description                                |
| ------------- | ---------- | -------- | ------------------------------------------ |
| `file`        | `string`   | ✅       | File path (absolute or relative to cwd)    |
| `startLine`   | `number`   | ✅       | 1-based start line of the diagnostic range |
| `startOffset` | `number`   | ✅       | 1-based start character offset             |
| `endLine`     | `number`   | ✅       | 1-based end line of the diagnostic range   |
| `endOffset`   | `number`   | ✅       | 1-based end character offset               |
| `errorCodes`  | `number[]` | ✅       | Diagnostic error codes to get fixes for    |

**Examples:**

```
# Get fixes for a "Cannot find name" error (code 2304) at line 10
get_code_fixes  file="src/app.ts"  startLine=10  startOffset=1  endLine=10  endOffset=20  errorCodes=[2304]

# Get fixes for multiple error codes
get_code_fixes  file="src/app.ts"  startLine=5  startOffset=1  endLine=5  endOffset=30  errorCodes=[2304, 2552]
```

---

### `extract_function`

Extract a selected code range into a new function. TypeScript auto-detects parameters and return type. The response includes `renameFilename` / `renameLocation` so you can follow up with `rename_symbol` to give the function a meaningful name.

| Parameter     | Type      | Required | Description                                                  |
| ------------- | --------- | -------- | ------------------------------------------------------------ |
| `file`        | `string`  | ✅       | File path (absolute or relative to cwd)                      |
| `startLine`   | `number`  | ✅       | 1-based start line of the selection                          |
| `startOffset` | `number`  | ✅       | 1-based start character offset                               |
| `endLine`     | `number`  | ✅       | 1-based end line of the selection                            |
| `endOffset`   | `number`  | ✅       | 1-based end character offset                                 |
| `preview`     | `boolean` | —        | If `true`, return changes without applying. Default: `false` |

**Examples:**

```
# Extract lines 10-15 into a function
extract_function  file="src/app.ts"  startLine=10  startOffset=1  endLine=15  endOffset=1

# Preview the extraction
extract_function  file="src/app.ts"  startLine=10  startOffset=1  endLine=15  endOffset=1  preview=true
```

---

### `extract_constant`

Extract a selected expression into a named constant. TypeScript infers the type. The response includes `renameFilename` / `renameLocation` so you can follow up with `rename_symbol` to give the constant a meaningful name.

| Parameter     | Type      | Required | Description                                                  |
| ------------- | --------- | -------- | ------------------------------------------------------------ |
| `file`        | `string`  | ✅       | File path (absolute or relative to cwd)                      |
| `startLine`   | `number`  | ✅       | 1-based start line of the expression                         |
| `startOffset` | `number`  | ✅       | 1-based start character offset                               |
| `endLine`     | `number`  | ✅       | 1-based end line of the expression                           |
| `endOffset`   | `number`  | ✅       | 1-based end character offset                                 |
| `preview`     | `boolean` | —        | If `true`, return changes without applying. Default: `false` |

**Examples:**

```
# Extract an expression into a constant
extract_constant  file="src/app.ts"  startLine=8  startOffset=12  endLine=8  endOffset=35

# Preview the extraction
extract_constant  file="src/app.ts"  startLine=8  startOffset=12  endLine=8  endOffset=35  preview=true
```

---

### `move_symbol`

Move top-level declarations (functions, classes, types, constants) to another file. All imports across the project are rewired automatically. If the target file doesn't exist, tsserver creates it.

| Parameter     | Type      | Required | Description                                                  |
| ------------- | --------- | -------- | ------------------------------------------------------------ |
| `file`        | `string`  | ✅       | Source file path (absolute or relative to cwd)               |
| `startLine`   | `number`  | ✅       | 1-based start line of the declaration                        |
| `startOffset` | `number`  | ✅       | 1-based start character offset                               |
| `endLine`     | `number`  | ✅       | 1-based end line of the declaration                          |
| `endOffset`   | `number`  | ✅       | 1-based end character offset                                 |
| `targetFile`  | `string`  | ✅       | Destination file path (absolute or relative to cwd)          |
| `preview`     | `boolean` | —        | If `true`, return changes without applying. Default: `false` |

**Examples:**

```
# Move a function to a utility file
move_symbol  file="src/app.ts"  startLine=20  startOffset=1  endLine=35  endOffset=2  targetFile="src/utils/helpers.ts"

# Move a type to a shared types file
move_symbol  file="src/components/Button.tsx"  startLine=1  startOffset=1  endLine=5  endOffset=2  targetFile="src/types.ts"

# Preview the move
move_symbol  file="src/app.ts"  startLine=20  startOffset=1  endLine=35  endOffset=2  targetFile="src/utils/helpers.ts"  preview=true
```

---

### `inline_variable`

Inline a variable — replace all references with the variable's initializer and delete the declaration. Position must be on the variable name in its declaration or any usage.

| Parameter | Type      | Required | Description                                                  |
| --------- | --------- | -------- | ------------------------------------------------------------ |
| `file`    | `string`  | ✅       | File path (absolute or relative to cwd)                      |
| `line`    | `number`  | ✅       | 1-based line number of the variable                          |
| `offset`  | `number`  | ✅       | 1-based character offset on the line                         |
| `preview` | `boolean` | —        | If `true`, return changes without applying. Default: `false` |

**Examples:**

```
# Inline a variable
inline_variable  file="src/app.ts"  line=12  offset=7

# Preview the inlining
inline_variable  file="src/app.ts"  line=12  offset=7  preview=true
```

---

### `extract_type`

Extract an inline type annotation into a named type alias. Select the type span to extract. The response includes `renameFilename` / `renameLocation` so you can follow up with `rename_symbol` to give the type a meaningful name.

| Parameter     | Type      | Required | Description                                                  |
| ------------- | --------- | -------- | ------------------------------------------------------------ |
| `file`        | `string`  | ✅       | File path (absolute or relative to cwd)                      |
| `startLine`   | `number`  | ✅       | 1-based start line of the type span                          |
| `startOffset` | `number`  | ✅       | 1-based start character offset                               |
| `endLine`     | `number`  | ✅       | 1-based end line of the type span                            |
| `endOffset`   | `number`  | ✅       | 1-based end character offset                                 |
| `preview`     | `boolean` | —        | If `true`, return changes without applying. Default: `false` |

**Examples:**

```
# Extract an inline object type into a type alias
# Given: function process(user: { id: number; name: string }) { ... }
# Select the span "{ id: number; name: string }"
extract_type  file="src/app.ts"  startLine=5  startOffset=26  endLine=5  endOffset=56

# Preview the extraction
extract_type  file="src/app.ts"  startLine=5  startOffset=26  endLine=5  endOffset=56  preview=true
```

---

### `infer_return_type`

Add an explicit return type annotation to a function, inferred by TypeScript. Position must be on the function name or declaration keyword (`function`, `async`, arrow function variable name).

| Parameter | Type      | Required | Description                                                  |
| --------- | --------- | -------- | ------------------------------------------------------------ |
| `file`    | `string`  | ✅       | File path (absolute or relative to cwd)                      |
| `line`    | `number`  | ✅       | 1-based line number of the function                          |
| `offset`  | `number`  | ✅       | 1-based character offset on the line                         |
| `preview` | `boolean` | —        | If `true`, return changes without applying. Default: `false` |

**Examples:**

```
# Add return type to a function that currently has none
# Given: function greet(name: string) { return `Hello, ${name}!`; }
# After: function greet(name: string): string { return `Hello, ${name}!`; }
infer_return_type  file="src/app.ts"  line=10  offset=10

# Preview the change
infer_return_type  file="src/app.ts"  line=10  offset=10  preview=true
```

### `quickinfo`

Get the full type information, documentation, and JSDoc tags for the symbol at a given position. This is the "hover" info.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |
| `line`    | `number` | ✅       | 1-based line number                     |
| `offset`  | `number` | ✅       | 1-based character offset on the line    |

**Examples:**

```
quickinfo  file="src/utils/helpers.ts"  line=5  offset=17
quickinfo  file="src/types.ts"  line=3  offset=11
```

---

### `navtree`

Get the complete hierarchical structure of a file — all classes, functions, variables, interfaces, type aliases, enums, and their nesting.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |

**Examples:**

```
navtree  file="src/utils/helpers.ts"
navtree  file="src/components/Button.tsx"
```

---

### `definition`

Go to the definition of a symbol. Returns the file location(s) where the symbol is declared.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |
| `line`    | `number` | ✅       | 1-based line number                     |
| `offset`  | `number` | ✅       | 1-based character offset on the line    |

**Examples:**

```
definition  file="src/app.ts"  line=10  offset=5
definition  file="src/components/Button.tsx"  line=3  offset=15
```

---

### `typeDefinition`

Navigate to the type's definition, not the variable's declaration. Given `const user: UserProfile = ...`, `definition` goes to the variable, but `typeDefinition` goes to the `UserProfile` interface.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |
| `line`    | `number` | ✅       | 1-based line number                     |
| `offset`  | `number` | ✅       | 1-based character offset on the line    |

**Examples:**

```
typeDefinition  file="src/app.ts"  line=10  offset=12
typeDefinition  file="src/services/api.ts"  line=5  offset=8
```

---

### `implementation`

Find concrete implementations of an interface or abstract class. Given an interface `Serializable`, returns every class that implements it.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |
| `line`    | `number` | ✅       | 1-based line number                     |
| `offset`  | `number` | ✅       | 1-based character offset on the line    |

**Examples:**

```
implementation  file="src/types.ts"  line=1  offset=18
implementation  file="src/interfaces/repository.ts"  line=3  offset=18
```

---

### `navto`

Workspace-wide symbol search by name. Takes a search string and returns matching symbols across all project files with their locations and kinds.

| Parameter         | Type      | Required | Description                                                     |
| ----------------- | --------- | -------- | --------------------------------------------------------------- |
| `searchValue`     | `string`  | ✅       | Symbol name or prefix to search for                             |
| `file`            | `string`  | —        | Optional file for project context (absolute or relative to cwd) |
| `maxResultCount`  | `number`  | —        | Maximum number of results to return                             |
| `currentFileOnly` | `boolean` | —        | If `true`, only search the specified file                       |

**Examples:**

```
navto  searchValue="User"  file="src/app.ts"
navto  searchValue="handle"  file="src/app.ts"  maxResultCount=10
navto  searchValue="Button"  file="src/components/Button.tsx"  currentFileOnly=true
```

---

### `fileReferences`

Find every file that imports or references a given file. The reverse dependency graph for a single file.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |

**Examples:**

```
fileReferences  file="src/utils/helpers.ts"
fileReferences  file="src/types.ts"
```

---

### `prepareCallHierarchy`

Get the call hierarchy item(s) at a position — the entry point for call hierarchy queries. Returns the function/method name, kind, file location, and spans.

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |
| `line`    | `number` | ✅       | 1-based line number                     |
| `offset`  | `number` | ✅       | 1-based character offset on the line    |

**Examples:**

```
prepareCallHierarchy  file="src/services/api.ts"  line=10  offset=17
prepareCallHierarchy  file="src/utils/helpers.ts"  line=5  offset=17
```

---

### `provideCallHierarchyIncomingCalls`

Find all functions/methods that call the function at the given position. Answers "who calls this?"

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |
| `line`    | `number` | ✅       | 1-based line number                     |
| `offset`  | `number` | ✅       | 1-based character offset on the line    |

**Examples:**

```
provideCallHierarchyIncomingCalls  file="src/services/api.ts"  line=10  offset=17
provideCallHierarchyIncomingCalls  file="src/utils/helpers.ts"  line=5  offset=17
```

---

### `provideCallHierarchyOutgoingCalls`

Find all functions/methods that the function at the given position calls. Answers "what does this call?"

| Parameter | Type     | Required | Description                             |
| --------- | -------- | -------- | --------------------------------------- |
| `file`    | `string` | ✅       | File path (absolute or relative to cwd) |
| `line`    | `number` | ✅       | 1-based line number                     |
| `offset`  | `number` | ✅       | 1-based character offset on the line    |

**Examples:**

```
provideCallHierarchyOutgoingCalls  file="src/services/api.ts"  line=10  offset=17
provideCallHierarchyOutgoingCalls  file="src/utils/helpers.ts"  line=5  offset=17
```

---

### `projectInfo`

Get the tsconfig.json path, the full list of files in the project, and whether the language service is active.

| Parameter          | Type      | Required | Description                                                               |
| ------------------ | --------- | -------- | ------------------------------------------------------------------------- |
| `file`             | `string`  | ✅       | File path (absolute or relative to cwd)                                   |
| `needFileNameList` | `boolean` | —        | If `true`, include the list of all files in the project (default: `true`) |

**Examples:**

```
projectInfo  file="src/app.ts"
projectInfo  file="src/app.ts"  needFileNameList=false
```

---

### `completion_info`

Get autocomplete suggestions at a position. Returns all possible completions with their kinds, sort text, and insert text. Useful for understanding what symbols, methods, or properties are available at a location.

| Parameter          | Type     | Required | Description                                                                                 |
| ------------------ | -------- | -------- | ------------------------------------------------------------------------------------------- |
| `file`             | `string` | ✅       | File path (absolute or relative to cwd)                                                     |
| `line`             | `number` | ✅       | 1-based line number                                                                         |
| `offset`           | `number` | ✅       | 1-based character offset on the line                                                        |
| `prefix`           | `string` | —        | Optional prefix to filter completions                                                       |
| `triggerCharacter` | `string` | —        | Character that triggered completion (e.g., `.`, `"`, `'`, `` ` ``, `/`, `@`, `<`, `#`, ` `) |

**Examples:**

```
completion_info  file="src/app.ts"  line=10  offset=15
completion_info  file="src/app.ts"  line=10  offset=15  prefix="get"
completion_info  file="src/app.ts"  line=10  offset=15  triggerCharacter="."
```

---

### `completion_entry_details`

Get full details for specific completion entries — documentation, full type signature, JSDoc tags, and code actions (like auto-imports). Use as a follow-up to `completion_info`.

| Parameter    | Type       | Required | Description                                    |
| ------------ | ---------- | -------- | ---------------------------------------------- |
| `file`       | `string`   | ✅       | File path (absolute or relative to cwd)        |
| `line`       | `number`   | ✅       | 1-based line number                            |
| `offset`     | `number`   | ✅       | 1-based character offset on the line           |
| `entryNames` | `string[]` | ✅       | Names of completion entries to get details for |

**Examples:**

```
completion_entry_details  file="src/app.ts"  line=10  offset=15  entryNames=["map","filter"]
completion_entry_details  file="src/app.ts"  line=5  offset=10  entryNames=["useState"]
```

---

### `signature_help`

Get function/method signature information at a call site. Returns parameter names, types, and documentation for each overload. Use when the cursor is inside function call parentheses.

| Parameter       | Type     | Required | Description                                                                                   |
| --------------- | -------- | -------- | --------------------------------------------------------------------------------------------- |
| `file`          | `string` | ✅       | File path (absolute or relative to cwd)                                                       |
| `line`          | `number` | ✅       | 1-based line number                                                                           |
| `offset`        | `number` | ✅       | 1-based character offset (inside the function call parentheses)                               |
| `triggerReason` | `object` | —        | Optional: `{ kind: "invoked" \| "retrigger" \| "characterTyped", triggerCharacter?: string }` |

**Examples:**

```
signature_help  file="src/app.ts"  line=12  offset=20
signature_help  file="src/app.ts"  line=12  offset=20  triggerReason={"kind":"invoked"}
```

---

### `document_highlights`

Find all occurrences of a symbol within a file (or set of files). Distinguishes between read and write references. More efficient than `find_all_references` when you only need local occurrences.

| Parameter       | Type       | Required | Description                             |
| --------------- | ---------- | -------- | --------------------------------------- |
| `file`          | `string`   | ✅       | File path (absolute or relative to cwd) |
| `line`          | `number`   | ✅       | 1-based line number                     |
| `offset`        | `number`   | ✅       | 1-based character offset on the line    |
| `filesToSearch` | `string[]` | —        | Optional: limit search to these files   |

**Examples:**

```
document_highlights  file="src/app.ts"  line=10  offset=5
document_highlights  file="src/app.ts"  line=10  offset=5  filesToSearch=["src/app.ts","src/utils.ts"]
```

---

### `get_applicable_refactors`

Discover what refactorings are available at a position or selection. Use before attempting a refactor to see what's possible. Returns a list of available refactors with their action names and descriptions.

| Parameter       | Type     | Required | Description                             |
| --------------- | -------- | -------- | --------------------------------------- |
| `file`          | `string` | ✅       | File path (absolute or relative to cwd) |
| `startLine`     | `number` | ✅       | 1-based start line of the selection     |
| `startOffset`   | `number` | ✅       | 1-based start character offset          |
| `endLine`       | `number` | ✅       | 1-based end line of the selection       |
| `endOffset`     | `number` | ✅       | 1-based end character offset            |
| `triggerReason` | `string` | —        | `"invoked"` or `"implicit"`             |

**Examples:**

```
get_applicable_refactors  file="src/app.ts"  startLine=10  startOffset=1  endLine=15  endOffset=1
get_applicable_refactors  file="src/app.ts"  startLine=8  startOffset=12  endLine=8  endOffset=35
```

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

**Is the output modified or formatted?**
No. Every tool returns the raw, unmodified `tsserver` response serialized as JSON. Nothing is truncated, simplified, grouped, or filtered.
