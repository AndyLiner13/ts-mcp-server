import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, readlink, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fixture } from "./helpers/move-fixture.mjs";

async function assertUnchanged(f) {
  assert.equal(await f.readSource(), f.source);
  assert.equal(await f.readConsumer(), f.consumerSource);
}

for (const kind of ["file", "directory", "dangling symlink"]) {
  test(`existing destination ${kind} is rejected without editing files`, async t => {
    const f = await fixture(t);
    await mkdir(dirname(f.to), { recursive: true });
    if (kind === "file") await writeFile(f.to, "valuable destination\n");
    if (kind === "directory") await mkdir(f.to);
    if (kind === "dangling symlink") await symlink("missing-target", f.to);
    const result = await f.call();
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /destination.*exist/i);
    await assertUnchanged(f);
    if (kind === "file") assert.equal(await readFile(f.to, "utf8"), "valuable destination\n");
    if (kind === "directory") assert.equal(existsSync(f.to), true);
    if (kind === "dangling symlink") assert.equal(await readlink(f.to), "missing-target");
  });
}

test("directory source cannot replace an existing empty directory", async t => {
  const f = await fixture(t, { directory: true });
  await mkdir(f.moveTo, { recursive: true });
  const result = await f.call();
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /destination.*exist/i);
  await assertUnchanged(f);
  assert.equal(existsSync(f.moveTo), true);
  assert.equal(existsSync(f.to), false);
});

test("invalid destination parent leaves imports unchanged", async t => {
  const f = await fixture(t);
  const block = join(f.root, "src/block");
  await writeFile(block, "parent is a file\n");
  const result = await f.call({ to: join(block, "new.ts") });
  assert.equal(result.isError, true);
  await assertUnchanged(f);
  assert.equal(await readFile(block, "utf8"), "parent is a file\n");
  assert.equal(existsSync(join(block, "new.ts")), false);
});

test("a directory cannot be moved into itself", async t => {
  const f = await fixture(t, { directory: true });
  const nested = join(f.moveFrom, "new-parent/moved");
  const result = await f.call({ to: nested });
  assert.equal(result.isError, true);
  await assertUnchanged(f);
  assert.equal(existsSync(dirname(nested)), false);
});

for (const directory of [false, true]) {
  test(`successful ${directory ? "directory" : "file"} move updates imports and retains full response`, async t => {
    const f = await fixture(t, { directory });
    const result = await f.call();
    assert.notEqual(result.isError, true, JSON.stringify(result));
    const body = JSON.parse(result.content[0].text);
    assert.deepEqual(Object.keys(body).sort(), ["edits", "updatedFiles"]);
    assert.deepEqual(new Set(body.updatedFiles), new Set([f.from, f.consumer]));
    assert.equal(existsSync(f.from), false);
    assert.equal(await readFile(f.to, "utf8"),
      `import { value } from "${directory ? "../../" : "../"}value";\nexport const result = value;\n`);
    assert.equal(await f.readConsumer(),
      `export { result } from "./${directory ? "nested/moved/module" : "nested/new"}";\n`);
  });
}

test("preview returns edits without creating parent directories or changing imports", async t => {
  const f = await fixture(t);
  const result = await f.call({ preview: true });
  assert.notEqual(result.isError, true, JSON.stringify(result));
  const body = JSON.parse(result.content[0].text);
  assert.equal(body.length, 2);
  assert.deepEqual(new Set(body.map(edit => edit.fileName)), new Set([f.from, f.consumer]));
  assert.ok(body.every(edit => edit.textChanges.length > 0));
  await assertUnchanged(f);
  assert.equal(existsSync(dirname(f.to)), false);
});

for (const fault of ["write", "rename"]) {
  test(`${fault} failure restores files and permits a valid retry in the same session`, async t => {
    const f = await fixture(t, { fault });
    const result = await f.call();
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, new RegExp(`Injected ${fault} failure`));
    await assertUnchanged(f);
    assert.equal(existsSync(dirname(f.to)), false);
    const retried = await f.call();
    assert.notEqual(retried.isError, true, JSON.stringify(retried));
    assert.equal(existsSync(f.from), false);
    assert.equal(await readFile(f.to, "utf8"),
      'import { value } from "../value";\nexport const result = value;\n');
    assert.equal(await f.readConsumer(), 'export { result } from "./nested/new";\n');
  });
}

for (const directory of [false, true]) {
  test(`successful ${directory ? "directory" : "file"} move returns the exact preview edits`, async t => {
    const f = await fixture(t, { directory });
    const preview = await f.call({ preview: true });
    assert.notEqual(preview.isError, true, JSON.stringify(preview));
    const expected = JSON.parse(preview.content[0].text);
    assert.equal(expected.length, 2);
    const sourceReference = directory ? "../value" : "./value";
    const consumerReference = directory ? "./old/module" : "./old";
    assert.deepEqual(
      new Map(expected.map(({ fileName, textChanges }) => [fileName, textChanges])),
      new Map([
        [f.from, [{
          span: { start: f.source.indexOf(sourceReference), length: sourceReference.length },
          newText: directory ? "../../value" : "../value",
        }]],
        [f.consumer, [{
          span: { start: f.consumerSource.indexOf(consumerReference), length: consumerReference.length },
          newText: directory ? "./nested/moved/module" : "./nested/new",
        }]],
      ]),
    );
    const moved = await f.call();
    assert.notEqual(moved.isError, true, JSON.stringify(moved));
    assert.deepEqual(JSON.parse(moved.content[0].text).edits, expected);
  });
}
