// ── tsserver IPC ───────────────────────────────────────────────────
//
// All types imported from "typescript" — zero custom definitions.
// --useNodeIpc: tsserver uses process.send/on("message") natively.
// "-full" command variant returns character offsets ({start, length})
// so edits are direct string slices with zero conversion.

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { fork, type ChildProcess } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import ts from "typescript";
import { fileURLToPath } from "url";

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

export function send<T, A extends object = Record<string, unknown>>(
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

export function open(file: string): Promise<undefined> {
  return send<undefined, ts.server.protocol.FileRequestArgs>(
    ts.server.protocol.CommandTypes.Open,
    { file },
  );
}

export async function writeEdits(
  edits: readonly ts.FileTextChanges[],
): Promise<string[]> {
  const updated: string[] = [];
  for (const edit of edits) {
    if (edit.textChanges.length === 0) continue;
    if (edit.isNewFile) {
      const content = edit.textChanges.map((c) => c.newText).join("");
      writeFileSync(edit.fileName, content, "utf-8");
    } else {
      const original: string = readFileSync(edit.fileName, "utf-8");
      writeFileSync(
        edit.fileName,
        applyChanges(original, edit.textChanges),
        "utf-8",
      );
    }
    updated.push(edit.fileName);
  }
  // Reload every modified file so tsserver's in-memory state stays current
  for (const file of updated) {
    await send<undefined, ts.server.protocol.ReloadRequestArgs>(
      ts.server.protocol.CommandTypes.Reload,
      { file, tmpfile: file },
    );
  }
  return updated;
}

// ── Refactor helper (shared by extractFunction, extractConstant,
//    moveSymbol, inlineVariable, and any future refactor tools) ─
//
// Wraps the getEditsForRefactor-full → writeEdits flow.
// Each refactor tool only needs to supply the protocol args.

export async function applyRefactor(
  args: ts.server.protocol.GetEditsForRefactorRequestArgs,
  preview: boolean,
): Promise<CallToolResult> {
  try {
    await open(args.file);

    const result = await send<
      ts.RefactorEditInfo,
      ts.server.protocol.GetEditsForRefactorRequestArgs
    >(`${ts.server.protocol.CommandTypes.GetEditsForRefactor}-full`, args);

    if (result.notApplicableReason) {
      return {
        content: [{ type: "text", text: result.notApplicableReason }],
        isError: true,
      };
    }

    if (preview) {
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    }

    const updated = await writeEdits(result.edits);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ ...result, updatedFiles: updated }),
        },
      ],
    };
  } catch (err: unknown) {
    return {
      content: [{ type: "text", text: String(err) }],
      isError: true,
    };
  }
}
