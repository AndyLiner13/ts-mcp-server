import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolve } from "path";
import { z } from "zod";
import { applyRefactor } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "extractType",
    {
      title: "Extract Type",
      description:
        "Extract an inline type annotation into a named type alias. Select the type span to extract. The response includes renameFilename/renameLocation so you can follow up with rename_symbol to give the type a meaningful name.",
      annotations: {
        destructiveHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        startLine: z.number().int().positive().describe("1-based start line"),
        startOffset: z
          .number()
          .int()
          .positive()
          .describe("1-based start character offset"),
        endLine: z.number().int().positive().describe("1-based end line"),
        endOffset: z
          .number()
          .int()
          .positive()
          .describe("1-based end character offset"),
        preview: z.boolean().describe("If true, only preview changes"),
      }),
    },
    async ({ file, startLine, startOffset, endLine, endOffset, preview }) =>
      applyRefactor(
        {
          file: resolve(file),
          startLine,
          startOffset,
          endLine,
          endOffset,
          refactor: "Extract type",
          action: "Extract to type alias",
        },
        preview,
      ),
  );
}
