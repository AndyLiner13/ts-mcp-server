import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "completionInfo",
    {
      title: "Completion Info",
      description: `Get autocomplete suggestions at a position. Returns all possible completions
with their kinds, sort text, and insert text. Useful for understanding what
symbols, methods, or properties are available at a specific location in code.`,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z.number().int().positive().describe("1-based column offset"),
        prefix: z
          .string()
          .optional()
          .describe("Optional prefix to filter completions"),
        triggerCharacter: z
          .string()
          .optional()
          .describe(
            "Character that triggered completion (e.g., '.', '\"', \"'\", '`', '/', '@', '<', '#', ' ')",
          ),
      }),
    },
    async ({
      file,
      line,
      offset,
      prefix,
      triggerCharacter,
    }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.CompletionInfo,
          ts.server.protocol.CompletionsRequestArgs
        >(ts.server.protocol.CommandTypes.CompletionInfo, {
          file: filePath,
          line,
          offset,
          prefix,
          triggerCharacter:
            triggerCharacter as ts.server.protocol.CompletionsRequestArgs["triggerCharacter"],
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
