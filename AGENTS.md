# ts-mcp-server Codebase Instructions

## Philosophy

This is a **pure** MCP server that wraps TypeScript's `tsserver` protocol. The core principles are:

### 1. Zero Custom Logic

- **No custom types** — All types are imported directly from `typescript` (`ts.server.protocol.*`)
- **No wrappers** — User input is passed directly to tsserver commands with no transformation
- **No heuristics** — No regex, path resolution tricks, or "smart" behavior
- **No output formatting** — Raw tsserver responses are returned as-is, serialized to JSON

### 2. One Tool Per tsserver Command

- Each tool maps 1:1 to a single `tsserver` protocol command
- Tool names **must match the exact `CommandTypes` string value** from the tsserver protocol (e.g., `references`, `completionInfo`, `getCodeFixes`)
- Never combine multiple tsserver commands into a single "convenience" tool

### 3. Raw Output

Every tool returns the **exact** response from tsserver:

```typescript
return {
  content: [{ type: "text", text: JSON.stringify(body) }],
};
```

**Never:**

- Filter, group, sort, or truncate the response
- Add custom fields or metadata
- Format or pretty-print beyond `JSON.stringify`
- Trim whitespace or normalize paths

### 4. Minimal Shared Infrastructure

The only shared code is in `tsserver.ts`:

- `send<T, A>()` — Send a command to tsserver and await the response
- `open(file)` — Open a file in tsserver's project
- `writeEdits(edits)` — Apply file edits to disk and reload
- `applyRefactor(opts, preview)` — Shared helper for refactor tools only

## Tool Definitions (MCP Best Practices)

