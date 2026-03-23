import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "selectionRange",
    {
      title: "Selection Range",
      description: `Get semantically meaningful selection ranges for smart expand/shrink selection.
Returns nested spans that represent progressively larger syntactic constructs.
Useful for structural code selection (e.g., select expression → statement → block → function).`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        locations: z
          .array(
            z.object({
              line: z.number().int().positive().describe("1-based line number"),
              offset: z
                .number()
                .int()
                .positive()
                .describe("1-based column offset"),
            }),
          )
          .describe("Array of positions to get selection ranges for"),
      }),
    },
    async ({ file, locations }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.SelectionRange[],
          ts.server.protocol.SelectionRangeRequestArgs
        >(ts.server.protocol.CommandTypes.SelectionRange, {
          file: filePath,
          locations,
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
