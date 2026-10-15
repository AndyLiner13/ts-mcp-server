import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { statSync } from "fs";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send, writeEdits } from "../tsserver.js";
import { applyFileMove, serializeFileMove, validateFileMove } from "./fileMove.js";

export function register(server: McpServer): void {
  server.registerTool(
    "getEditsForFileRename",
    {
      title: "Rename / Move File or Folder",
      description:
        "Rename or move a TypeScript/JavaScript file OR folder and automatically update all import paths across the project. Supports .ts, .tsx, .js, .jsx. tsserver auto-discovers the relevant tsconfig.json. For folders, all imports referencing files inside the folder are updated. Existing destinations are rejected. Failed writes or moves restore original files; recovery errors include the retained backup directory.",
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
          .describe(
            "If true, show what would change without applying anything",
          ),
      }),
    },
    async ({ from, to, preview }): Promise<CallToolResult> =>
      serializeFileMove(async (): Promise<CallToolResult> => {
        try {
          const oldPath: string = resolve(from);
          const newPath: string = resolve(to);
          const isDir: boolean = statSync(oldPath).isDirectory();
          validateFileMove(oldPath, newPath);

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
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(edits),
                },
              ],
            };
          }

          const updated = await applyFileMove(
            oldPath,
            newPath,
            edits,
            writeEdits,
            async (files, removed): Promise<void> => {
              for (const file of removed) {
                await send<undefined, ts.server.protocol.FileRequestArgs>(
                  ts.server.protocol.CommandTypes.Close,
                  { file },
                );
              }
              for (const file of files) await open(file);
            },
          );

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
      }),
  );
}
