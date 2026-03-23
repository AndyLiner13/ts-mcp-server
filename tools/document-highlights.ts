import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "document_highlights",
    {
      title: "Document Highlights",
      description: `Find all occurrences of a symbol within a file (or set of files). Distinguishes
between read and write references. More efficient than find_all_references when
you only need local occurrences within specific files.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z.number().int().positive().describe("1-based column offset"),
        filesToSearch: z
          .array(z.string())
          .optional()
          .describe("Optional: limit search to these files"),
      }),
    },
    async ({ file, line, offset, filesToSearch }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        // Resolve filesToSearch paths if provided
        const resolvedFilesToSearch = filesToSearch?.map((f) => resolve(f));

        const body = await send<
          ts.server.protocol.DocumentHighlightsItem[],
          ts.server.protocol.DocumentHighlightsRequestArgs
        >(ts.server.protocol.CommandTypes.DocumentHighlights, {
          file: filePath,
          line,
          offset,
          filesToSearch: resolvedFilesToSearch ?? [filePath],
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
