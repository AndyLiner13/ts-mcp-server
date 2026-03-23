import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "doc_comment_template",
    {
      title: "Doc Comment Template",
      description: `Generate a JSDoc comment template for a function, method, or class at a position.
Returns the template text with @param, @returns, etc. based on the function signature.
The returned text can be inserted above the function declaration.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z.number().int().positive().describe("1-based column offset"),
      }),
    },
    async ({ file, line, offset }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.DocCommandTemplateResponse["body"],
          ts.server.protocol.FileLocationRequestArgs
        >(ts.server.protocol.CommandTypes.DocCommentTemplate, {
          file: filePath,
          line,
          offset,
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
