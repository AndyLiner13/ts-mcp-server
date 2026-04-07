import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolve } from "path";
import ts from "typescript";
import { z } from "zod";
import { open, send, writeEdits } from "../tsserver.js";

export function register(server: McpServer): void {
  server.registerTool(
    "format",
    {
      title: "Format",
      description: `Format a range of code according to TypeScript's formatting rules.
Applies consistent indentation, spacing, and line breaks. Specify a range
or use the full file length to format the entire file.`,
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        file: z.string().describe("File path (absolute or relative to cwd)"),
        line: z.number().int().positive().describe("Start line (1-based)"),
        offset: z.number().int().positive().describe("Start offset (1-based)"),
        endLine: z.number().int().positive().describe("End line (1-based)"),
        endOffset: z.number().int().positive().describe("End offset (1-based)"),
        options: z
          .object({
            tabSize: z.number().int().positive().optional(),
            indentSize: z.number().int().positive().optional(),
            convertTabsToSpaces: z.boolean().optional(),
            newLineCharacter: z.string().optional(),
            insertSpaceAfterCommaDelimiter: z.boolean().optional(),
            insertSpaceAfterSemicolonInForStatements: z.boolean().optional(),
            insertSpaceBeforeAndAfterBinaryOperators: z.boolean().optional(),
            insertSpaceAfterKeywordsInControlFlowStatements: z
              .boolean()
              .optional(),
            insertSpaceAfterFunctionKeywordForAnonymousFunctions: z
              .boolean()
              .optional(),
            insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: z
              .boolean()
              .optional(),
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: z
              .boolean()
              .optional(),
            insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: z
              .boolean()
              .optional(),
            placeOpenBraceOnNewLineForFunctions: z.boolean().optional(),
            placeOpenBraceOnNewLineForControlBlocks: z.boolean().optional(),
          })
          .optional()
          .describe("Formatting options"),
        preview: z.boolean().describe("If true, return edits without applying"),
      }),
    },
    async ({
      file,
      line,
      offset,
      endLine,
      endOffset,
      options,
      preview,
    }): Promise<CallToolResult> => {
      try {
        const filePath: string = resolve(file);
        await open(filePath);

        const body = await send<
          ts.server.protocol.CodeEdit[],
          ts.server.protocol.FormatRequestArgs
        >(ts.server.protocol.CommandTypes.Format, {
          file: filePath,
          line,
          offset,
          endLine,
          endOffset,
          options,
        });

        if (preview) {
          return {
            content: [{ type: "text", text: JSON.stringify(body) }],
          };
        }

        // Convert CodeEdit[] to FileTextChanges format for writeEdits
        const fileChanges: ts.FileTextChanges[] = [
          {
            fileName: filePath,
            textChanges: body.map((edit) => ({
              span: {
                start: edit.start.offset,
                length: edit.end.offset - edit.start.offset,
              },
              newText: edit.newText,
            })),
          },
        ];

        const updated = await writeEdits(fileChanges);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ edits: body, updatedFiles: updated }),
            },
          ],
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
