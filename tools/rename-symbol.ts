import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send, writeEdits } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "rename_symbol",
    {
      title: "Rename Symbol",
      description:
        "Rename a TypeScript/JavaScript symbol (variable, function, class, type, property, etc.) and update all references across the project. Provide the file path and the 1-based line/offset of any occurrence of the symbol.",
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z
          .number()
          .int()
          .positive()
          .describe("1-based character offset on the line"),
        newName: z.string().describe("New name for the symbol"),
        preview: z
          .boolean()
          .optional()
          .default(false)
          .describe("If true, only preview changes"),
      }),
    },
    async ({
      file,
      line,
      offset,
      newName,
      preview,
    }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const info = await send<
          ts.RenameInfoSuccess | ts.RenameInfoFailure,
          ts.server.protocol.RenameRequestArgs
        >(`${ts.server.protocol.CommandTypes.Rename}-full`, {
          file: filePath,
          line,
          offset,
        });

        if (!info.canRename) {
          return {
            content: [{ type: "text", text: info.localizedErrorMessage }],
            isError: true,
          };
        }

        const locations = await send<
          readonly ts.RenameLocation[],
          ts.server.protocol.RenameRequestArgs
        >("renameLocations-full", { file: filePath, line, offset });

        if (preview) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ info, locations }),
              },
            ],
          };
        }

        // Convert RenameLocation[] → FileTextChanges[] so writeEdits() works
        const edits: ts.FileTextChanges[] = Object.entries(
          Object.groupBy(
            locations,
            (loc: ts.RenameLocation): string => loc.fileName,
          ),
        ).map(
          ([fileName, locs]): ts.FileTextChanges => ({
            fileName,
            textChanges: (locs ?? []).map(
              (loc): ts.TextChange => ({
                span: loc.textSpan,
                newText: newName,
              }),
            ),
            isNewFile: false,
          }),
        );

        const updated = await writeEdits(edits, filePath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ info, locations, updatedFiles: updated }),
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
