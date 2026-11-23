# Custom CSS feature

Write CSS by hand in separate files, in the plugin workspace, and import them on a whole page or component instead of pasting custom CSS into an injection.

## Usage
1. Open the plugin's workspace (plugin button in the editor header) → **Files** → **New file**. The workspace has three sections: **Files** (tiles), **File settings** (name, Global, duplicate, delete) and **Editor**.
2. Write your CSS in the code editor (syntax highlighting, line numbers, code folding, autocompletion, auto-closing brackets, Tab to indent). Everything is saved automatically.
3. Open a page or component, select its **top-level element** → inspector → **Custom CSS** → turn **Enable custom CSS** on, then pick files in the **Add a CSS file** drop-down (the cross next to a file removes it). Turning the switch off loads nothing on that page but keeps its list. The panel is only offered on that root element (the plugin API has no page-level settings), and the CSS applies to the whole page, or to every use of the component.
4. Optional: turn on **Global** to load a file on every page without importing it, or **Scoped** to limit it to the importing page or component.

The workspace has four sections: **Files** (tiles in load order, plus New file and Import), **File settings**, **Editor** and **Export**.
- **Load order**: files load in the order shown (the number on each tile). A later file wins over an earlier one at equal specificity. Pick a tile up and drag it: it follows the pointer, the others slide out of the way, and it settles into its slot on release (Escape cancels). Alt + Left / Right moves the focused tile.
- **Scoped**: the file is wrapped in `@scope ([data-css-scope~="<key>"]) { ... }` and the panel's directive writes that attribute on the root element that imports it. Use `:scope` to style the root itself. `@import` rules at the top of the file stay outside the scope (the imported CSS is not scoped). Mutually exclusive with **Global**. Needs a browser with `@scope` (Chrome 118, Safari 17.4, Firefox 128).
- **Import / export**: import `.css` files (up to 1 MB each) with the Import tile or by dropping them on the grid; *Download* in *File settings* exports one.
- **Editor**: CSS variable suggestions (the plugin's own files, the project's global CSS, and the `:root` variables of the page, which include the editor's own `--color-*` and `--length-*`), syntax errors underlined, and a **Format** button (re-indent, one declaration per line).
- **Minify on export** (*Export* section, default on; saved in `internals.minify`): comments and extra whitespace are removed from the files embedded in the exported app. Your files are not changed.

Other actions: rename (Enter to confirm, Esc to cancel), duplicate, delete (with confirmation).

A file is added to the page (`<style data-css-files="<id>">`) when the first page or component importing it mounts, and removed when the last one unmounts. The CSS is **not scoped**: it is plain global CSS, loaded on demand.

## How it works
| Piece | File | Role |
|---|---|---|
| Storage | `../internals/internals.ts` → `stylesheets` | Saved with the project, keyed by stable id |
| Editor state | `state.ts` | Pushes files into the runtime live; create / rename / duplicate / delete / reorder / import / export; name rules; selected file |
| CSS helpers | `cssTools.ts`, `cssVariables.ts` | `formatCss` (editor button) and `minifyCss` (export), both pure; variable names suggested by the editor |
| Workspace UI | `LStylesheetsFiles.vue` (+ `LStylesheetTile.vue`), `LStylesheetsSettings.vue`, `LStylesheetsEditor.vue` + `LCodeEditor.vue` | Three workspace sections: file tiles, file settings, code editor with status bar. The selected file is shared through `state.ts` |
| Import UI | `LStylesheetsPanel.vue` + `index.ts` (`stylesheetsPanel`) | Element panel limited to root elements (`isRootElement`), stores `{ enabled: boolean, sheets: string[] }` (file ids; a missing `enabled`, in projects saved before it existed, means on) on the root element |
| Loading | `runtime.ts` (`vStylesheets`, `registerStylesheets`) | Same code in the editor and in exported apps: tags kept in file order, `@scope` wrapping, scope attribute |
| Export | `index.ts` (`getStylesheetInjections`) | `AppSetup` calls `registerStylesheets({...})` with the files' content |

## Security model
- **Trusted author.** The CSS is written by whoever edits the project, and is applied as-is. The plugin does not sanitise it.
- **No markup injection.** CSS is applied with `textContent` on a `<style>` element, never `innerHTML`.
- **Safe code generation.** In exported apps the CSS is embedded in a JSON literal inside generated source. `<`, `[`, U+2028 and U+2029 are escaped, so CSS can't close the `<script>` block or trigger the compiler's `[[file:id]]` placeholders.
- **Untrusted project file.** Stored files are checked when the editor loads them and again when the app is generated: an entry whose id is not `[A-Za-z0-9-]{1,64}` (so no `__proto__`, quote or path character) or whose id differs from its key, or whose CSS is not a string, is dropped. The runtime also stores ids in a `Map`, ignores non-string values and uses them only as keys and attribute values.
- **Hostile CSS files.** The editor's canvas splitter bounds the nesting it follows (16 levels) and falls back to the CSS as written on any error, so an imported `.css` file can't freeze or break the editor. A file that loads another site (`@import`, `url(https://…)`) shows a warning in the editor: whoever wrote it can track the visitors that load it.
- **File names** are sanitised (no path or reserved characters, `.css` enforced, unique, 60 characters max).
- **No network, no secrets.** The plugin makes no request and stores no credential. A remote `@import url(...)` or `url(...)` in your own CSS is fetched by the browser, like any CSS.
- **CSP.** Apps with a strict Content-Security-Policy must allow inline styles (`style-src 'unsafe-inline'`, or a nonce-based setup) for the CSS to apply.
- **Dependencies.** CodeMirror and its helpers are bundled into the editor entry only. The runtime entry has no dependency besides Vue.

## Editor isolation
In the editor, every file that is not **Scoped** is wrapped in `@scope ([data-root])`, the same way Luna Park scopes the CSS it injects for the project: `[data-root]` is the root of the app being edited, so the CSS reaches the canvas and never the editor's own interface (toolbars, panels, this workspace). Exported apps get the CSS as written, without the wrapper. Two details keep the editor faithful to the exported app. First, rules that target the page itself (`html`, `body`, `:root`, alone or with a class, attribute or pseudo-class, e.g. `body.dark`, `html[lang] body`) can't live inside `@scope ([data-root])`: a scope only matches descendants, and `[data-root]` is a `display: contents` element without a box, so a background or padding on it would not show. They are written next to the file's CSS, outside the wrapper, and target the page area of the canvas that plays the part of `<html>` / `<body>` (`[data-ui="preview-content"]`, or `[data-ui="preview-maximized"]` in full screen; `canvasSelectors.ts`), with `width: auto; box-sizing: border-box` first so a padding doesn't make it overflow its frame: fonts, margins, backgrounds, colours and CSS variables declared there reach the page, in `@media` / `@supports` / `@layer` too. A bare `body .x` simply becomes `.x`. Second, `@import` / `@charset` at the top of a file are kept outside the wrapper. Selectors inside `@keyframes`, `@font-face`, strings, comments and `url()` are never touched.

## Limits
- Files live in the plugin's `internals`, not in the project explorer: the plugin API has no custom file type or explorer context menu.
- Files are not scoped by default: use specific class names, or turn on **Scoped**. A global file applies to every page.
- No "used by" list on the tiles: the plugin API doesn't give a reliable way to list which pages import a file.
- The editor's variable suggestions don't know the project's design tokens by name (only the CSS the project declares).
- Deleting a file leaves a "Deleted file" entry on the pages and components importing it, which can be removed from the panel.
- Very large files (over about 200 KB) trigger a warning: they are shipped to every visitor that loads them.
