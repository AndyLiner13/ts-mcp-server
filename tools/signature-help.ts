import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "signatureHelp",
    {
      title: "Signature Help",
      description: `Get function/method signature information at a call site. Returns parameter names,
types, and documentation for each overload. Use when the cursor is inside function
call parentheses to understand what arguments are expected.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z
          .number()
          .int()
          .positive()
          .describe("1-based column offset (inside the parentheses)"),
        triggerReason: z
          .object({
            kind: z.enum(["invoked", "retrigger", "characterTyped"]),
            triggerCharacter: z.string().optional(),
          })
          .optional()
          .describe("Optional reason for triggering signature help"),
      }),
    },
    async ({ file, line, offset, triggerReason }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.SignatureHelpItems,
          ts.server.protocol.SignatureHelpRequestArgs
        >(ts.server.protocol.CommandTypes.SignatureHelp, {
          file: filePath,
          line,
          offset,
          triggerReason:
            triggerReason as ts.server.protocol.SignatureHelpRequestArgs["triggerReason"],
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
