import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { resolve } from "path";
import { z } from "zod";
import { applyRefactor } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "inlineVariable",
    {
      title: "Inline Variable",
      description:
        "Inline a variable — replace all references with the variable's initializer and delete the declaration. Position must be on the variable name in its declaration or any usage.",
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
          refactor: "Inline variable",
          action: "Inline variable",
        },
        preview,
      ),
  );
}
