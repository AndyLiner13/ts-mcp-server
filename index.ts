#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as extractConstant } from "./tools/extract-constant.js";
import { register as extractFunction } from "./tools/extract-function.js";
import { register as extractType } from "./tools/extract-type.js";
import { register as findAllReferences } from "./tools/find-all-references.js";
import { register as getCodeFixes } from "./tools/get-code-fixes.js";
import { register as getDiagnostics } from "./tools/get-diagnostics.js";
import { register as inferReturnType } from "./tools/infer-return-type.js";
import { register as inlineVariable } from "./tools/inline-variable.js";
import { register as moveSymbol } from "./tools/move-symbol.js";
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
extractFunction(server);
extractConstant(server);
moveSymbol(server);
inlineVariable(server);
extractType(server);
inferReturnType(server);

const transport = new StdioServerTransport();
await server.connect(transport);
