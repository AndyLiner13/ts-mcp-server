#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fork } from "child_process";
import { createRequire } from "module";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "fs";
import { dirname, resolve, join } from "path";
import { z } from "zod";

// ── Branded path type — forces all paths through resolve() ─────

type AbsolutePath = string & { readonly __brand: unique symbol };

function toAbsolutePath(base: string, input: string): AbsolutePath {
  return resolve(base, input) as AbsolutePath;
}

// ── tsserver (Node IPC — zero manual serialization) ─────────────
//
// --useNodeIpc: tsserver uses process.send/on("message") natively.
// "-full" command variant: returns character offsets ({start, length})
// so edits are direct string slices with zero conversion.

interface TextChange {
  span: { start: number; length: number };
  newText: string;
}

interface FileTextChanges {
  fileName: string;
  textChanges: TextChange[];
}

let seq = 0;
const pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();
const tsserver = fork(
  createRequire(import.meta.url).resolve("typescript/lib/tsserver.js"),
  ["--useNodeIpc", "--disableAutomaticTypingAcquisition"],
  { silent: true },
);

tsserver.on("message", (msg: any) => {
  if (msg.type === "response" && msg.request_seq !== undefined) {
    const p = pending.get(msg.request_seq);
    if (p) {
      pending.delete(msg.request_seq);
      msg.success ? p.resolve(msg.body) : p.reject(new Error(msg.message));
    }
  }
});

function send<T = unknown>(
  command: string,
  args: Record<string, unknown>,
): Promise<T> {
  const id = ++seq;
  tsserver.send({ seq: id, type: "request", command, arguments: args });
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
  });
}

// ── Query: ensure project is loaded, then ask for rename edits ──
//
// tsserver is an editor service — it only knows about projects whose
// files have been "opened." We handle that here so callers never
// need to think about it.

async function getEditsForRename(
  oldPath: string,
  newPath: string,
  fileToOpen: string,
): Promise<FileTextChanges[]> {
  await send("open", { file: fileToOpen });
  return send<FileTextChanges[]>("getEditsForFileRename-full", {
    oldFilePath: oldPath,
    newFilePath: newPath,
  });
}

// ── Apply edits to file text (bottom-up to preserve offsets) ────

function applyEdits(text: string, edits: TextChange[]): string {
  return edits.reduceRight(
    (t, { span, newText }) =>
      t.slice(0, span.start) + newText + t.slice(span.start + span.length),
    text,
  );
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
  async ({ from, to, preview }) => {
    try {
      const oldPath = toAbsolutePath(process.cwd(), from);
      const newPath = toAbsolutePath(process.cwd(), to);

      const stat = statSync(oldPath, { throwIfNoEntry: false });
      if (!stat) {
        return {
          content: [{ type: "text", text: `Not found: ${oldPath}` }],
          isError: true,
        };
      }
      if (existsSync(newPath)) {
        return {
          content: [
            { type: "text", text: `Destination already exists: ${newPath}` },
          ],
          isError: true,
        };
      }

      const isDir = stat.isDirectory();
      const fileToOpen =
        isDir ?
          readdirSync(oldPath, { withFileTypes: true }).find((e) => e.isFile())
        : undefined;
      if (isDir && !fileToOpen) {
        return {
          content: [{ type: "text", text: `No files found in ${oldPath}` }],
          isError: true,
        };
      }

      const edits = await getEditsForRename(
        oldPath,
        newPath,
        isDir ? join(oldPath, fileToOpen!.name) : oldPath,
      );
      const withChanges = edits.filter((e) => e.textChanges.length > 0);

      if (preview) {
        const totalEdits = withChanges.reduce(
          (n, e) => n + e.textChanges.length,
          0,
        );
        const summary =
          withChanges.length === 0 ?
            `No import updates needed.`
          : `Would update ${totalEdits} import(s) across ${withChanges.length} file(s).`;
        return { content: [{ type: "text", text: summary }] };
      }

      // Apply edits to each affected file on disk
      const updated: string[] = [];
      for (const fileEdit of withChanges) {
        try {
          const original = readFileSync(fileEdit.fileName, "utf-8");
          writeFileSync(
            fileEdit.fileName,
            applyEdits(original, fileEdit.textChanges),
            "utf-8",
          );
          updated.push(fileEdit.fileName);
        } catch (e) {
          return {
            content: [
              {
                type: "text",
                text: `Error updating ${fileEdit.fileName}: ${e}`,
              },
            ],
            isError: true,
          };
        }
      }

      // Move the file/folder itself
      mkdirSync(dirname(newPath), { recursive: true });
      renameSync(oldPath, newPath);

      const what = isDir ? "folder" : "file";
      const summary =
        updated.length > 0 ?
          `Done. Renamed ${what}. Updated imports in ${updated.length} file(s).`
        : `Done. Renamed ${what}. No import updates needed.`;

      return { content: [{ type: "text", text: summary }] };
    } catch (e) {
      return { content: [{ type: "text", text: String(e) }], isError: true };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
