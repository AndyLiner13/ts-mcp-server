import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send, writeEdits } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "organize_imports",
    {
      title: "Organize Imports",
      description:
        "Sort, coalesce, and remove unused imports in a TypeScript/JavaScript file. Uses TypeScript's native organizeImports with mode 'All' (sorts, coalesces, and removes unused). Requires the file to be part of a tsconfig.json project.",
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        preview: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, only preview changes"),
      }),
    },
    async ({ file, preview }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const edits = await send<
          readonly ts.FileTextChanges[],
          ts.server.protocol.OrganizeImportsRequestArgs
        >(`${ts.server.protocol.CommandTypes.OrganizeImports}-full`, {
          scope: { type: "file", args: { file: filePath } },
          mode: ts.OrganizeImportsMode.All,
        });

        if (preview) {
          return {
            content: [{ type: "text", text: JSON.stringify(edits) }],
          };
        }

        const updated = await writeEdits(edits);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ edits, updatedFiles: updated }),
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
