import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "get_diagnostics",
    {
      title: "Get Diagnostics",
      description:
        "Get all errors, warnings, and suggestions for a TypeScript/JavaScript file. Reports type errors, unused variables, unused imports, unreachable code, and more. Requires the file to be part of a tsconfig.json project. Unused-code diagnostics only appear if tsconfig has noUnusedLocals/noUnusedParameters enabled.",
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
      }),
    },
    async ({ file }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const [semantic, suggestion] = await Promise.all([
          send<
            readonly ts.server.protocol.Diagnostic[],
            ts.server.protocol.SemanticDiagnosticsSyncRequestArgs
          >(ts.server.protocol.CommandTypes.SemanticDiagnosticsSync, {
            file: filePath,
          }),
          send<
            readonly ts.server.protocol.Diagnostic[],
            ts.server.protocol.SuggestionDiagnosticsSyncRequestArgs
          >(ts.server.protocol.CommandTypes.SuggestionDiagnosticsSync, {
            file: filePath,
          }),
        ]);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ semantic, suggestion }),
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
