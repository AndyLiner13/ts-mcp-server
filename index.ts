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

// ── Bootstrap project + get edits ───────────────────────────────
//
// tsserver only knows about projects whose files have been "opened."
// For files we open the file itself; for folders we use TypeScript's
// native ts.findConfigFile() to locate the tsconfig.json and open that.

async function getEditsForRename(
  oldPath: string,
  newPath: string,
  isDir: boolean,
): Promise<readonly ts.FileTextChanges[]> {
  const fileToOpen: string =
    isDir ?
      (ts.findConfigFile(oldPath, ts.sys.fileExists) ?? oldPath)
    : oldPath;

  await send<undefined, ts.server.protocol.FileRequestArgs>(
    ts.server.protocol.CommandTypes.Open,
    { file: fileToOpen },
  );
  return send<
    readonly ts.FileTextChanges[],
    ts.server.protocol.GetEditsForFileRenameRequestArgs
  >(`${ts.server.protocol.CommandTypes.GetEditsForFileRename}-full`, {
    oldFilePath: oldPath,
    newFilePath: newPath,
  });
}

// ── Apply edits (mirrors ts.textChanges.applyChanges internals) ─

function applyChanges(text: string, changes: readonly ts.TextChange[]): string {
  for (let i = changes.length - 1; i >= 0; i--) {
    const { span, newText } = changes[i];
    text = `${text.substring(0, span.start)}${newText}${text.substring(ts.textSpanEnd(span))}`;
  }
  return text;
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
      const edits = await getEditsForRename(oldPath, newPath, isDir);
      const withChanges = edits.filter(
        (edit): edit is ts.FileTextChanges => edit.textChanges.length > 0,
      );

      if (preview) {
        const totalEdits = withChanges.reduce(
          (count: number, edit: ts.FileTextChanges): number =>
            count + edit.textChanges.length,
          0,
        );
        const summary: string =
          withChanges.length === 0 ?
            `No import updates needed.`
          : `Would update ${totalEdits} import(s) across ${withChanges.length} file(s).`;
        return { content: [{ type: "text", text: summary }] };
      }

      // Apply edits to each affected file on disk
      const updated: string[] = [];
      for (const fileEdit of withChanges) {
        try {
          const original: string = readFileSync(fileEdit.fileName, "utf-8");
          writeFileSync(
            fileEdit.fileName,
            applyChanges(original, fileEdit.textChanges),
            "utf-8",
          );
          updated.push(fileEdit.fileName);
        } catch (err: unknown) {
          return {
            content: [{ type: "text", text: String(err) }],
            isError: true,
          };
        }
      }

      // Move the file/folder itself
      mkdirSync(dirname(newPath), { recursive: true });
      renameSync(oldPath, newPath);

      const what: string = isDir ? "folder" : "file";
      const summary: string =
        updated.length > 0 ?
          `Done. Renamed ${what}. Updated imports in ${updated.length} file(s).`
        : `Done. Renamed ${what}. No import updates needed.`;

      return { content: [{ type: "text", text: summary }] };
    } catch (err: unknown) {
      return { content: [{ type: "text", text: String(err) }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
