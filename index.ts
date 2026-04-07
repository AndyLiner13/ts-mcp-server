#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as completionEntryDetails } from "./tools/completionEntryDetails.js";
import { register as completionInfo } from "./tools/completionInfo.js";
import { register as definition } from "./tools/definition.js";
import { register as definitionAndBoundSpan } from "./tools/definitionAndBoundSpan.js";
import { register as docCommentTemplate } from "./tools/docCommentTemplate.js";
import { register as documentHighlights } from "./tools/documentHighlights.js";
import { register as extractConstant } from "./tools/extractConstant.js";
import { register as extractFunction } from "./tools/extractFunction.js";
import { register as extractType } from "./tools/extractType.js";
import { register as fileReferences } from "./tools/fileReferences.js";
import { register as findSourceDefinition } from "./tools/findSourceDefinition.js";
import { register as format } from "./tools/format.js";
import { register as mapCode } from "./tools/mapCode.js";
import { register as references } from "./tools/references.js";
import { register as getApplicableRefactors } from "./tools/getApplicableRefactors.js";
import { register as getCombinedCodeFix } from "./tools/getCombinedCodeFix.js";
import { register as getCodeFixes } from "./tools/getCodeFixes.js";
import { register as getDiagnostics } from "./tools/getDiagnostics.js";
import { register as getMoveToRefactoringFileSuggestions } from "./tools/getMoveToRefactoringFileSuggestions.js";
import { register as getOutliningSpans } from "./tools/getOutliningSpans.js";
import { register as getSupportedCodeFixes } from "./tools/getSupportedCodeFixes.js";
import { register as selectionRange } from "./tools/selectionRange.js";
import { register as implementation } from "./tools/implementation.js";
import { register as inferReturnType } from "./tools/inferReturnType.js";
import { register as inlineVariable } from "./tools/inlineVariable.js";
import { register as moveSymbol } from "./tools/moveSymbol.js";
import { register as navtree } from "./tools/navtree.js";
import { register as navto } from "./tools/navto.js";
import { register as organizeImports } from "./tools/organizeImports.js";
import { register as prepareCallHierarchy } from "./tools/prepareCallHierarchy.js";
import { register as projectInfo } from "./tools/projectInfo.js";
import { register as provideCallHierarchyIncomingCalls } from "./tools/provideCallHierarchyIncomingCalls.js";
import { register as provideCallHierarchyOutgoingCalls } from "./tools/provideCallHierarchyOutgoingCalls.js";
import { register as provideInlayHints } from "./tools/provideInlayHints.js";
import { register as quickinfo } from "./tools/quickinfo.js";
import { register as renameFileOrDirectory } from "./tools/renameFileOrDirectory.js";
import { register as rename } from "./tools/rename.js";
import { register as signatureHelp } from "./tools/signatureHelp.js";
import { register as todoComments } from "./tools/todoComments.js";
import { register as typeDefinition } from "./tools/typeDefinition.js";

const isEnabled = (name: string): boolean => process.env[name] !== "false";

const server = new McpServer({
  name: "ts-mcp-server",
  version: "1.0.0",
});

if (isEnabled("renameFileOrDirectory")) renameFileOrDirectory(server);
if (isEnabled("rename")) rename(server);
if (isEnabled("getDiagnostics")) getDiagnostics(server);
if (isEnabled("references")) references(server);
if (isEnabled("organizeImports")) organizeImports(server);
if (isEnabled("getCodeFixes")) getCodeFixes(server);
if (isEnabled("extractFunction")) extractFunction(server);
if (isEnabled("extractConstant")) extractConstant(server);
if (isEnabled("moveSymbol")) moveSymbol(server);
if (isEnabled("inlineVariable")) inlineVariable(server);
if (isEnabled("extractType")) extractType(server);
if (isEnabled("inferReturnType")) inferReturnType(server);
if (isEnabled("quickinfo")) quickinfo(server);
if (isEnabled("navtree")) navtree(server);
if (isEnabled("definition")) definition(server);
if (isEnabled("navto")) navto(server);
if (isEnabled("fileReferences")) fileReferences(server);
if (isEnabled("prepareCallHierarchy")) prepareCallHierarchy(server);
if (isEnabled("provideCallHierarchyIncomingCalls"))
  provideCallHierarchyIncomingCalls(server);
if (isEnabled("provideCallHierarchyOutgoingCalls"))
  provideCallHierarchyOutgoingCalls(server);
if (isEnabled("typeDefinition")) typeDefinition(server);
if (isEnabled("implementation")) implementation(server);
if (isEnabled("projectInfo")) projectInfo(server);
if (isEnabled("completionInfo")) completionInfo(server);
if (isEnabled("completionEntryDetails")) completionEntryDetails(server);
if (isEnabled("signatureHelp")) signatureHelp(server);
if (isEnabled("documentHighlights")) documentHighlights(server);
if (isEnabled("getApplicableRefactors")) getApplicableRefactors(server);
if (isEnabled("docCommentTemplate")) docCommentTemplate(server);
if (isEnabled("getOutliningSpans")) getOutliningSpans(server);
if (isEnabled("provideInlayHints")) provideInlayHints(server);
if (isEnabled("getCombinedCodeFix")) getCombinedCodeFix(server);
if (isEnabled("todoComments")) todoComments(server);
if (isEnabled("definitionAndBoundSpan")) definitionAndBoundSpan(server);
if (isEnabled("findSourceDefinition")) findSourceDefinition(server);
if (isEnabled("selectionRange")) selectionRange(server);
if (isEnabled("format")) format(server);
if (isEnabled("getMoveToRefactoringFileSuggestions"))
  getMoveToRefactoringFileSuggestions(server);
if (isEnabled("getSupportedCodeFixes")) getSupportedCodeFixes(server);
if (isEnabled("mapCode")) mapCode(server);

const transport = new StdioServerTransport();
await server.connect(transport);
