/**
 * RUNTIME: loads CSS files into the page, on demand.
 *
 * Shared by the editor canvas and exported apps (`<package>/runtime`), so the preview matches the
 * result. Browser-safe: no `@luna-park/*`, nothing editor-only.
 *
 * - `registerStylesheets(map)` gives the runtime the content of every CSS file. Called again with
 *   new content, it updates the `<style>` tags already in the page (live editing in the editor).
 * - An element importing a file "holds" it: the `<style>` tag exists while at least one element
 *   holds the file (reference counted), or always when the file is `global`.
 * - Tags are kept in the files' `order`, so later files win on equal specificity.
 * - A `scoped` file is wrapped in `@scope ([data-css-scope~="<key>"])`, and the directive writes
 *   that attribute on the elements importing it: the CSS then only applies inside them.
 * - In the editor (`registerStylesheets(map, { canvas: true })`) every other file is wrapped in
 *   `@scope ([data-root])`, the same way Luna Park scopes its own injected CSS: it only reaches the app
 *   being edited (the canvas) and never the editor's own interface. Exported apps get plain CSS.
 * - `vStylesheets` is the directive written by the element panel: `{ enabled, sheets: ["<id>", ...] }`.
 *   With `enabled: false` the element imports nothing, whatever its list.
 *
 * Security notes
 * - CSS is written with `textContent`, never `innerHTML`, so it can't break out of the `<style>` tag.
 * - Ids come from the project file, so they are treated as untrusted: they are only used as Map keys
 *   and attribute values, and anything that isn't a string is ignored (no prototype pollution through
 *   keys such as `__proto__`). In selectors and attributes they go through `scopeKey`.
 * - The CSS itself is authored by the project's owner and applied as-is. An `@import url(...)` in it
 *   makes the browser fetch that URL. Apps with a strict Content-Security-Policy must allow inline
 *   styles (`style-src 'unsafe-inline'`) for it to apply.
 */
import type { Directive } from "vue";

export type TStylesheet = {
    css: string;
    global?: boolean;
    name?: string;
    /** Position in the load order (ascending). */
    order?: number;
    /**
     * Editor only: rules for the page itself (`html`, `body`, `:root`), already rewritten to target the
     * canvas root. Written next to the file's CSS, outside the `@scope ([data-root])` wrapper.
     */
    rootCss?: string;
    /** Only applies inside the elements that import the file. Ignored for global files. */
    scoped?: boolean;
};

export type TStylesheetMap = Record<string, TStylesheet>;

export type TStylesheetsOptions = {
    /** Master switch of the page or component. Missing (projects saved before it existed) means on. */
    enabled?: boolean;
    sheets: Array<string>;
};

export type TRegisterOptions = {
    /** Editor only: restrict the CSS to the canvas (`[data-root]`) instead of the whole page. */
    canvas?: boolean;
};

const ATTRIBUTE = "data-css-files";
const SCOPE_ATTRIBUTE = "data-css-scope";
/** Root of the app being edited, set by the Luna Park editor on its canvas. */
const CANVAS_SELECTOR = "[data-root]";
/** Leading comments, `@charset` and `@import` rules: they must stay at the top level, outside `@scope`. */
const LEADING_RULES = /^(?:\s|\/\*[\s\S]*?\*\/|@charset\s+"[^"]*"\s*;|@import\b[^;]*;)*/;

let registry = new Map<string, TStylesheet>();
let canvasOnly = false;
const holders = new Map<string, number>();
const tags = new Map<string, HTMLStyleElement>();
const applied = new WeakMap<HTMLElement, Array<string>>();
const elements = new Set<HTMLElement>();

/** Id made safe for an attribute value and a selector. */
function scopeKey(id: string) {
    return id.replace(/[^\w-]/g, "_");
}

function isScoped(sheet: TStylesheet | undefined) {
    return sheet?.scoped === true && sheet.global !== true;
}

function wrapInScope(css: string, selector: string) {
    const leading = LEADING_RULES.exec(css)?.[0] ?? "";

    return `${ leading }@scope (${ selector }) {\n${ css.slice(leading.length) }\n}`;
}

/** The CSS text of a file as written in its `<style>` tag. */
function toStyleText(id: string, sheet: TStylesheet) {
    if (isScoped(sheet)) {
        return wrapInScope(sheet.css, `[${ SCOPE_ATTRIBUTE }~="${ scopeKey(id) }"]`);
    }

    return canvasOnly ? wrapInScope(sheet.css, CANVAS_SELECTOR) + (sheet.rootCss ? `
${ sheet.rootCss }` : "") : sheet.css;
}

