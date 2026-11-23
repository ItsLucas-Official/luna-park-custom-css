# AGENTS.md: working on the Custom CSS plugin

Guide for AI agents (and humans in a hurry) working on this repository.
Read this first, then `src/features/stylesheets/README.md`. For the Luna Park plugin API in general, see the [plugin boilerplate](https://github.com/lunapark/plugin-boilerplate) (`AGENTS.md`, `docs/`).

## What this repo is
- A Luna Park plugin: an ES module whose default export is `makePlugin({...})` (`src/index.ts`).
- It lets users write CSS by hand in separate files (plugin workspace, CodeMirror editor) and import them on a whole page or component through an element panel (offered on the root element only, see `isRootElement`) + Vue directive.
- The Luna Park editor loads it in the browser. When a project is exported, the compiler uses `build` to generate a Vue + Fastify app.

## Commands
```bash
pnpm install
pnpm typecheck   # vue-tsc -b  (must pass)
pnpm lint        # eslint      (must pass; `pnpm lint:fix` auto-sorts object keys)
pnpm build       # vite build → dist/{index,runtime}.js
pnpm preview     # luna-preview on http://127.0.0.1:2084 (install that URL in the editor)
```

## Layout
| Path | Role |
|---|---|
| `src/index.ts` | `makePlugin`: identity, `internals`, lifecycle, element panel, build injection, workspace section |
| `src/meta.ts` | `PLUGIN_ID`, package name, `RUNTIME_TARGET`, `packageImport` |
| `src/features/internals/internals.ts` | Persisted state: `internals.stylesheets` (id → `{ id, name, css, global, order?, scoped? }`) |
| `src/features/stylesheets/runtime.ts` | **Runtime** (editor canvas + exported apps): `registerStylesheets`, ref-counted `<style>` tags kept in file order, `@scope` wrapping, `vStylesheets` directive |
| `src/features/stylesheets/cssTools.ts` | Pure `formatCss` / `minifyCss` (no dependency) |
| `src/features/stylesheets/canvasSelectors.ts` | Editor only: splits a file's CSS into the rules for the page itself (`html`, `body`, `:root`, sent to the canvas's page area, `[data-ui="preview-content"]` or `[data-ui="preview-maximized"]`) and the rest (wrapped in `@scope ([data-root])`) |
| `src/features/stylesheets/cssVariables.ts` | Editor only: CSS variable names for autocompletion |
| `src/features/stylesheets/state.ts` | Editor only: pushes `internals` into the runtime on change, create/delete/reorder/import/export helpers, selected file |
| `src/features/stylesheets/index.ts` | Element panel, workspace section, `getStylesheetInjections` (`AppSetup`) |
| `src/features/stylesheets/*.vue` | Workspace sections (Files, File settings, Editor), code editor (CodeMirror), element panel UI |
| `src/entries/runtime.ts` | `<package>/runtime`, imported by exported apps |

## Hard rules (Luna Park plugin system)
1. **Ids are forever.** Never rename `PLUGIN_ID`, the element panel `id` (`stylesheets`) or the stored stylesheet ids once published: projects store them.
2. **Bundle boundaries.** `runtime` = browser + Vue only. It must not import `@luna-park/design`, `@luna-park/plugin`, CodeMirror or editor-only Vue files. CodeMirror stays in the `index` bundle.
3. **Generated code mirrors the editor.** The `AppSetup` injection calls `registerStylesheets` with the same data the editor pushes. Escape `<` in the JSON so a `</script>` in CSS can't break the SFC.
4. **`env` in build mode** has no `addFile`, `getFile`, `log` or `backend`. Option functions must work with `mode: "build"`.
5. **`internals` is shallow-merged** from the saved project: every field needs a default, and a saved top-level key replaces its default entirely. Fields added to a stylesheet entry after 1.0.0 (`order`, `scoped`) are optional, so projects saved by 1.0.0 keep loading.
6. **Prefix everything global** (`data-css-files` attribute, CSS variables, routes).
7. **Editor UI** (workspace section, panel) may use the editor's CSS variables (`--color-*`, `--length-*`) and `@luna-park/design`. Runtime code must not.
8. **Limits of the API**: plugins cannot add file types or explorer context menu entries, so CSS files live in `internals`, not in the explorer.

## Before finishing a change
- [ ] `pnpm typecheck` and `pnpm lint` pass; `pnpm build` succeeds.
- [ ] New runtime exports are added to `src/entries/runtime.ts`.
- [ ] Generated code paths (`getStylesheetInjections`) mirror the editor behaviour.
- [ ] `src/features/stylesheets/README.md` (and `README.md`) are updated.
