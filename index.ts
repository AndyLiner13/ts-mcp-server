#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { fork, type ChildProcess } from "child_process";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, resolve } from "path";
import ts from "typescript";
import { fileURLToPath } from "url";
import { z } from "zod";

// ── tsserver IPC ───────────────────────────────────────────────────
//
// All types imported from "typescript" — zero custom definitions.
// --useNodeIpc: tsserver uses process.send/on("message") natively.
// "-full" command variant returns character offsets ({start, length})
// so edits are direct string slices with zero conversion.

// ── tsserver child process (Node IPC) ───────────────────────────

let seq = 0;
const pending = new Map<number, PromiseWithResolvers<unknown>>();

const tsserverPath: string = fileURLToPath(
  import.meta.resolve("typescript/lib/tsserver.js"),
);
const tsserver: ChildProcess = fork(
  tsserverPath,
  ["--useNodeIpc", "--disableAutomaticTypingAcquisition"],
  { silent: true },
);

function isTsServerResponse(
  msg: ts.server.protocol.Message,
): msg is ts.server.protocol.Response {
  return msg.type === "response";
}

tsserver.on("message", (msg: ts.server.protocol.Message): void => {
  if (!isTsServerResponse(msg)) return;

  const p = pending.get(msg.request_seq);
  if (!p) return;

  pending.delete(msg.request_seq);
  if (msg.success) {
    p.resolve(msg.body);
  } else {
    p.reject(new Error(msg.message));
  }
});

function send<T, A extends object = Record<string, unknown>>(
  command: string,
  args: A,
): Promise<T> {
  const id = ++seq;
  const request: ts.server.protocol.Request = {
    seq: id,
    type: "request",
    command,
    arguments: args,
  };
  tsserver.send(request);
  const deferred = Promise.withResolvers<T>();
  pending.set(id, deferred as PromiseWithResolvers<unknown>);
  return deferred.promise;
}

// ── Apply edits (mirrors ts.textChanges.applyChanges internals) ─

function applyChanges(text: string, changes: readonly ts.TextChange[]): string {
  for (let i = changes.length - 1; i >= 0; i--) {
    const { span, newText } = changes[i];
    text = `${text.substring(0, span.start)}${newText}${text.substring(ts.textSpanEnd(span))}`;
  }
  return text;
}

function open(file: string): Promise<undefined> {
  return send<undefined, ts.server.protocol.FileRequestArgs>(
    ts.server.protocol.CommandTypes.Open,
    { file },
  );
}

async function writeEdits(
  edits: readonly ts.FileTextChanges[],
  openedFile: string,
): Promise<string[]> {
  const updated: string[] = [];
  for (const edit of edits) {
    if (edit.textChanges.length === 0) continue;
    const original: string = readFileSync(edit.fileName, "utf-8");
    writeFileSync(
      edit.fileName,
      applyChanges(original, edit.textChanges),
      "utf-8",
    );
    updated.push(edit.fileName);
  }
  if (updated.length > 0) {
    await send<undefined, ts.server.protocol.ReloadRequestArgs>(
      ts.server.protocol.CommandTypes.Reload,
      { file: openedFile, tmpfile: openedFile },
    );
  }
  return updated;
}

// ── Boot ────────────────────────────────────────────────────────

const server = new McpServer({
  name: "ts-mcp-server",
  version: "1.0.0",
});

server.registerTool(
  "rename_file_or_dir",
  {
    title: "Rename / Move File or Folder",
    description:
      "Rename or move a TypeScript/JavaScript file OR folder and automatically update all import paths across the project. Supports .ts, .tsx, .js, .jsx. tsserver auto-discovers the relevant tsconfig.json. For folders, all imports referencing files inside the folder are updated.",
    inputSchema: z.object({
      from: z
        .string()
        .describe("Current file or folder path (absolute or relative to cwd)"),
      to: z
        .string()
        .describe("New file or folder path (absolute or relative to cwd)"),
      preview: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, show what would change without applying anything"),
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
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

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
  async ({ file, line, offset, newName, preview }): Promise<CallToolResult> => {
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
        const byFile = Map.groupBy(
          locations,
          (loc: ts.RenameLocation): string => loc.fileName,
        );
        return {
          content: [
            {
              type: "text",
              text: `Would rename "${info.displayName}" → "${newName}": ${locations.length} occurrence(s) across ${byFile.size} file(s).`,
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
            (loc): ts.TextChange => ({ span: loc.textSpan, newText: newName }),
          ),
          isNewFile: false,
        }),
      );

      const updated = await writeEdits(edits, filePath);
      return {
        content: [
          {
            type: "text",
            text: `Done. Renamed "${info.displayName}" → "${newName}". Updated ${locations.length} occurrence(s) across ${updated.length} file(s).`,
          },
        ],
      };
    } catch (err: unknown) {
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
