import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "getCombinedCodeFix",
    {
      title: "Get Combined Code Fix",
      description: `Get a combined code fix that applies all instances of a fix across a file in one action.
For example, "Add all missing imports" or "Remove all unused variables". Returns the full set
of file edits as a CombinedCodeActions response. Use getCodeFixes first to discover available
fixId values, then pass the fixId here to get the combined fix for the whole file.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        fixId: z
          .string()
          .describe(
            'The fixId from a code fix (e.g., "fixMissingImport", "unusedIdentifier", "inferFromUsage")',
          ),
      }),
    },
    async ({ file, fixId }): Promise<CallToolResult> => {
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
