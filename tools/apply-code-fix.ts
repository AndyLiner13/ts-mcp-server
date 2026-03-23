import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send, writeEdits } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "apply_code_fix",
    {
      title: "Apply Code Fix",
      description: `Apply all instances of a specific code fix across a file. For example,
"Add all missing imports" or "Remove all unused variables". Use get_code_fixes
first to discover available fixes and their fixId values.`,
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        fixId: z
          .string()
          .describe(
            'The fixId from a code fix (e.g., "fixMissingImport", "unusedIdentifier", "inferFromUsage")',
          ),
        preview: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, return edits without applying"),
      }),
    },
    async ({ file, fixId, preview }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.CombinedCodeActions,
          ts.server.protocol.GetCombinedCodeFixRequestArgs
        >(ts.server.protocol.CommandTypes.GetCombinedCodeFix, {
          scope: {
            type: "file",
            args: { file: filePath },
          },
          fixId,
        });

        if (preview) {
          return {
            content: [{ type: "text", text: JSON.stringify(body) }],
          };
        }

        // Apply the edits
        const updated = await writeEdits(
          body.changes as unknown as ts.FileTextChanges[],
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...body, updatedFiles: updated }),
            },
          ],
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
