import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { applyFileMove, serializeFileMove } from "../dist/tools/fileMove.js";

function fixture(t, nested = true) {
  const root = fs.mkdtempSync(join(tmpdir(), "ts-mcp-transaction-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const from = join(root, "old.ts");
  const consumer = join(root, "consumer.ts");
  const to = join(root, nested ? "new-parent/deep/new.ts" : "new.ts");
  const original = Buffer.from([0, 1, 13, 10, 255]);
  fs.writeFileSync(from, original);
  fs.writeFileSync(consumer, "original consumer\r\n");
  const edit = fileName => ({
    fileName, textChanges: [{ span: { start: 0, length: 1 }, newText: "changed" }],
  });
  return { root, from, to, consumer, original, edits: [edit(from), edit(consumer)], edit };
}

function patch(t, name, implementation) {
  const stub = t.mock.method(fs, name, implementation);
  syncBuiltinESMExports();
  t.after(() => { stub.mock.restore(); syncBuiltinESMExports(); });
}

test("partial writes restore byte-for-byte originals, remove new files and empty parents", async t => {
  const f = fixture(t);
  const added = join(f.root, "added.ts");
  const edits = [...f.edits, { ...f.edit(added), isNewFile: true }];
  let reloaded = false;
  await assert.rejects(applyFileMove(f.from, f.to, edits, async () => {
    fs.writeFileSync(f.from, "partly changed source");
    fs.writeFileSync(f.consumer, "partly changed consumer");
    fs.writeFileSync(added, "new file");
    throw new Error("simulated partial write");
  }, async (files, removed) => {
    assert.deepEqual(new Set(files), new Set([f.from, f.consumer]));
    assert.deepEqual(removed, [added]);
    assert.deepEqual(fs.readFileSync(f.from), f.original);
    assert.equal(fs.readFileSync(f.consumer, "utf8"), "original consumer\r\n");
    reloaded = true;
  }), /simulated partial write/);
  assert.deepEqual(fs.readFileSync(f.from), f.original);
  assert.equal(fs.readFileSync(f.consumer, "utf8"), "original consumer\r\n");
  assert.equal(fs.existsSync(added), false);
  assert.equal(fs.existsSync(join(f.root, "new-parent")), false);
  assert.equal(reloaded, true);
});

test("a destination appearing during edit application is preserved and originals restored", async t => {
  const f = fixture(t, false);
  await assert.rejects(applyFileMove(f.from, f.to, f.edits, async () => {
    fs.writeFileSync(f.from, "changed source");
    fs.writeFileSync(f.consumer, "changed consumer");
    fs.writeFileSync(f.to, "valuable late destination");
    return [f.from, f.consumer];
  }, async () => {}), /Destination already exists/);
  assert.deepEqual(fs.readFileSync(f.from), f.original);
  assert.equal(fs.readFileSync(f.consumer, "utf8"), "original consumer\r\n");
  assert.equal(fs.readFileSync(f.to, "utf8"), "valuable late destination");
});

test("snapshot failure occurs before edits or creation of destination parents", async t => {
  const f = fixture(t);
  await assert.rejects(applyFileMove(f.from, f.to,
    [...f.edits, f.edit(join(f.root, "missing.ts"))], async () => {
      fs.writeFileSync(f.from, "should never reach editing");
      return [];
    }, async () => {}), /ENOENT/);
  assert.deepEqual(fs.readFileSync(f.from), f.original);
  assert.equal(fs.readFileSync(f.consumer, "utf8"), "original consumer\r\n");
  assert.equal(fs.existsSync(join(f.root, "new-parent")), false);
});

test("failed restoration reports the error and retains recoverable original backups", async t => {
  const f = fixture(t);
  const copy = fs.copyFileSync;
  patch(t, "copyFileSync", (source, target, ...rest) => {
    if (target === f.from) throw new Error("restore denied");
    return copy(source, target, ...rest);
  });
  let retained;
  await assert.rejects(applyFileMove(f.from, f.to, f.edits, async () => {
    fs.writeFileSync(f.from, "changed source");
    throw new Error("initial write failed");
  }, async () => {}), error => {
    assert.match(error.message, /initial write failed/);
    assert.match(error.message, /Recovery incomplete:.*restore denied/);
    retained = error.message.match(/Original file backups retained at (.+)$/)[1];
    t.after(() => fs.rmSync(retained, { recursive: true, force: true }));
    return true;
  });
  const manifest = JSON.parse(fs.readFileSync(join(retained, "manifest.json"), "utf8"));
  assert.deepEqual(fs.readFileSync(manifest[f.from]), f.original);
  assert.equal(fs.readFileSync(manifest[f.consumer], "utf8"), "original consumer\r\n");
  assert.equal(fs.readFileSync(f.from, "utf8"), "changed source");
  assert.equal(fs.existsSync(dirname(f.to)), false);
});

test("failed service reload is explicit and retains originals for recovery", async t => {
  const f = fixture(t);
  let retained;
  await assert.rejects(applyFileMove(f.from, f.to, f.edits, async () => {
    fs.writeFileSync(f.from, "changed source");
    throw new Error("initial failure");
  }, async () => { throw new Error("reload failed"); }), error => {
    assert.match(error.message, /Recovery incomplete:.*reload failed/);
    retained = error.message.match(/Original file backups retained at (.+)$/)[1];
    t.after(() => fs.rmSync(retained, { recursive: true, force: true }));
    return true;
  });
  assert.deepEqual(fs.readFileSync(f.from), f.original);
  const manifest = JSON.parse(fs.readFileSync(join(retained, "manifest.json"), "utf8"));
  assert.deepEqual(fs.readFileSync(manifest[f.from]), f.original);
  assert.equal(fs.existsSync(join(f.root, "new-parent")), false);
});

test("move transactions are serialized and a failure does not block the next operation", async () => {
  const release = Promise.withResolvers();
  const events = [];
  const first = serializeFileMove(async () => {
    events.push("first started");
    await release.promise;
    events.push("first failed");
    throw new Error("first failure");
  });
  const rejected = assert.rejects(first, /first failure/);
  const second = serializeFileMove(async () => {
    events.push("second started");
    return "second completed";
  });
  await Promise.resolve();
  assert.deepEqual(events, ["first started"]);
  release.resolve();
  await rejected;
  assert.equal(await second, "second completed");
  assert.deepEqual(events, ["first started", "first failed", "second started"]);
});
