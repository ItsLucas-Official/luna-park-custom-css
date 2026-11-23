/**
 * Pure CSS text helpers, no dependency: a formatter (editor button) and a minifier (exported apps).
 *
 * Both are deliberately conservative: they only touch whitespace, comments and the last `;` of a
 * block, and never read inside strings, comments or an unquoted `url(...)`.
 */

/** Index right after the string that starts at `start` (the quote character). */
export function skipString(source: string, start: number) {
    const quote = source[start];
    let index = start + 1;

    while (index < source.length && source[index] !== quote) {
        index += source[index] === "\\" ? 2 : 1;
    }

    return Math.min(index + 1, source.length);
}

/** Index right after the comment that starts at `start` (`/*`). */
export function skipComment(source: string, start: number) {
    const end = source.indexOf("*/", start + 2);

    return end === -1 ? source.length : end + 2;
}

/** Index right after an unquoted `url(...)` starting at `start`, or -1 when it is quoted / not a url. */
export function skipUnquotedUrl(source: string, start: number) {
    if (source.slice(start, start + 4).toLowerCase() !== "url(") {
        return -1;
    }

    const rest = source.slice(start + 4);
    const first = rest.trimStart()[0];

    if (first === "\"" || first === "'") {
        return -1;
    }

    const end = source.indexOf(")", start + 4);

    return end === -1 ? source.length : end + 1;
}

/** Re-indents CSS: one declaration per line, 4 spaces per level, at most one blank line kept. */
export function formatCss(source: string, indent = "    ") {
    let out = "";
    let depth = 0;
    let paren = 0;
    let index = 0;
    let atLineStart = true;
    let pendingSpace = false;
    let blankPending = false;

    function newline() {
        out = out.replace(/[ \t]+$/, "");
        out += "\n";
        atLineStart = true;
        pendingSpace = false;
    }

    function put(text: string) {
        if (atLineStart) {
            if (blankPending && out && !out.endsWith("\n\n")) {
                out += "\n";
            }

            out += indent.repeat(depth);
            atLineStart = false;
        }
        else if (pendingSpace) {
            out += " ";
        }

        blankPending = false;
        pendingSpace = false;
        out += text;
    }

    while (index < source.length) {
        const char = source[index];
        const next = source[index + 1];

        if (/\s/.test(char)) {
            let end = index;
            let breaks = 0;

            while (end < source.length && /\s/.test(source[end])) {
                breaks += source[end] === "\n" ? 1 : 0;
                end++;
            }

            if (atLineStart) {
                blankPending ||= breaks >= 2 && out !== "";
            }
            else {
                pendingSpace = true;
            }

            index = end;
        }
        else if (char === "/" && next === "*") {
            const end = skipComment(source, index);
            const standalone = atLineStart;

            put(source.slice(index, end));

            if (standalone) {
                newline();
            }

            index = end;
        }
        else if (char === "\"" || char === "'") {
            const end = skipString(source, index);

            put(source.slice(index, end));
            index = end;
        }
        else if ((char === "u" || char === "U") && skipUnquotedUrl(source, index) !== -1) {
            const end = skipUnquotedUrl(source, index);

            put(source.slice(index, end));
            index = end;
        }
        else if (char === "(") {
            paren++;
            put(char);
            index++;
        }
        else if (char === ")") {
            paren = Math.max(0, paren - 1);
            put(char);
            index++;
        }
        else if (char === "{" && paren === 0) {
            pendingSpace = !atLineStart;
            put(char);
            depth++;
            newline();
            index++;
        }
        else if (char === "}" && paren === 0) {
            depth = Math.max(0, depth - 1);

            if (!atLineStart) {
                newline();
            }

            put(char);
            newline();
            blankPending = depth === 0;
            index++;
        }
        else if (char === ";" && paren === 0) {
            pendingSpace = false;
            put(char);
            newline();
            index++;
        }
        else {
            put(char);
            index++;
        }
    }

    return `${ out.replace(/\s+$/, "") }\n`.replace(/^\n+/, "");
}

/** Removes comments (except the "bang" ones that start with an exclamation mark), extra whitespace and the last `;` of each block. */
export function minifyCss(source: string) {
    let out = "";
    let index = 0;
    let pendingSpace = false;

    while (index < source.length) {
        const char = source[index];
        const next = source[index + 1];

        if (char === "/" && next === "*") {
            const end = skipComment(source, index);

            if (source[index + 2] === "!") {
                out += source.slice(index, end);
            }
            else {
                pendingSpace ||= out !== "" && !/[{};,]$/.test(out);
            }

            index = end;
        }
        else if (/\s/.test(char)) {
            pendingSpace = out !== "";
            index++;
        }
        else {
            const last = out[out.length - 1];
            const glued = last === undefined || "{};,:".includes(last) || "{};,)".includes(char);

            if (pendingSpace && !glued) {
                out += " ";
            }

            pendingSpace = false;

            if (char === "}" && out.endsWith(";")) {
                out = out.slice(0, -1);
            }

            if (char === "\"" || char === "'") {
                const end = skipString(source, index);

                out += source.slice(index, end);
                index = end;
            }
            else {
                const urlEnd = (char === "u" || char === "U") ? skipUnquotedUrl(source, index) : -1;

                if (urlEnd === -1) {
                    out += char;
                    index++;
                }
                else {
                    out += source.slice(index, urlEnd);
                    index = urlEnd;
                }
            }
        }
    }

    return out;
}
