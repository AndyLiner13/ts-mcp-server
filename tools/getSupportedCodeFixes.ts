import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "getSupportedCodeFixes",
    {
      title: "Get Supported Code Fixes",
      description:
        "Returns the list of all error codes that have available code fixes. " +
        "Use this as a discovery tool before calling getCodeFixes — it tells you which " +
        "error codes tsserver can automatically fix. A file path must be provided to " +
        "establish a project context; omitting it will cause tsserver to throw 'No Project'.",
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: z.object({
        file: z
          .string()
          .optional()
          .describe(
            "Optional file path (absolute or relative to cwd). If provided, scopes the result to the file's project.",
          ),
      }),
    },
    async ({ file }): Promise<CallToolResult> => {
      try {
        const args: Partial<ts.server.protocol.FileRequestArgs> = {};

        if (file !== undefined) {
          const filePath = resolve(file);
          await open(filePath);
          args.file = filePath;
        }

        const body = await send<
          string[],
          Partial<ts.server.protocol.FileRequestArgs>
        >(ts.server.protocol.CommandTypes.GetSupportedCodeFixes, args);

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
