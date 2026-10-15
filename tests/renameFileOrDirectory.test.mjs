import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = resolve("dist/index.js");

async function fixture(t, env = {}, { directory = false, referenced = true } = {}) {
  const root = await mkdtemp(join(tmpdir(), "ts-mcp-move-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const from = join(root, directory ? "src/old/module.ts" : "src/old.ts");
  const to = join(root, directory ? "src/nested/moved/module.ts" : "src/nested/new.ts");
  const consumer = join(root, "src/index.ts");
  const source = referenced
    ? `import { value } from "${directory ? "../" : "./"}value";\nexport const result = value;\n`
    : "export const result = 42;\n";
  const consumerSource = `export { result } from "./${directory ? "old/module" : "old"}";\n`;
  await mkdir(dirname(from), { recursive: true });
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { module: "commonjs", target: "es2020", strict: true },
    include: ["src/**/*.ts"],
  }));
  await writeFile(from, source);
  if (referenced) {
    await writeFile(join(root, "src/value.ts"), "export const value = 42;\n");
    await writeFile(consumer, consumerSource);
  }
  const client = new Client({ name: "move-output-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: root,
    env: { ...process.env, TS_MCP_RESPONSE_MODE: "full", ...env },
    stderr: "pipe",
  });
  t.after(() => client.close());
  await client.connect(transport);
  const moveFrom = directory ? dirname(from) : from;
  const moveTo = directory ? dirname(to) : to;
  return {
    from, to, moveFrom, moveTo, consumer, source, consumerSource,
    call: (args = {}) => client.callTool({
      name: "getEditsForFileRename",
      arguments: { from: moveFrom, to: moveTo, preview: false, ...args },
    }),
  };
}

function body(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0].type, "text");
  return JSON.parse(result.content[0].text);
}

async function assertMoved(f, directory = false) {
  assert.equal(existsSync(f.from), false);
  assert.equal(await readFile(f.to, "utf8"),
    `import { value } from "${directory ? "../../" : "../"}value";\nexport const result = value;\n`);
  assert.equal(await readFile(f.consumer, "utf8"),
    `export { result } from "./${directory ? "nested/moved/module" : "nested/new"}";\n`);
}

function assertSummary(output, f, count = 2) {
  assert.deepEqual(output, {
    success: true,
    from: f.moveFrom,
    to: f.moveTo,
    updatedFileCount: count,
  });
}

function assertFull(output, f) {
  assert.deepEqual(Object.keys(output).sort(), ["edits", "updatedFiles"]);
  assert.equal(output.edits.length, 2);
  assert.deepEqual(new Set(output.updatedFiles), new Set([f.from, f.consumer]));
  assert.ok(output.edits.every(edit => edit.textChanges.length > 0));
}

test("default output retains edits and applies incoming/outgoing import updates", async t => {
  const f = await fixture(t, { TS_MCP_RESPONSE_MODE: "" });
  assertFull(body(await f.call()), f);
  await assertMoved(f);
});

test("per-call summary omits edits while moving the file and updating imports", async t => {
  const f = await fixture(t);
  assertSummary(body(await f.call({ responseMode: "summary" })), f);
  await assertMoved(f);
});

test("environment summary applies to directory moves and updates imports", async t => {
  const f = await fixture(t, { TS_MCP_RESPONSE_MODE: "summary" }, { directory: true });
  assertSummary(body(await f.call()), f);
  await assertMoved(f, true);
});

test("explicit full output overrides environment summary", async t => {
  const f = await fixture(t, { TS_MCP_RESPONSE_MODE: "summary" });
  assertFull(body(await f.call({ responseMode: "full" })), f);
  await assertMoved(f);
});

test("unknown environment mode preserves full output", async t => {
  const f = await fixture(t, { TS_MCP_RESPONSE_MODE: "unknown" });
  assertFull(body(await f.call()), f);
  await assertMoved(f);
});

test("summary-enabled preview returns complete edits without modifying files", async t => {
  const f = await fixture(t, { TS_MCP_RESPONSE_MODE: "summary" });
  const output = body(await f.call({ preview: true, responseMode: "summary" }));
  assert.equal(Array.isArray(output), true);
  assert.equal(output.length, 2);
  assert.deepEqual(new Set(output.map(edit => edit.fileName)), new Set([f.from, f.consumer]));
  assert.ok(output.every(edit => edit.textChanges.length > 0));
  assert.equal(await readFile(f.from, "utf8"), f.source);
  assert.equal(await readFile(f.consumer, "utf8"), f.consumerSource);
  assert.equal(existsSync(f.to), false);
});

test("summary reports zero updated files when a moved file has no references", async t => {
  const f = await fixture(t, {}, { referenced: false });
  assertSummary(body(await f.call({ responseMode: "summary" })), f, 0);
  assert.equal(existsSync(f.from), false);
  assert.equal(await readFile(f.to, "utf8"), f.source);
});

test("failed moves retain tool errors in summary mode", async t => {
  const f = await fixture(t);
  const result = await f.call({ from: `${f.from}.missing`, responseMode: "summary" });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /ENOENT/);
  assert.equal(await readFile(f.from, "utf8"), f.source);
  assert.equal(existsSync(f.to), false);
});

test("unsupported per-call mode is rejected without moving files", async t => {
  const f = await fixture(t);
  const result = await f.call({ responseMode: "unknown" });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /responseMode/);
  assert.equal(await readFile(f.from, "utf8"), f.source);
  assert.equal(existsSync(f.to), false);
});

test("relative move paths produce absolute paths in the summary", async t => {
  const f = await fixture(t);
  assertSummary(body(await f.call({
    from: "src/old.ts",
    to: "src/nested/new.ts",
    responseMode: "summary",
  })), f);
  await assertMoved(f);
});
