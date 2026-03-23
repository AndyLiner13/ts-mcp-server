import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "implementation",
    {
      title: "Go to Implementation",
      description:
        "Finds concrete implementations of an interface or abstract class. Given an interface `Serializable`, returns every class that implements it.",
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
          readonly ts.server.protocol.FileSpanWithContext[],
          ts.server.protocol.FileLocationRequestArgs
        >(ts.server.protocol.CommandTypes.Implementation, {
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
