import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "getMoveToRefactoringFileSuggestions",
    {
      title: "Get Move To Refactoring File Suggestions",
      description: `Get suggested target files when moving a symbol to another file.
Returns both a suggested new file name and existing files that would be good
destinations. Use this before moveSymbol to choose the best target location.`,
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
      }),
    },
    async ({
      file,
      startLine,
      startOffset,
      endLine,
      endOffset,
    }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.GetMoveToRefactoringFileSuggestions["body"],
          ts.server.protocol.GetMoveToRefactoringFileSuggestionsRequestArgs
        >(ts.server.protocol.CommandTypes.GetMoveToRefactoringFileSuggestions, {
          file: filePath,
          startLine,
          startOffset,
          endLine,
          endOffset,
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
