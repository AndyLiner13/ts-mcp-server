import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { mkdirSync, renameSync, statSync } from "fs";
import { dirname, resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send, writeEdits } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "rename_file_or_dir",
    {
      title: "Rename / Move File or Folder",
      description:
        "Rename or move a TypeScript/JavaScript file OR folder and automatically update all import paths across the project. Supports .ts, .tsx, .js, .jsx. tsserver auto-discovers the relevant tsconfig.json. For folders, all imports referencing files inside the folder are updated.",
      inputSchema: z.object({
        from: z
          .string()
          .describe(
            "Current file or folder path (absolute or relative to cwd)",
          ),
        to: z
          .string()
          .describe("New file or folder path (absolute or relative to cwd)"),
        preview: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "If true, show what would change without applying anything",
          ),
      }),
    },
    async ({ from, to, preview }): Promise<CallToolResult> => {
      try {
        const oldPath: string = resolve(from);
        const newPath: string = resolve(to);
        const isDir: boolean = statSync(oldPath).isDirectory();

        const fileToOpen: string =
          isDir ?
            (ts.findConfigFile(oldPath, ts.sys.fileExists) ?? oldPath)
          : oldPath;
        await open(fileToOpen);

        const edits = await send<
          readonly ts.FileTextChanges[],
          ts.server.protocol.GetEditsForFileRenameRequestArgs
        >(`${ts.server.protocol.CommandTypes.GetEditsForFileRename}-full`, {
          oldFilePath: oldPath,
          newFilePath: newPath,
        });

        if (preview) {
          const total = edits.reduce((n, e) => n + e.textChanges.length, 0);
          return {
            content: [
              {
                type: "text",
                text:
                  total === 0 ?
                    "No import updates needed."
                  : `Would update ${total} import(s) across ${edits.filter((e) => e.textChanges.length > 0).length} file(s).`,
              },
            ],
          };
        }

        const updated = await writeEdits(edits, fileToOpen);
        mkdirSync(dirname(newPath), { recursive: true });
        renameSync(oldPath, newPath);

        const what: string = isDir ? "folder" : "file";
        return {
          content: [
            {
              type: "text",
              text:
                updated.length > 0 ?
                  `Done. Renamed ${what}. Updated imports in ${updated.length} file(s).`
                : `Done. Renamed ${what}. No import updates needed.`,
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
