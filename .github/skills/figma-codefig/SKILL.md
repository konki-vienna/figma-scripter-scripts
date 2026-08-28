---
name: Figma CodeFig Script Assistant
description: Write and update TypeScript snippets for the Figma CodeFig plugin environment in this repository.
---

# Figma CodeFig Script Assistant

Use this skill when working with CodeFig scripts in this repository.

## Project Context

- This repo contains standalone scripts for Figma automation workflows.
- CodeFig-specific scripts should live in `codeFig/*.ts`.
- Scripts are intended to run in the CodeFig plugin context.
- Keep scripts copy/paste friendly and self-contained.

## Coding Rules

- Write CodeFig scripts in plain JavaScript syntax, even when the file extension is `.ts`.
- Do not use TypeScript-only syntax in CodeFig scripts (no type annotations, no type predicates, no `as` casts, no interfaces, no generics).
- Do not add module imports/exports unless the target runtime explicitly requires it.
- Keep configuration values grouped in a `CONFIG` object near the top.
- Wrap execution in a clear entrypoint (`run()` or IIFE) with error handling.
- Use async Figma APIs where appropriate.
- In dynamic-page contexts, use `await figma.setCurrentPageAsync(page)` instead of assigning `figma.currentPage = page`.
- In dynamic-page contexts, call `await figma.loadAllPagesAsync()` before using `figma.root.findOne`, `figma.root.findAll`, or cross-page component lookups.
- Log useful progress and failures with `console.log`, `console.warn`, and `console.error`.
- Guard console calls in CodeFig scripts (`typeof console?.method === "function"`) before invoking `console.clear`, `console.log`, `console.warn`, or `console.error`.
- Avoid dependencies and build steps unless explicitly requested.
- For every script, provide a brief description of its purpose and usage in the header comment.
- For every script, provide a `console.clear()` at the start of execution to reduce noise in the console.

## Runtime Caveats

- CodeFig execution context can differ from Scripter and full plugin builds.
- Prefer defensive checks for missing globals, unavailable APIs, or unsupported node types.
- Fail fast with actionable error messages when required context is missing.
- `figma.closePlugin` may be unavailable in some CodeFig contexts; guard calls before invoking.
- Some embedded runtimes may provide a partial `console`; avoid direct unguarded console method calls.
- With `documentAccess: dynamic-page`, direct current-page assignment can fail; prefer async page switching and then query nodes from the resolved page reference.
- With `documentAccess: dynamic-page`, root-level searches can fail unless all pages were loaded first.

## References

- CodeFig plugin page: https://www.figma.com/community/plugin/1620556386343160879/codefig
- Use this skill's repo-specific conventions first.

## Style Expectations

- Keep scripts small and practical.
- Add brief comments only where logic is not obvious.
- Preserve existing naming and formatting style in edited files.

## Output Checklist

Before finishing, ensure:

- The snippet runs as a single file in the intended CodeFig environment.
- The snippet is valid JavaScript and contains no TypeScript syntax.
- String literals are properly closed and escaped.
- No Node.js-only APIs are used unless explicitly requested.
- The script fails with clear error messages when required data is missing.
- The script provides a `figma.notify` message on success or failure when available.
