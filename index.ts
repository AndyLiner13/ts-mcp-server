#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as findAllReferences } from "./tools/find-all-references.js";
import { register as getCodeFixes } from "./tools/get-code-fixes.js";
import { register as getDiagnostics } from "./tools/get-diagnostics.js";
import { register as organizeImports } from "./tools/organize-imports.js";
import { register as renameFileOrDir } from "./tools/rename-file-or-dir.js";
import { register as renameSymbol } from "./tools/rename-symbol.js";

const server = new McpServer({
  name: "ts-mcp-server",
  version: "1.0.0",
});

renameFileOrDir(server);
renameSymbol(server);
getDiagnostics(server);
findAllReferences(server);
organizeImports(server);
getCodeFixes(server);

const transport = new StdioServerTransport();
await server.connect(transport);
