/**
 * EDITOR ONLY: makes `html`, `body` and `:root` rules work in the editor's canvas.
 *
 * In the editor the ordinary rules of a file are wrapped in `@scope ([data-root])` so they can't reach
 * Luna Park's own interface (see runtime.ts). Two things follow for the rules that target the page itself:
 * - a scope only matches descendants of its root, so `body { ... }` would match nothing;
 * - the scope root `[data-root]` is a `display: contents` element: it has no box, so a background,
 *   padding or margin set on it would not show.
 * The element that really plays the part of `<html>` / `<body>` in the canvas is
 * the page area, an ancestor of `[data-root]` (white, with `lang`, background and font reset):
 * `[data-ui="preview-content"]` in the editor, `[data-ui="preview-maximized"]` in full screen.
 * So the CSS is split in two:
 * - `root`: the rules whose selector is the page itself (`html`, `body`, `:root`, `body.dark`, `html[lang]`),
 *   rewritten to target that element, same declarations, same `@media` / `@supports` / `@layer` context;
 * - `scoped`: everything else, to be wrapped in `@scope ([data-root])`. A bare `body .x` loses its `body`
 *   (everything in the scope is already inside the page).
 *
 * `@keyframes`, `@font-face`, `@import`, declarations, strings, comments and `url(...)` are never touched.
 * Exported apps get the CSS as written.
 */
import { skipComment, skipString, skipUnquotedUrl } from "@/features/stylesheets/cssTools.ts";

/** The canvas elements standing for the app's document. `:not(#_)` makes them win over Luna Park's own `.html-reset`. */
const CANVAS_ROOT = ":is([data-ui=\"preview-content\"], [data-ui=\"preview-maximized\"]):not(#_)";

/**
 * Luna Park sizes that element with `width: 100%; height: 100%` (content-box), so a `body { padding: 24px }`
 * would make it overflow its frame by 48px and be clipped on the right. A real `<body>` has `width: auto`
 * and counts its padding inside the viewport: these defaults come first so the file's own declarations win.
 */
const CANVAS_ROOT_DEFAULTS = "width: auto; box-sizing: border-box; ";

type TCanvasCss = {
    /** Rules for the page itself, targeting `CANVAS_ROOT`. Not to be wrapped in `@scope`. */
    root: string;
    /** Everything else: to be wrapped in `@scope ([data-root])`. */
    scoped: string;
};

type TNode =
    | { children: Array<TNode>; kind: "group"; prelude: string; } |
    { body: string; kind: "rule"; prelude: string; } |
    { kind: "text"; text: string; };

const CONDITIONAL = new Set(["container", "document", "layer", "media", "starting-style", "supports"]);
const ROOT = /^(?:html|body|:root)(?![\w-])/i;
const LEADING = /^(?:\s|\/\*[\s\S]*?\*\/)*/;
/** Conditional at-rules nested deeper than this are left as written: it bounds the work (and the recursion) on hostile files. */
const MAX_DEPTH = 16;
const PAGE_MENTION = /\b(?:html|body)\b|:root/i;

/** Index of the `}` closing the block opened at `open` (or the end of the text when it never closes). */
function findBlockEnd(css: string, open: number) {
    let depth = 0;
    let index = open;

    while (index < css.length) {
        const char = css[index];

        if (char === "/" && css[index + 1] === "*") {
            index = skipComment(css, index);
        }
        else if (char === "\"" || char === "'") {
            index = skipString(css, index);
        }
        else if ((char === "u" || char === "U") && skipUnquotedUrl(css, index) !== -1) {
            index = skipUnquotedUrl(css, index);
        }
        else {
            depth += char === "{" ? 1 : char === "}" ? -1 : 0;

            if (depth === 0 && char === "}") {
                return index;
            }

            index++;
        }
    }

    return css.length;
}

/** Splits CSS into text (statements, comments, raw blocks), style rules, and conditional at-rule groups. */
function parse(css: string, depth = 0): Array<TNode> {
    const nodes: Array<TNode> = [];
    let chunk = 0;
    let index = 0;

    function flush(end: number) {
        if (end > chunk) {
            nodes.push({ kind: "text", text: css.slice(chunk, end) });
        }

        chunk = end;
    }

    while (index < css.length) {
        const char = css[index];

        if (char === "/" && css[index + 1] === "*") {
            index = skipComment(css, index);
        }
        else if (char === "\"" || char === "'") {
            index = skipString(css, index);
        }
        else if ((char === "u" || char === "U") && skipUnquotedUrl(css, index) !== -1) {
            index = skipUnquotedUrl(css, index);
        }
        else if (char === ";") {
            index++;
            flush(index);
        }
        else if (char === "{") {
            const end = findBlockEnd(css, index);
            const after = Math.min(end + 1, css.length);
            const prelude = css.slice(chunk, index);
            const lead = LEADING.exec(prelude)?.[0] ?? "";
            const head = prelude.slice(lead.length);
            const inner = css.slice(index + 1, end);

            if (head.startsWith("@")) {
                const name = /^@([\w-]+)/.exec(head)?.[1]?.toLowerCase() ?? "";

                if (CONDITIONAL.has(name) && depth < MAX_DEPTH) {
                    flush(chunk + lead.length);
                    nodes.push({ children: parse(inner, depth + 1), kind: "group", prelude: head });
                    chunk = after;
                }
                else {
                    flush(after);
                }
            }
            else {
                flush(chunk + lead.length);
                nodes.push({ body: inner, kind: "rule", prelude: head });
                chunk = after;
            }

            index = after;
        }
        else {
            index++;
        }
    }

    flush(css.length);

    return nodes;
}

