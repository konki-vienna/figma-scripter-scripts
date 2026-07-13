---
name: Figma Scripter Snippet Assistant
description: Write and update TypeScript snippets for the Figma Plugin Scripter environment in this repository.
---

# Figma Scripter Snippet Assistant

Use this skill when working in this repository.

## Project Context

- This repo contains standalone TypeScript snippets for the Figma Plugin Scripter plugin.
- Scripts live in `scripts/*.ts`.
- Scripts are executed directly in Scripter (not as a full plugin with `manifest.json`).
- Keep scripts copy/paste friendly and self-contained.

## Coding Rules

- Do not add module imports/exports.
- Prefer `declare const figma: any;` (or local `figmaApi` from `globalThis`) for compatibility.
- Keep configuration values grouped in a `CONFIG` object near the top.
- Wrap execution in a clear entrypoint (`run()` or IIFE) with error handling.
- Use `async` Figma APIs where appropriate (for example `getLocalVariableCollectionsAsync`).
- Log useful progress and failures with `console.log`, `console.warn`, and `console.error`.
- Avoid dependencies and build steps.
- For every script, provide a brief description of its purpose and usage in the header comment.
- For every script, provide a console.clear() at the start of execution to reduce noise in the console.

## Scripter Window Caveat

- `createWindow` callbacks may run in an isolated context.
- Do not rely on outer-scope helper functions inside window callbacks.
- Define callback-local helpers when messaging between script and window.

## References

- Primary Scripter reference: https://scripter.rsms.me/
- Use this skill's repo-specific conventions first. Use the Scripter reference to confirm runtime behavior, available globals, and supported APIs.

## Style Expectations

- Keep scripts small and practical.
- Add brief comments only where logic is not obvious.
- Preserve existing naming and formatting style in edited files.

## Output Checklist

Before finishing, ensure:

- The snippet can run as a single file in Scripter.
- No Node.js-only APIs are used.
- The script fails with clear error messages when required data is missing.
- The script provides a Figma.notify message on success or failure.
