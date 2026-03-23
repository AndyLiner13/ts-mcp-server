import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "navtree",
    {
      title: "Navigation Tree",
      description:
        "Get the complete hierarchical structure of a file — all classes, functions, variables, interfaces, type aliases, enums, and their nesting. Returns kind, name, spans, and child items for every declaration.",
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
      }),
    },
    async ({ file }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.NavigationTree,
          ts.server.protocol.FileRequestArgs
        >(ts.server.protocol.CommandTypes.NavTree, { file: filePath });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(body),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          content: [{ type: "text", text: String(err) }],
          isError: true,
        };
      }
    },
  );
}
