import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "getApplicableRefactors",
    {
      title: "Get Applicable Refactors",
      description: `Discover what refactorings are available at a position or selection. Use before
attempting a refactor to see what's possible. Returns a list of available refactors
with their actions, descriptions, and any reasons why certain actions may not apply.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        startLine: z.number().int().positive().describe("1-based start line"),
        startOffset: z
          .number()
          .int()
          .positive()
          .describe("1-based start column"),
        endLine: z.number().int().positive().describe("1-based end line"),
        endOffset: z.number().int().positive().describe("1-based end column"),
        triggerReason: z
          .enum(["implicit", "invoked"])
          .optional()
          .describe("Optional trigger reason"),
      }),
    },
    async ({
      file,
      startLine,
      startOffset,
      endLine,
      endOffset,
      triggerReason,
    }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.ApplicableRefactorInfo[],
          ts.server.protocol.GetApplicableRefactorsRequestArgs
        >(ts.server.protocol.CommandTypes.GetApplicableRefactors, {
          file: filePath,
          startLine,
          startOffset,
          endLine,
          endOffset,
          triggerReason,
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
