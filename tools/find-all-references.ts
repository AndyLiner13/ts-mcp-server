import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "find_all_references",
    {
      title: "Find All References",
      description:
        "Find all usages of a symbol across the project. Provide the file path and 1-based line/offset of any occurrence of the symbol. Returns references grouped by file with line text for context.",
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z
          .number()
          .int()
          .positive()
          .describe("1-based character offset on the line"),
      }),
    },
    async ({ file, line, offset }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.ReferencesResponseBody,
          ts.server.protocol.FileLocationRequestArgs
        >(ts.server.protocol.CommandTypes.References, {
          file: filePath,
          line,
          offset,
        });

        const grouped = Map.groupBy(
          body.refs,
          (ref: ts.server.protocol.ReferencesResponseItem): string => ref.file,
        );

        const sections: string[] = [];
        for (const [refFile, refs] of grouped) {
          const lines: string[] = (refs ?? []).map(
            (ref): string =>
              `  ${ref.start.line}:${ref.start.offset}${ref.isDefinition ? " (definition)" : ""}${ref.isWriteAccess ? " (write)" : ""}${ref.lineText ? ` — ${ref.lineText.trim()}` : ""}`,
          );
          sections.push(`${refFile}\n${lines.join("\n")}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `"${body.symbolName}" — ${body.refs.length} reference(s) across ${grouped.size} file(s):\n\n${sections.join("\n\n")}`,
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
