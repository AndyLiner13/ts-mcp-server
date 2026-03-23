import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "provideCallHierarchyIncomingCalls",
    {
      title: "Incoming Calls",
      description:
        "Returns all functions/methods that call the function at the given position. Answers 'who calls this?'",
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("1-based line number"),
        offset: z
          .number()
          .int()
          .positive()
          .describe("1-based character offset on the line"),
      }),
    },
    async ({ file, line, offset }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.CallHierarchyIncomingCall[],
          ts.server.protocol.FileLocationRequestArgs
        >(ts.server.protocol.CommandTypes.ProvideCallHierarchyIncomingCalls, {
          file: filePath,
          line,
          offset,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(body),
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
