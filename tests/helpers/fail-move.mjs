// Inject one operation failure in the test server, without production test hooks.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";

const scenario = process.env.TS_MCP_TEST_FAULT;
const consumer = join(process.cwd(), "src/index.ts");
const source = join(process.cwd(), "src/old.ts");
const write = fs.writeFileSync;
const rename = fs.renameSync;
let failed = false;

fs.writeFileSync = function (path, ...args) {
  if (!failed && scenario === "write" && path === consumer) {
    failed = true;
    throw new Error("Injected write failure");
  }
  return write.call(this, path, ...args);
};
fs.renameSync = function (from, ...args) {
  if (!failed && scenario === "rename" && from === source) {
    failed = true;
    throw new Error("Injected rename failure");
  }
  return rename.call(this, from, ...args);
};
syncBuiltinESMExports();
