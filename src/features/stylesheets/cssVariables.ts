/**
 * CSS variable names suggested by the code editor (`--name`), editor only.
 *
 * Sources, merged and sorted:
 * - the custom properties declared in the plugin's own files;
 * - the ones declared in the project's global CSS (palette injection);
 * - the ones declared on `:root` / `html` / `body` by the style sheets loaded in the page, which
 *   include the Luna Park editor's own `--color-*` / `--length-*` variables.
 */
import { internals } from "@/features/internals/internals.ts";
import { getPaletteCss } from "@/features/stylesheets/state.ts";

const DECLARATION = /(--[\w-]+)\s*:/g;
const ROOT_SELECTOR = /(^|[\s,])(:root|html|body)\b/;
const CACHE_MS = 3000;

let cache: { at: number; names: Array<string>; } | undefined;

function fromText(text: string, into: Set<string>) {
    for (const match of text.matchAll(DECLARATION)) {
        into.add(match[1]);
    }
}

function fromDocument(into: Set<string>) {
    if (typeof document === "undefined") {
        return;
    }

    for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;

        try {
            rules = sheet.cssRules;
        }
        catch {
            // Cross-origin style sheet: not readable.
            continue;
        }

        for (const rule of Array.from(rules)) {
            if (rule instanceof CSSStyleRule && ROOT_SELECTOR.test(rule.selectorText)) {
                for (const name of Array.from(rule.style)) {
                    if (name.startsWith("--")) {
                        into.add(name);
                    }
                }
            }
        }
    }
}

export function collectCssVariables() {
    if (cache && Date.now() - cache.at < CACHE_MS) {
        return cache.names;
    }

    const names = new Set<string>();

    for (const entry of Object.values(internals.stylesheets)) {
        fromText(entry.css, names);
    }

    fromText(getPaletteCss(), names);
    fromDocument(names);

    cache = { at: Date.now(), names: [...names].sort() };

    return cache.names;
}
