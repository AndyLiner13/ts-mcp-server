import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "navto",
    {
      title: "Navigate to Symbol",
      description:
        "Workspace-wide symbol search by name. Takes a search string and returns matching symbols across all project files with their locations and kinds.",
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: z.object({
        searchValue: z.string().describe("Symbol name or prefix to search for"),
        file: z
          .string()
          .optional()
          .describe(
            "Optional file for project context (absolute or relative to cwd)",
          ),
        maxResultCount: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of results to return"),
        currentFileOnly: z
          .boolean()
          .optional()
          .describe("If true, only search the specified file"),
      }),
    },
    async ({
      searchValue,
      file,
      maxResultCount,
      currentFileOnly,
    }): Promise<CallToolResult> => {
      try {
        const filePath: string | undefined = file ? resolve(file) : undefined;
        if (filePath) {
          await open(filePath);
        }

        const body = await send<
          ts.server.protocol.NavtoItem[],
          ts.server.protocol.NavtoRequestArgs
        >(ts.server.protocol.CommandTypes.Navto, {
          searchValue,
          file: filePath,
          maxResultCount,
          currentFileOnly,
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
