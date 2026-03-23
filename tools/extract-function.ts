import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolve } from "path";
import { z } from "zod";
import { applyRefactor } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "extractFunction",
    {
      title: "Extract Function",
      description:
        "Extract the selected code range into a new function. TypeScript auto-detects parameters and return type. The response includes renameFilename/renameLocation so you can follow up with rename_symbol to give the function a meaningful name.",
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
        preview: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, only preview changes"),
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
          refactor: "Extract Symbol",
          action: "function_scope_0",
        },
        preview,
      ),
  );
}
