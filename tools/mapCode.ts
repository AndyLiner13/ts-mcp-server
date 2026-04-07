import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { convertProtocolEdits, open, send, writeEdits } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "mapCode",
    {
      title: "Map Code",
      description: `Map/insert/replace code snippets into a file. Designed for AI code generation workflows.

How matching works:
1. Without focusLocations → code is ALWAYS appended to end of file (no matching attempted)
2. With focusLocations → TypeScript searches for matching declarations by NAME in the scope
3. Matching works for: functions, classes, methods, interfaces (nodes with a 'name' property)
4. Matching does NOT work for: const/let/var declarations (VariableStatement has no name)

When a match is found:
- The range from first matching statement to last matching statement is REPLACED with new code

When no match is found:
- Code is appended to the end of the scope (file or block)

Multiple contents limitation:
- When providing multiple contents entries, only the FIRST entry's match is applied
- To replace multiple named declarations, call mapCode once per declaration

Non-existent files:
- tsserver opens a virtual file buffer for paths that don't exist on disk
- Edits are returned and written as if the file exists, effectively creating it
- Use preview=true first to verify the output before writing a new file

Usage patterns:
- REPLACE a function: provide contents with same function name + focusLocations anywhere in file
- ADD new code: omit focusLocations (always appends to end)
- REPLACE const/var: NOT SUPPORTED by mapCode — use standard file editing instead
- REPLACE multiple declarations: call mapCode separately for each one
- CREATE a new file: provide the desired path and contents without focusLocations

Example - replacing function 'calculate' (focusLocations just needs to be in the file scope):
  contents: ["export function calculate(x: number) { return x * 2; }"]
  focusLocations: [[{ start: { line: 1, offset: 1 }, end: { line: 1, offset: 1 } }]]

Set preview=true to see edits without applying them.`,
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        contents: z
          .array(z.string())
          .describe(
            "Code snippets to map into the file. Each is parsed independently. Functions/classes are matched by name.",
          ),
        focusLocations: z
          .array(
            z.array(
              z.object({
                start: z.object({
                  line: z
                    .number()
                    .int()
                    .positive()
                    .describe("1-based line number"),
                  offset: z
                    .number()
                    .int()
                    .positive()
                    .describe("1-based character offset on line"),
                }),
                end: z.object({
                  line: z
                    .number()
                    .int()
                    .positive()
                    .describe("1-based line number"),
                  offset: z
                    .number()
                    .int()
                    .positive()
                    .describe("1-based character offset on line"),
                }),
              }),
            ),
          )
          .optional()
          .describe(
            "Required to enable name-based matching. Point anywhere in the file/block scope to search. Without this, code is always appended.",
          ),
        preview: z
          .boolean()
          .describe("If true, return edits without applying them"),
      }),
    },
    async ({
      file,
      contents,
      focusLocations,
      preview,
    }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.MapCodeResponse["body"],
          ts.server.protocol.MapCodeRequestArgs
        >(ts.server.protocol.CommandTypes.MapCode, {
          file: filePath,
          mapping: {
            contents,
            focusLocations,
          },
        });

        if (!preview && body && body.length > 0) {
          const converted = convertProtocolEdits(body);
          await writeEdits(converted);
        }

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
