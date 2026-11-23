# Custom CSS

A [Luna Park](https://luna-park.app) plugin to **write your own CSS by hand**, in as many separate files as you want, and **import them on a whole page or component**. No more custom CSS crammed into a global injection.

- Create, rename, duplicate and edit CSS files in the plugin workspace, with a real code editor (syntax highlighting, line numbers, code folding, autocompletion, auto-closing brackets) and automatic saving.
- Open a page or a component, select its top-level element, and in the **Custom CSS** section of its inspector turn the switch on, then add the files you want from the drop-down list (and remove them with the cross). The CSS then applies to the whole page, or to every use of the component.
- Mark a file **Global** to load it on every page without importing it, or **Scoped** so it only applies inside the page or component that imports it (`@scope`).
- Choose the **load order** of the files (a later file wins at equal specificity).
- **Import** `.css` files (button or drag and drop) and **export** them back.
- The editor suggests CSS variables (`--name`, `var(--`), underlines syntax errors and has a **Format** button.
- Exported apps get **minified** CSS (*Minify CSS* in the **Export** section of the workspace, on by default).
- Live preview in the editor canvas while you type. Exported apps embed the same files and load them on demand.

In the editor the CSS only applies to the app being edited (the canvas), never to Luna Park's own interface, like the project's injected CSS (`@scope ([data-root])`). Rules on `html`, `body` and `:root` are applied to the canvas's page area, so a page looks the same in the editor and in the exported app. Exported apps get plain CSS.

## Security
The CSS is written by the project's author and applied as-is (it is not sanitised). It is injected with `textContent`, never as HTML, and embedded in exported apps through an escaped JSON literal. The plugin makes no network request and stores no secret. The runtime has no dependency besides Vue. Details and limits: [`src/features/stylesheets/README.md`](src/features/stylesheets/README.md#security-model).

## How it works
A file's CSS is added to the page (`<style data-css-files="<id>">`) when the first page or component importing it appears, and removed when the last one is gone.

> Luna Park plugins can't add a section to the page or component settings dialog. The panel is therefore offered in the inspector of the page's or component's **top-level element**, and only there. It is plain **global CSS**, not scoped: use specific class names.

Details, data flow and limits: [`src/features/stylesheets/README.md`](src/features/stylesheets/README.md).

## Install
In the Luna Park editor: **Plugins → Install from URL**, then enter the plugin's package name or URL (`@itslucas_off/luna-park-custom-css`).

## Develop
```bash
pnpm install
pnpm dev        # rebuild dist/ on change
pnpm preview    # serve dist/ on http://127.0.0.1:2084
```
In the editor, install `http://127.0.0.1:2084`.

| Script | |
|--------|---|
| `pnpm build` | production build → `dist/` |
| `pnpm typecheck` | `vue-tsc -b` |
| `pnpm lint` / `pnpm lint:fix` | ESLint |

## Publish to npm
```bash
npm login
npm version patch      # or minor / major: the version is also installed in exported apps
npm publish --access public   # prepublishOnly runs typecheck, lint, build and a dist/ check; dist/ and src/ are published
```
Then install `@itslucas_off/luna-park-custom-css` in the Luna Park editor (the editor loads it from esm.sh). Exported apps install the same version and import `@itslucas_off/luna-park-custom-css/runtime`.

## Updating the plugin in Luna Park
The editor loads the plugin from npm through esm.sh; esm.sh and the browser cache what they have already served. After publishing:
1. Always publish a **new version** (`npm version patch`). A version number can never be reused on npm, and esm.sh keeps what it built for a version forever.
2. In Luna Park, install the plugin again **with the new version in the name**, e.g. `@itslucas_off/luna-park-custom-css@1.0.1` (Plugins → Install from URL). A project stores the exact location it installed the plugin from, so an older location keeps loading the older version. Luna Park then asks whether to *replace its location*: answer OK. Don't uninstall first: the plugin's data (your CSS files) stays in the project.
3. Reload the editor (Ctrl+Shift+R). The loaded version is shown in the workspace, section **Export**: if it is not the one you installed, the old location is still in use.

`npm publish` refuses to run when `dist/` is stale (`scripts/check-dist.mjs`).

## Project structure
```
src/
  index.ts                    makePlugin({...}): entry point
  meta.ts                     plugin id, package name, import targets
  llm.md                      description read by the AI assistant
  features/stylesheets/       the plugin: runtime, editor state, code editor, panel, workspace
  entries/runtime.ts          <package>/runtime, imported by exported apps
```

## License
[MIT](LICENSE) © ItsLucas-Official

## Based on
This project started from the [Luna Park plugin boilerplate](https://github.com/lunapark/plugin-boilerplate), which documents the plugin system (`AGENTS.md`, `docs/`). [`AGENTS.md`](AGENTS.md) covers this repository.
