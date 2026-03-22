import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolve } from "path";
import { z } from "zod";
import { applyRefactor } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "move_symbol",
    {
      title: "Move Symbol",
      description:
        "Move top-level declarations (functions, classes, types, constants) to another file. Automatically rewires all imports across the project. If the target file does not exist, tsserver creates it.",
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
        targetFile: z
          .string()
          .describe("Destination file path (absolute or relative to cwd)"),
        preview: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, only preview changes"),
      }),
    },
    async ({
      file,
      startLine,
      startOffset,
      endLine,
      endOffset,
      targetFile,
      preview,
    }) =>
      applyRefactor(
        {
          file: resolve(file),
          startLine,
          startOffset,
          endLine,
          endOffset,
          refactor: "Move to file",
          action: "Move to file",
          interactiveRefactorArguments: { targetFile: resolve(targetFile) },
        },
        preview,
      ),
  );
}
