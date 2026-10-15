import {
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join, sep } from "path";
import type ts from "typescript";

let pendingMove = Promise.resolve();

// Keep edit calculation and application in the same serialized operation.
export function serializeFileMove<T>(operation: () => Promise<T>): Promise<T> {
  const result = pendingMove.then(operation);
  pendingMove = result.then(() => undefined, () => undefined);
  return result;
}

function assertDestinationMissing(path: string): void {
  // lstat also detects dangling links, which existsSync would miss.
  if (lstatSync(path, { throwIfNoEntry: false })) {
    throw new Error(`Destination already exists: ${path}`);
  }
}

export function validateFileMove(from: string, to: string): string[] {
  assertDestinationMissing(to);
  if (statSync(from).isDirectory() && to.startsWith(`${from}${sep}`)) {
    throw new Error(`Cannot move a directory into itself: ${to}`);
  }
  const missing: string[] = [];
  for (let parent = dirname(to); ; parent = dirname(parent)) {
    const stat = statSync(parent, { throwIfNoEntry: false });
    if (stat) {
      if (!stat.isDirectory()) {
        throw new Error(`Destination parent is not a directory: ${parent}`);
      }
      return missing;
    }
    missing.unshift(parent);
  }
}

function discardBackup(path: string): void {
  try {
    rmSync(path, { recursive: true, force: true });
  } catch (error: unknown) {
    // The move/recovery already completed; keep recoverable data on cleanup failure.
    console.error(`Could not remove file move backup ${path}: ${String(error)}`);
  }
}

export async function applyFileMove(
  from: string,
  to: string,
  edits: readonly ts.FileTextChanges[],
  applyEdits: (edits: readonly ts.FileTextChanges[]) => Promise<string[]>,
  reload: (files: readonly string[], removed: readonly string[]) => Promise<void>,
): Promise<string[]> {
  const parents = validateFileMove(from, to);
  const backupDirectory = mkdtempSync(join(tmpdir(), "ts-mcp-move-backup-"));
  const backups = new Map<string, string | null>();
  const created: string[] = [];
  let editing = false;
  let updated: string[];

  try {
    // Snapshot every affected file before the first write, including tsconfig edits.
    for (const edit of edits) {
      if (edit.textChanges.length === 0 || backups.has(edit.fileName)) continue;
      if (edit.isNewFile) {
        assertDestinationMissing(edit.fileName);
        backups.set(edit.fileName, null);
      } else {
        const backup = join(backupDirectory, String(backups.size));
        copyFileSync(edit.fileName, backup);
        backups.set(edit.fileName, backup);
      }
    }
    writeFileSync(
      join(backupDirectory, "manifest.json"),
      JSON.stringify(Object.fromEntries(backups)),
      { mode: 0o600 },
    );
    for (const parent of parents) {
      mkdirSync(parent);
      created.push(parent);
    }
    editing = true;
    updated = await applyEdits(edits);
    // Recheck after awaited writes/reloads, before rename can overwrite anything.
    assertDestinationMissing(to);
    renameSync(from, to);
  } catch (error: unknown) {
    const failures: unknown[] = [];
    if (editing) {
      for (const [file, backup] of backups) {
        try {
          if (backup === null) {
            if (lstatSync(file, { throwIfNoEntry: false })) unlinkSync(file);
          } else if (!readFileSync(file).equals(readFileSync(backup))) {
            copyFileSync(backup, file);
          }
        } catch (recoveryError: unknown) {
          failures.push(recoveryError);
        }
      }
    }
    for (const parent of created.reverse()) {
      try {
        rmdirSync(parent);
      } catch (recoveryError: unknown) {
        failures.push(recoveryError);
      }
    }
    if (editing) {
      try {
        await reload(
          [...backups].filter(([, backup]) => backup !== null).map(([file]) => file),
          [...backups].filter(([, backup]) => backup === null).map(([file]) => file),
        );
      } catch (recoveryError: unknown) {
        failures.push(recoveryError);
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `Move failed: ${String(error)}. Recovery incomplete: ${failures.map(String).join("; ")}. Original file backups retained at ${backupDirectory}`,
        { cause: error },
      );
    }
    discardBackup(backupDirectory);
    throw error;
  }

  discardBackup(backupDirectory);
  return updated;
}