/** Re-appends the tags in the files' order, only when they are not already in it. */
function sortTags() {
    const wanted = [...tags.keys()].sort((a, b) => (registry.get(a)?.order ?? 0) - (registry.get(b)?.order ?? 0));
    const sorted = wanted.every((id, position) => {
        const previous = tags.get(wanted[position - 1]);

        return !previous || Boolean(previous.compareDocumentPosition(tags.get(id)!) & Node.DOCUMENT_POSITION_FOLLOWING);
    });

    if (!sorted) {
        for (const id of wanted) {
            document.head.appendChild(tags.get(id)!);
        }
    }
}

function refresh(id: string) {
    if (typeof document === "undefined") {
        return;
    }

    const sheet = registry.get(id);
    const tag = tags.get(id);

    if (sheet && (sheet.global || (holders.get(id) ?? 0) > 0)) {
        const target = tag ?? document.createElement("style");
        const text = toStyleText(id, sheet);

        if (!tag) {
            target.setAttribute(ATTRIBUTE, id);
            document.head.appendChild(target);
            tags.set(id, target);
        }

        if (target.textContent !== text) {
            target.textContent = text;
        }
    }
    else if (tag) {
        tag.remove();
        tags.delete(id);
    }
}

/** Writes the scope attribute of an element from the files it imports. */
function applyScopes(element: HTMLElement) {
    const keys = (applied.get(element) ?? [])
        .filter((id) => isScoped(registry.get(id)))
        .map(scopeKey);

    if (keys.length) {
        element.setAttribute(SCOPE_ATTRIBUTE, keys.join(" "));
    }
    else {
        element.removeAttribute(SCOPE_ATTRIBUTE);
    }
}

function toRegistry(map: TStylesheetMap) {
    const next = new Map<string, TStylesheet>();

    for (const [id, sheet] of Object.entries(map ?? {})) {
        if (sheet && typeof sheet.css === "string") {
            next.set(id, {
                name: String(sheet.name ?? ""),
                css: sheet.css,
                global: sheet.global === true,
                order: Number.isFinite(sheet.order) ? sheet.order : 0,
                rootCss: typeof sheet.rootCss === "string" ? sheet.rootCss : "",
                scoped: sheet.scoped === true
            });
        }
    }

    return next;
}

/** Replaces the known CSS files and updates the page. */
export function registerStylesheets(map: TStylesheetMap, options: TRegisterOptions = {}) {
    const previous = registry;

    registry = toRegistry(map);
    canvasOnly = options.canvas === true;

    for (const id of new Set([...previous.keys(), ...registry.keys(), ...holders.keys()])) {
        refresh(id);
    }

    if (typeof document !== "undefined") {
        sortTags();
    }

    for (const element of elements) {
        applyScopes(element);
    }
}

/** Removes every injected `<style>` tag and forgets the files (editor unmount). */
export function clearStylesheets() {
    registerStylesheets({});
    holders.clear();
    canvasOnly = false;
}

function acquireStylesheet(id: string) {
    holders.set(id, (holders.get(id) ?? 0) + 1);
    refresh(id);

    if (typeof document !== "undefined") {
        sortTags();
    }
}

function releaseStylesheet(id: string) {
    const count = (holders.get(id) ?? 0) - 1;

    if (count > 0) {
        holders.set(id, count);
    }
    else {
        holders.delete(id);
    }

    refresh(id);
}

function apply(element: HTMLElement, options?: TStylesheetsOptions) {
    const requested = options?.enabled !== false && Array.isArray(options?.sheets) ? options.sheets : [];
    const next = [...new Set(requested.filter((id): id is string => typeof id === "string"))];
    const previous = applied.get(element) ?? [];

    applied.set(element, next);
    applyScopes(element);

    for (const id of next.filter((value) => !previous.includes(value))) {
        acquireStylesheet(id);
    }

    for (const id of previous.filter((value) => !next.includes(value))) {
        releaseStylesheet(id);
    }

    if (next.length) {
        elements.add(element);
    }
    else {
        elements.delete(element);
    }
}

export const vStylesheets: Directive<HTMLElement, TStylesheetsOptions> = {
    mounted: (element, { value }) => apply(element, value),
    unmounted: (element) => apply(element, { sheets: [] }),
    updated: (element, { value }) => apply(element, value)
};
