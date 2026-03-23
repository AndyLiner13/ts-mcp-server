import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "completion_entry_details",
    {
      title: "Completion Entry Details",
      description: `Get full details for specific completion entries. Follow-up to completion_info
for richer information including documentation, full type signature, JSDoc tags,
and code actions (like auto-imports). Can request details for multiple entries at once.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z.number().int().positive().describe("1-based column offset"),
        entryNames: z
          .array(z.string())
          .describe("Names of completion entries to get details for"),
      }),
    },
    async ({ file, line, offset, entryNames }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.CompletionEntryDetails[],
          ts.server.protocol.CompletionDetailsRequestArgs
        >(ts.server.protocol.CommandTypes.CompletionDetails, {
          file: filePath,
          line,
          offset,
          entryNames,
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
