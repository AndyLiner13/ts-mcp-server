# File Move Response Mode

File/directory moves return full edits and `updatedFiles` by default. To reduce
response size after applying a move, set `TS_MCP_RESPONSE_MODE` to `"summary"` in
your MCP server's `env` configuration. Unset or other values preserve full output.
The optional per-call `responseMode` (`"full"` or `"summary"`) overrides this default.
This setting only affects file/directory moves; other tools retain their output.

Summary mode returns only:

```json
{
  "success": true,
  "from": "/project/src/old.ts",
  "to": "/project/src/shared/new.ts",
  "updatedFileCount": 18
}
```

`from` and `to` are absolute paths. `updatedFileCount` counts files whose contents
were updated by `writeEdits`, including import changes inside the moved file. It
does not count a path move alone; a file with no references or import changes can
be moved successfully with a count of zero. The move and all calculated import
updates are applied in both modes. Preview always returns complete edits without
writing, regardless of response mode, and errors keep their existing error output.

Run `pnpm test` from the repository root to build and exercise both modes through real MCP calls against
temporary TypeScript projects.
