# pi-dynamic-settings

Pi extension: per-mode sampling parameters only. Pi continues as a full agent harness.

## Sister project

This extension has a sister project, `pi-dynamic-chat`, which shares the same
mode names and parameter values but also replaces the system prompt and restricts tools.

If the sister project is found at `../pi-dynamic-chat`, keep both in sync:

- When modifying shared code (config loading, param injection, status bar,
  mode enable/disable logic), apply the same changes there.
- Keep mode names and parameter values aligned between both `config.json` files.
- The structural difference: the chat extension replaces the system prompt and
  disables bash. This extension leaves everything alone and only injects params.
