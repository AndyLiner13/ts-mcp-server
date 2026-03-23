import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "provideInlayHints",
    {
      title: "Provide Inlay Hints",
      description: `Get inlay hints (inline type annotations) for a range. Shows inferred types,
parameter names at call sites, and return types. Useful for understanding what
TypeScript infers without explicit type annotations.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        start: z
          .number()
          .int()
          .nonnegative()
          .describe("Start offset (0-based character position)"),
        length: z
          .number()
          .int()
          .positive()
          .describe("Length of range in characters"),
      }),
    },
    async ({ file, start, length }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.InlayHintItem[],
          ts.server.protocol.InlayHintsRequestArgs
        >(ts.server.protocol.CommandTypes.ProvideInlayHints, {
          file: filePath,
          start,
          length,
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
