# Custom CSS plugin

Write your own CSS by hand in separate files and import them where needed, instead of putting custom CSS in a global injection.

- Files are created in the plugin workspace, section **Custom CSS**: file list, name, **Global** switch, and a code editor (saved automatically).
- To use a file, open a page or component, select its top-level (root) element, open the **Custom CSS** section of its inspector, make sure **Enable custom CSS** is on, then pick the file in the **Add a CSS file** list (the cross removes it). It then applies to the whole page, or to every use of the component. The panel is not offered on nested elements.
- The CSS is loaded when the first importing page or component is shown and removed when the last one is gone. It is not scoped, so use specific class names.
- **Global** files are loaded on every page without importing.
- In the editor the CSS only applies to the app being edited (the canvas), never to Luna Park's own interface, like the project's injected CSS (`@scope ([data-root])`). Rules on `html`, `body` and `:root` are applied to the canvas's page area (`[data-ui="preview-content"]`, `[data-ui="preview-maximized"]` in full screen) in the editor, so a page styled through them (font, background, padding, CSS variables) looks the same as in the exported app.
- **Scoped** files only apply inside the page or component that imports them (`@scope`; use `:scope` for the root element). A file can't be both global and scoped.
- Files load in the order shown in the **Files** section, and a later file wins at equal specificity. The order is changed by dragging the tiles.
- Files can be imported from and exported to `.css` files. In exported apps the CSS is minified (*Minify CSS* switch in the **Export** section).
- The CSS is plain, unsanitised, global CSS written by the project's author.
