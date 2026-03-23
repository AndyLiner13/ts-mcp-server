import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "todo_comments",
    {
      title: "Todo Comments",
      description: `Find all TODO, FIXME, HACK, and other configured comment markers in a file.
Returns the location and text of each matching comment. You must provide the
descriptors array specifying which markers to search for.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        descriptors: z
          .array(
            z.object({
              text: z
                .string()
                .describe('The marker text (e.g., "TODO", "FIXME", "HACK")'),
              priority: z
                .number()
                .int()
                .describe("Priority for sorting (lower = higher priority)"),
            }),
          )
          .describe("Array of comment markers to search for"),
      }),
    },
    async ({ file, descriptors }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.TodoComment[],
          ts.server.protocol.TodoCommentRequestArgs
        >(ts.server.protocol.CommandTypes.TodoComments, {
          file: filePath,
          descriptors,
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
