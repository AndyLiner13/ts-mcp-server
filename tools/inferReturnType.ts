import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolve } from "path";
import { z } from "zod";
import { applyRefactor } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "inferReturnType",
    {
      title: "Infer Return Type",
      description:
        "Add an explicit return type annotation to a function, inferred by TypeScript. Position must be on the function name or declaration keyword.",
      annotations: {
        destructiveHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z
          .number()
          .int()
          .positive()
          .describe("1-based character offset on the line"),
        preview: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, only preview changes"),
      }),
    },
    async ({ file, line, offset, preview }) =>
      applyRefactor(
        {
          file: resolve(file),
          line,
          offset,
          refactor: "Infer function return type",
          action: "Infer function return type",
        },
        preview,
      ),
  );
}
