# File move failure handling

File/directory moves reject existing destinations, including empty directories
and dangling symbolic links. Invalid parent paths and attempts to move a directory
inside itself are rejected before applying import edits. Preview returns the full
TypeScript edit list without creating directories or changing files.

Before applying edits, the move operation snapshots affected files in a temporary
backup directory. If edit application or the final rename fails, the operation
restores original contents, removes files created by the edits, removes empty
parent directories it created, and reloads restored files in the TypeScript
service. A failed move returns `isError: true`; successful responses keep the
existing `edits` and `updatedFiles` fields.

If restoring files, removing created directories, or reloading the service fails,
the error explicitly reports incomplete recovery and the retained backup directory.
Its `manifest.json` maps original absolute file paths to their backup copies;
`null` entries identify files that did not exist before the operation. Backups are
removed after successful moves or recovery. A backup cleanup failure is logged to
stderr and leaves the backups available rather than undoing a completed move.

Move calls are serialized within the server, and the destination is checked again
after awaited edit application. This is recovery for caught operation failures,
not an OS-wide transaction or crash journal. Do not modify affected files through
other tools/processes concurrently. There is no OS-level exclusive rename against
external processes; cross-filesystem moves still fail rather than copying files.
The changes have been exercised on Linux; Windows/macOS filesystem behavior has
not been verified.

Run `pnpm test` for real MCP/TypeScript regressions plus deterministic filesystem
failure tests. The tests cover existing destinations, invalid parents, partial
writes, rename failures, recovery failures, retries, and unchanged previews.