/** `html body.dark > .x` → compounds with the combinator that precedes each one. */
function tokenize(selector: string) {
    const items: Array<{ combinator: string; compound: string; }> = [];
    let compound = "";
    let combinator = "";
    let depth = 0;
    let quote = "";

    function flush() {
        if (compound) {
            items.push({ combinator, compound });
            compound = "";
            combinator = "";
        }
    }

    for (let index = 0; index < selector.length; index++) {
        const char = selector[index];

        if (quote) {
            compound += char;

            if (char === "\\") {
                compound += selector[++index] ?? "";
            }
            else if (char === quote) {
                quote = "";
            }
        }
        else if (char === "\\") {
            compound += char + (selector[++index] ?? "");
        }
        else if (char === "\"" || char === "'") {
            quote = char;
            compound += char;
        }
        else {
            depth += "([".includes(char) ? 1 : ")]".includes(char) ? -1 : 0;

            if (depth === 0 && (/\s/.test(char) || ">+~".includes(char))) {
                flush();
                combinator += char;
            }
            else {
                compound += char;
            }
        }
    }

    flush();

    return items;
}

/** Splits a selector list on its top-level commas. */
function splitList(list: string) {
    const parts: Array<string> = [];
    let current = "";
    let depth = 0;
    let quote = "";

    for (let index = 0; index < list.length; index++) {
        const char = list[index];

        if (quote) {
            current += char;

            if (char === "\\") {
                current += list[++index] ?? "";
            }
            else if (char === quote) {
                quote = "";
            }
        }
        else if (char === "\"" || char === "'") {
            quote = char;
            current += char;
        }
        else if (char === "," && depth === 0) {
            parts.push(current);
            current = "";
        }
        else {
            depth += "([".includes(char) ? 1 : ")]".includes(char) ? -1 : 0;
            current += char;
        }
    }

    parts.push(current);

    return parts;
}

/** Where one complex selector goes, and what it becomes there. */
function classify(selector: string): { target: "root" | "scoped"; text: string; } {
    const lead = /^\s*/.exec(selector)?.[0] ?? "";
    const trail = /\s*$/.exec(selector)?.[0] ?? "";
    const items = tokenize(selector.trim());

    if (!items.length || !ROOT.test(items[0].compound)) {
        return { target: "scoped", text: selector };
    }

    // `html body[lang].dark` is one element here: what is attached to each root compound is joined.
    let attached = items[0].compound.replace(ROOT, "");
    let next = 1;

    while (next < items.length && /^\s*>?\s*$/.test(items[next].combinator) && ROOT.test(items[next].compound)) {
        attached += items[next].compound.replace(ROOT, "");
        next++;
    }

    const rest = items.slice(next);
    const tail = rest.map((item) => item.combinator + item.compound).join("");

    if (!rest.length) {
        return { target: "root", text: `${ lead }${ CANVAS_ROOT }${ attached }${ trail }` };
    }

    // A bare `body .x`: everything in the scope is already inside the page, so `.x` is enough.
    if (!attached) {
        return { target: "scoped", text: lead + rest[0].compound + rest.slice(1).map((item) => item.combinator + item.compound).join("") + trail };
    }

    return { target: "root", text: `${ lead }${ CANVAS_ROOT }${ attached }${ tail }${ trail }` };
}

function emit(nodes: Array<TNode>): TCanvasCss {
    const result: TCanvasCss = { root: "", scoped: "" };

    for (const node of nodes) {
        if (node.kind === "text") {
            result.scoped += node.text;
        }
        else if (node.kind === "rule") {
            const scoped: Array<string> = [];
            const root: Array<string> = [];

            for (const part of splitList(node.prelude)) {
                const found = classify(part);

                (found.target === "root" ? root : scoped).push(found.text);
            }

            if (scoped.length) {
                result.scoped += `${ scoped.join(",") }{${ node.body }}`;
            }

            if (root.length) {
                result.root += `${ root.join(",") }{${ CANVAS_ROOT_DEFAULTS }${ node.body }}\n`;
            }
        }
        else {
            const inner = emit(node.children);

            if (inner.scoped.trim()) {
                result.scoped += `${ node.prelude }{${ inner.scoped }}`;
            }

            if (inner.root.trim()) {
                result.root += `${ node.prelude }{${ inner.root }}\n`;
            }
        }
    }

    return result;
}

/** Splits a file's CSS into the part for the page itself and the part for what is inside it. */
export function splitCanvasCss(css: string): TCanvasCss {
    return PAGE_MENTION.test(css) ? emit(parse(css)) : { root: "", scoped: css };
}
