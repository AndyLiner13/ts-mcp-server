import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = resolve("dist/index.js");

export async function fixture(t, { directory = false, fault } = {}) {
  const root = await mkdtemp(join(tmpdir(), "ts-mcp-safe-move-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const from = join(root, directory ? "src/old/module.ts" : "src/old.ts");
  const to = join(root, directory ? "src/nested/moved/module.ts" : "src/nested/new.ts");
  const consumer = join(root, "src/index.ts");
  const source = `import { value } from "${directory ? "../" : "./"}value";\nexport const result = value;\n`;
  const consumerSource = `export { result } from "./${directory ? "old/module" : "old"}";\n`;
  await mkdir(dirname(from), { recursive: true });
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({
    compilerOptions: { module: "commonjs", target: "es2020", strict: true },
    include: ["src/**/*.ts"],
  }));
  await writeFile(from, source);
  await writeFile(join(root, "src/value.ts"), "export const value = 42;\n");
  await writeFile(consumer, consumerSource);
  const client = new Client({ name: "move-safety-test", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [...(fault ? ["--import", resolve("tests/helpers/fail-move.mjs")] : []), serverPath],
    cwd: root,
    env: { ...process.env, TS_MCP_TEST_FAULT: fault ?? "" },
    stderr: "pipe",
  }));
  const moveFrom = directory ? dirname(from) : from;
  const moveTo = directory ? dirname(to) : to;
  return {
    root, from, to, moveFrom, moveTo, consumer, source, consumerSource,
    readSource: () => readFile(from, "utf8"),
    readConsumer: () => readFile(consumer, "utf8"),
    call: (args = {}) => client.callTool({
      name: "getEditsForFileRename",
      arguments: { from: moveFrom, to: moveTo, preview: false, ...args },
    }),
  };
}
