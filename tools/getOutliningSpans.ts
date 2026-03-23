import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "getOutliningSpans",
    {
      title: "Get Outlining Spans",
      description: `Get code folding regions for a file. Returns the hierarchical structure of code blocks
including their kinds (comment, region, code, imports). Useful for understanding file
structure, complexity, and navigating large files.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
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
          ts.server.protocol.OutliningSpan[],
          ts.server.protocol.FileRequestArgs
        >(ts.server.protocol.CommandTypes.GetOutliningSpans, {
          file: filePath,
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
