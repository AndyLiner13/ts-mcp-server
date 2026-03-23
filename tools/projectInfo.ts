import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "projectInfo",
    {
      title: "Project Info",
      description:
        "Returns the tsconfig.json path, the full list of files in the project, and whether the language service is active.",
      annotations: {
        readOnlyHint: true,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        needFileNameList: z
          .boolean()
          .optional()
          .default(true)
          .describe("If true, include the list of all files in the project"),
      }),
    },
    async ({ file, needFileNameList }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.ProjectInfo,
          ts.server.protocol.ProjectInfoRequestArgs
        >(ts.server.protocol.CommandTypes.ProjectInfo, {
          file: filePath,
          needFileNameList,
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
