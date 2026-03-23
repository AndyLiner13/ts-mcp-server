#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as completionEntryDetails } from "./tools/completion-entry-details.js";
import { register as completionInfo } from "./tools/completion-info.js";
import { register as definition } from "./tools/definition.js";
import { register as definitionAndBoundSpan } from "./tools/definition-and-bound-span.js";
import { register as docCommentTemplate } from "./tools/doc-comment-template.js";
import { register as documentHighlights } from "./tools/document-highlights.js";
import { register as extractConstant } from "./tools/extract-constant.js";
import { register as extractFunction } from "./tools/extract-function.js";
import { register as extractType } from "./tools/extract-type.js";
import { register as fileReferences } from "./tools/file-references.js";
import { register as findSourceDefinition } from "./tools/find-source-definition.js";
import { register as format } from "./tools/format.js";
import { register as references } from "./tools/references.js";
import { register as getApplicableRefactors } from "./tools/get-applicable-refactors.js";
import { register as getCombinedCodeFix } from "./tools/get-combined-code-fix.js";
import { register as getCodeFixes } from "./tools/get-code-fixes.js";
import { register as getDiagnostics } from "./tools/get-diagnostics.js";
import { register as getMoveToRefactoringFileSuggestions } from "./tools/get-move-to-refactoring-file-suggestions.js";
import { register as getOutliningSpans } from "./tools/get-outlining-spans.js";
import { register as selectionRange } from "./tools/selection-range.js";
import { register as implementation } from "./tools/implementation.js";
import { register as inferReturnType } from "./tools/infer-return-type.js";
import { register as inlineVariable } from "./tools/inline-variable.js";
import { register as moveSymbol } from "./tools/move-symbol.js";
import { register as navtree } from "./tools/navtree.js";
import { register as navto } from "./tools/navto.js";
import { register as organizeImports } from "./tools/organize-imports.js";
import { register as prepareCallHierarchy } from "./tools/prepare-call-hierarchy.js";
import { register as projectInfo } from "./tools/project-info.js";
import { register as provideCallHierarchyIncomingCalls } from "./tools/provide-call-hierarchy-incoming-calls.js";
import { register as provideCallHierarchyOutgoingCalls } from "./tools/provide-call-hierarchy-outgoing-calls.js";
import { register as provideInlayHints } from "./tools/provide-inlay-hints.js";
import { register as quickinfo } from "./tools/quickinfo.js";
import { register as renameFileOrDirectory } from "./tools/rename-file-or-directory.js";
import { register as rename } from "./tools/rename.js";
import { register as signatureHelp } from "./tools/signature-help.js";
import { register as todoComments } from "./tools/todo-comments.js";
import { register as typeDefinition } from "./tools/type-definition.js";

const server = new McpServer({
  name: "ts-mcp-server",
  version: "1.0.0",
});

renameFileOrDirectory(server);
rename(server);
getDiagnostics(server);
references(server);
organizeImports(server);
getCodeFixes(server);
extractFunction(server);
extractConstant(server);
moveSymbol(server);
inlineVariable(server);
extractType(server);
inferReturnType(server);
quickinfo(server);
navtree(server);
definition(server);
navto(server);
fileReferences(server);
prepareCallHierarchy(server);
provideCallHierarchyIncomingCalls(server);
provideCallHierarchyOutgoingCalls(server);
typeDefinition(server);
implementation(server);
projectInfo(server);
completionInfo(server);
completionEntryDetails(server);
signatureHelp(server);
documentHighlights(server);
getApplicableRefactors(server);
docCommentTemplate(server);
getOutliningSpans(server);
provideInlayHints(server);
getCombinedCodeFix(server);
todoComments(server);
definitionAndBoundSpan(server);
findSourceDefinition(server);
selectionRange(server);
format(server);
getMoveToRefactoringFileSuggestions(server);

const transport = new StdioServerTransport();
await server.connect(transport);