Follow the [Model Context Protocol specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) and [MCP tool best practices](https://modelcontextprotocol.io/legacy/concepts/tools#best-practices) for all tool definitions.

### Tool Name (`name`)

- Unique identifier for the tool
- Naming rules depend on whether the tool is **read-only** or an **edit tool**

#### Read-Only Tools

For tools that only query/read (no `preview` parameter, `readOnlyHint: true`):

- **Must match the exact `CommandTypes` string value** from `ts.server.protocol.CommandTypes` (camelCase, as defined in `typescript.d.ts`)
- Examples: `references`, `completionInfo`, `getCodeFixes`, `quickinfo`, `navtree`, `definition`

#### Edit Tools (Tools That Apply Changes)

Edit tools have a `preview` parameter and can modify files. These tools require special naming:

1. **Search `reference/TypeScript/src/`** for an internal TypeScript API function that performs the same action
2. **If found**: Use that exact function name (e.g., `renameFileOrDirectory` from `harnessLanguageService.ts`)
3. **If NOT found**: **STOP and ask the user** what name to use — never guess or invent names

**Why this rule exists:** Edit tools should be named after the action they perform, not the tsserver command they wrap. The tsserver command `getEditsForFileRename` returns edits, but our tool _applies_ those edits — it renames files/directories. The internal TypeScript API already has a name for this action: `renameFileOrDirectory`.

**Process for naming edit tools:**

```bash
# Search the TypeScript source for matching API names:
grep -r "functionName" reference/TypeScript/src/
```

Look in:

- `reference/TypeScript/src/harness/` — test harness APIs
- `reference/TypeScript/src/services/` — language service APIs
- `reference/TypeScript/src/server/` — tsserver session APIs

**Examples:**

| tsserver command        | Internal TypeScript API       | Tool name                                  |
| ----------------------- | ----------------------------- | ------------------------------------------ |
| `getEditsForFileRename` | `renameFileOrDirectory`       | `renameFileOrDirectory`                    |
| `rename`                | `rename` (CommandTypes)       | `rename`                                   |
| `getEditsForRefactor`   | (action-specific)             | `extractFunction`, `extractConstant`, etc. |
| `organizeImports`       | `organizeImports` (1:1 match) | `organizeImports`                          |

**⚠️ CRITICAL:** If you cannot find a clear 1:1 mapping between the tool's action and an internal TypeScript API, **do not proceed**. Ask the user: _"I cannot find an internal TypeScript API that matches the action this tool performs. What should the tool be named?"_

### Tool Title (`title`)

- Human-readable display name
- Short, descriptive, title-cased (e.g., `"Go to Definition"`, `"Extract Function"`)
- Per MCP spec: _"Optional human-readable name of the tool for display purposes"_

### Tool Description (`description`)

Write descriptions **for LLMs**, not for protocol developers. The MCP spec says descriptions are _"Human-readable description of functionality"_ — but since tools are **model-controlled** (the LLM decides when to invoke them), the description must help the model understand:

1. **What the tool does** — Lead with a clear, concise statement of the tool's purpose
2. **When to use it** — Include context that helps the model choose the right tool (e.g., "The fundamental 'where is this thing declared?' query")
3. **What it returns** — Describe the shape of the output so the model knows what to expect
4. **Follow-up hints** — If the tool's output is commonly used as input to another tool, mention it (e.g., "The response includes renameFilename/renameLocation so you can follow up with the `rename` tool")

**Do NOT** copy tsserver TSDoc comments verbatim. They describe protocol mechanics ("value of command field is 'quickinfo'") rather than user/model intent. Write descriptions that are clear, action-oriented, and specific to the tool's purpose.

MCP best practice #3 says: _"Include examples in tool descriptions to demonstrate how the model should use them."_ Use this when the tool's usage pattern is non-obvious.

**Examples of good descriptions:**

```
"Get type information, documentation, and JSDoc tags for a symbol at a position.
 Returns the hover info — kind, display string (full type signature), documentation,
 and tags."

"Rename a TypeScript/JavaScript symbol (variable, function, class, type, property, etc.)
 and update all references across the project. Provide the file path and the 1-based
 line/offset of any occurrence of the symbol."

"Returns the file location(s) where a symbol is defined. The fundamental 'where is
 this thing declared?' query."
```

### Input Schema (`inputSchema`)

- Use `zod` to define schemas that match tsserver's `*RequestArgs` interfaces
- Every parameter gets a `.describe()` with a clear, concise description
- Use `.int().positive()` for line/offset numbers
- Use `.optional().default(false)` for preview flags

### Annotations

Per the [MCP annotation specification](https://modelcontextprotocol.io/legacy/concepts/tools#available-tool-annotations):

| Annotation              | When to use                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `readOnlyHint: true`    | Tools that only read/query (all code intelligence tools)                                      |
| `destructiveHint: true` | Tools that modify files (refactoring tools in non-preview mode)                               |
| `idempotentHint: true`  | Tools where repeated calls with same args have no additional effect (e.g., `organizeImports`) |
| `openWorldHint: false`  | All tools in this server (tsserver operates on local files only)                              |

MCP best practice: _"Be accurate about side effects: Clearly indicate whether a tool modifies its environment and whether those modifications are destructive."_

### Error Handling

Per the [MCP error handling spec](https://modelcontextprotocol.io/legacy/concepts/tools#error-handling-2): _"Tool errors should be reported within the result object, not as MCP protocol-level errors. This allows the LLM to see and potentially handle the error."_

Always return errors as tool results with `isError: true`:

```typescript
catch (err: unknown) {
  return {
    isError: true,
    content: [
      { type: "text", text: err instanceof Error ? err.message : String(err) },
    ],
  };
}
```

## Project Structure

```
ts-mcp-server/
├── index.ts          # Entry point, imports and registers all tools
├── tsserver.ts       # Shared tsserver IPC infrastructure
├── tools/            # One file per tool, each exports register(server)
│   ├── quickinfo.ts
│   ├── definition.ts
│   ├── extract-function.ts
│   └── ...
├── test-workspace/   # Test fixtures for manual testing
└── README.md
```

## Adding a New Tool

1. **Find the tsserver command** — Look in `node_modules/typescript/lib/typescript.d.ts` for `CommandTypes` and the associated `*Request`/`*Response` interfaces

2. **Create the tool file** — `tools/{command-name}.ts`:

   The tool name must be the exact `CommandTypes` string value. Look it up:

   ```
   // In node_modules/typescript/lib/typescript.d.ts:
   enum CommandTypes {
     CompletionInfo = "completionInfo",  // <-- use this string as the tool name
     GetCodeFixes = "getCodeFixes",      // <-- use this string
     ...
   }
   ```

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "completionInfo", // exact CommandTypes string value
    {
      title: "Tool Title",
      description: "Description of what this tool does.",
      annotations: {
        readOnlyHint: true, // or destructiveHint for mutating tools
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        // ... other params matching tsserver's RequestArgs
      }),
    },
    async ({ file, ...rest }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.SomeResponseBody,
          ts.server.protocol.SomeRequestArgs
        >(ts.server.protocol.CommandTypes.SomeCommand, {
          file: filePath,
          ...rest,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(body) }],
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : String(err),
            },
          ],
        };
      }
    },
  );
}
```

3. **Register in index.ts**:

```typescript
import { register as newTool } from "./tools/new-tool.js";
// ...
newTool(server);
```

4. **Update README.md** — Add the tool to the appropriate table

## Refactor Tools

Refactor tools share the `applyRefactor` helper from `tsserver.ts`. They use:

- `getApplicableRefactors` — Validate that the refactor is available
- `getEditsForRefactor-full` — Get the edits (with character offsets)
- `writeEdits` — Apply edits to disk (unless preview mode)

```typescript
import { applyRefactor } from "../tsserver.js";

// In the handler:
return applyRefactor(
  {
    file: resolve(file),
    startLine,
    startOffset,
    endLine,
    endOffset,
    refactor: "Extract Symbol", // tsserver's refactor name
    action: "function_scope_0", // tsserver's action name
  },
  preview,
);
```

## Type Safety

- All tsserver request/response types come from `typescript` package
- Use `ts.server.protocol.CommandTypes.*` for command names
- Use `ts.server.protocol.*RequestArgs` and `*ResponseBody` for generics
- Never define custom interfaces that duplicate tsserver types

## Testing

```bash
pnpm build && pnpm start    # Run the server
```

Manual testing with the MCP inspector or a connected client (VS Code, Claude Desktop).

## Linting

```bash
pnpm lint                   # ESLint with strict rules
```

## What NOT to Do

❌ Add "convenience" filtering or grouping to outputs  
❌ Create custom wrapper types for tsserver responses  
❌ Combine multiple tsserver commands into one tool  
❌ Add custom path normalization beyond `path.resolve()`  
❌ Pretty-print or format JSON output  
❌ Add metadata fields to responses  
❌ Create tools for things tsserver doesn't support natively  
❌ Add heuristics or fallback logic when tsserver returns an error  
❌ Copy tsserver TSDoc comments as tool descriptions  
❌ Write descriptions for protocol developers instead of for LLMs  
❌ Guess or invent names for edit tools — always check `reference/TypeScript/src/` first, then ask the user if no match is found
