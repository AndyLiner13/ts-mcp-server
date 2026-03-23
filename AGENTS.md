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
- Tool names should align with the native TypeScript API where possible (e.g., `find_all_references` not `findReferences`)
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

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "tool_name",
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
            { type: "text", text: err instanceof Error ? err.message : String(err) },
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
    refactor: "Extract Symbol",  // tsserver's refactor name
    action: "function_scope_0",   // tsserver's action name
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
