import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "getCodeFixes",
    {
      title: "Get Code Fixes",
      description:
        "Get available code fixes for specific error codes at a range in a TypeScript/JavaScript file. Returns the raw list of code actions tsserver suggests for the given diagnostics. Use getDiagnostics first to discover error codes and ranges, then pass them here.",
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        startLine: z.number().int().positive().describe("1-based start line"),
        startOffset: z
          .number()
          .int()
          .positive()
          .describe("1-based start character offset"),
        endLine: z.number().int().positive().describe("1-based end line"),
        endOffset: z
          .number()
          .int()
          .positive()
          .describe("1-based end character offset"),
        errorCodes: z
          .array(z.number().int())
          .describe("Diagnostic error codes to get fixes for"),
      }),
    },
    async ({
      file,
      startLine,
      startOffset,
      endLine,
      endOffset,
      errorCodes,
    }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          readonly ts.server.protocol.CodeAction[],
          ts.server.protocol.CodeFixRequestArgs
        >(ts.server.protocol.CommandTypes.GetCodeFixes, {
          file: filePath,
          startLine,
          startOffset,
          endLine,
          endOffset,
          errorCodes,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(body) }],
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
