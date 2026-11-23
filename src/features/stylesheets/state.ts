/**
 * EDITOR STATE of the Custom CSS feature.
 *
 * The CSS files live in `internals.stylesheets` (saved with the project). This module pushes them
 * into the runtime so the canvas updates live, and holds the create / rename / duplicate / delete /
 * reorder / import / export helpers used by the UI. Editor only: never import it from the runtime entry.
 */
import type { TApplication, TApplicationExport } from "@luna-park/plugin";
import { computed, ref, watch } from "vue";

import type { TStylesheetEntry } from "@/features/internals/internals.ts";
import { internals } from "@/features/internals/internals.ts";
import { splitCanvasCss } from "@/features/stylesheets/canvasSelectors.ts";
import type { TStylesheetMap } from "@/features/stylesheets/runtime.ts";
import { clearStylesheets, registerStylesheets } from "@/features/stylesheets/runtime.ts";

const MAX_NAME_LENGTH = 60;
/**
 * Ids created by this plugin are UUIDs, or `css-<base36>-<base36>` without a secure context. The project file
 * is untrusted input: anything else (`__proto__`, quotes, path characters...) is dropped, so an id can be
 * written safely as a key in generated code, a selector or an attribute.
 */
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;
/** Larger files are not imported (they would freeze the editor and bloat every exported page). */
const MAX_IMPORT_SIZE = 1_000_000;

/** File selected in the workspace, shared by the "Files", "File settings" and "Editor" sections. */
export const selectedId = ref<string>();

/** The stored value is usable as a file: a safe id (also its key), a CSS string. Anything else came from a damaged or hostile project file. */
function isUsable(key: string, entry: unknown): entry is TStylesheetEntry {
    const value = entry as Partial<TStylesheetEntry> | null | undefined;

    return SAFE_ID.test(key) && typeof value === "object" && value !== null && value.id === key && typeof value.css === "string";
}

/** Files in load order (ascending `order`; files saved before ordering existed keep their creation order). */
function sortEntries(source: Record<string, TStylesheetEntry> | undefined) {
    return Object.entries(source ?? {})
        .filter(([key, entry]) => isUsable(key, entry))
        .map(([, entry], position) => ({ entry, key: Number.isFinite(entry.order) ? entry.order! : position }))
        .sort((a, b) => a.key - b.key)
        .map(({ entry }) => entry);
}

export const orderedStylesheets = computed(() => sortEntries(internals.stylesheets));

/** The selected file, or the first one when nothing (valid) is selected. */
export const currentStylesheet = computed(() => internals.stylesheets[selectedId.value ?? ""] ?? orderedStylesheets.value[0]);

/** The canvas split must never break the preview: on any failure the file is applied as written. */
function safeSplit(css: string) {
    try {
        return splitCanvasCss(css);
    }
    catch {
        return { root: "", scoped: css };
    }
}

/**
 * The files as the runtime wants them. With `canvas` (editor), `html` / `body` / `:root` selectors are
 * split off to the canvas root (`[data-ui="preview-content"]`), which stands for the app's document (see canvasSelectors.ts).
 */
export function toStylesheetMap(source: Record<string, TStylesheetEntry> | undefined, canvas = false): TStylesheetMap {
    return Object.fromEntries(
        sortEntries(source).map((entry, order) => {
            const scoped = entry.scoped === true && !entry.global;
            const split = canvas && !scoped ? safeSplit(entry.css) : { root: "", scoped: entry.css };

            return [entry.id, { name: String(entry.name ?? ""), css: split.scoped, global: entry.global === true, order, rootCss: split.root, scoped: entry.scoped === true }];
        })
    );
}

/**
 * Repairs `internals.stylesheets` as loaded from the project file (it replaces the default as a whole, see
 * internals.ts): drops entries that can't be a file, and gives the others every field the UI reads.
 * Idempotent, and touches nothing when the data is already valid.
 */
export function sanitizeStylesheets() {
    const stylesheets = internals.stylesheets;

    if (typeof stylesheets !== "object" || stylesheets === null || Array.isArray(stylesheets)) {
        internals.stylesheets = {};

        return;
    }

    for (const [key, entry] of Object.entries(stylesheets)) {
        if (!isUsable(key, entry)) {
            delete stylesheets[key];
            continue;
        }

        if (typeof entry.name !== "string" || !entry.name) {
            entry.name = uniqueName(`${ key.slice(0, 8) }.css`, key);
        }

        entry.global = entry.global === true;
    }
}

// ─── Project access (editor only) ───────────────────────────────────────────────────────────
let editorApp: TApplication | TApplicationExport | undefined;

/** Called from `lifecycle.mount`: remembers the project, read lazily (e.g. for autocompletion). */
export function setEditorApp(app: TApplication | TApplicationExport | undefined) {
    editorApp = app;
}

/** The project's own global CSS (palette injection), used to suggest its CSS variables. */
export function getPaletteCss() {
    return editorApp?.config?.palette?.inject?.css ?? "";
}

// ─── Names ──────────────────────────────────────────────────────────────────────────────────
/** `crypto.randomUUID` only exists in secure contexts: fall back so creating a file never fails. */
function newId() {
    return globalThis.crypto?.randomUUID?.() ?? `css-${ Date.now().toString(36) }-${ Math.random().toString(36).slice(2, 10) }`;
}

/** Strips path and reserved characters, trims, and makes sure the name ends with `.css`. */
export function normalizeName(input: string) {
    // eslint-disable-next-line no-control-regex
    const cleaned = input.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
    const stem = cleaned.replace(/\.css$/i, "").trim().slice(0, MAX_NAME_LENGTH);

    return stem ? `${ stem }.css` : "";
}

/** A name nobody else uses (case-insensitive). `except` is the file being renamed. */
function uniqueName(wanted: string, except?: string) {
    const taken = new Set(
        Object.values(internals.stylesheets).filter((entry) => entry.id !== except).map((entry) => entry.name.toLowerCase())
    );
    const stem = wanted.replace(/\.css$/i, "");
    let name = `${ stem }.css`;

    for (let index = 2; taken.has(name.toLowerCase()); index++) {
        name = `${ stem }-${ index }.css`;
    }

    return name;
}

// ─── Create / rename / duplicate / delete ───────────────────────────────────────────────────
/** Creates a file at the end of the load order and returns its id. */
export function addStylesheet(css = "", base = "styles") {
    const id = newId();
    const last = Math.max(-1, ...orderedStylesheets.value.map((entry, position) => entry.order ?? position));

    internals.stylesheets[id] = { id, name: uniqueName(base), css, global: false, order: last + 1, scoped: false };

    return id;
}

/** Returns the stored name, which may differ from the request (sanitised, made unique). */
export function renameStylesheet(id: string, input: string) {
    const entry = internals.stylesheets[id];
    const normalized = normalizeName(input);

    if (entry && normalized) {
        entry.name = uniqueName(normalized, id);
    }

    return entry?.name ?? "";
}

export function duplicateStylesheet(id: string) {
    const entry = internals.stylesheets[id];

    if (!entry) {
        return undefined;
    }

    const copy = addStylesheet(entry.css, `${ entry.name.replace(/\.css$/i, "") }-copy`);

    internals.stylesheets[copy].scoped = entry.scoped === true;

    return copy;
}

export function removeStylesheet(id: string) {
    delete internals.stylesheets[id];
}

// ─── Load order ─────────────────────────────────────────────────────────────────────────────
/** Moves a file to `index` in the load order (0 = loaded first). */
export function moveStylesheetTo(id: string, index: number) {
    const ids = orderedStylesheets.value.map((entry) => entry.id);
    const from = ids.indexOf(id);
    const to = Math.max(0, Math.min(index, ids.length - 1));

    if (from === -1 || from === to) {
        return;
    }

    ids.splice(to, 0, ...ids.splice(from, 1));
    ids.forEach((value, order) => {
        internals.stylesheets[value].order = order;
    });
}

// ─── Import / export ────────────────────────────────────────────────────────────────────────
/** Creates one file per `.css` / text file. Returns the new ids and the names that were skipped. */
export async function importFiles(files: ArrayLike<File>) {
    const ids: Array<string> = [];
    const skipped: Array<string> = [];

    for (const file of Array.from(files)) {
        const name = normalizeName(file.name);
        const isText = /\.css$/i.test(file.name) || file.type.startsWith("text/");

        if (!name || !isText || file.size > MAX_IMPORT_SIZE) {
            skipped.push(file.name);
            continue;
        }

        ids.push(addStylesheet(await file.text(), name.replace(/\.css$/i, "")));
    }

    return { ids, skipped };
}

/** Downloads a file's CSS as `<name>.css`. */
export function exportStylesheet(id: string) {
    const entry = internals.stylesheets[id];

    if (!entry || typeof document === "undefined") {
        return;
    }

    const url = URL.createObjectURL(new Blob([entry.css], { type: "text/css" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = entry.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Live sync with the canvas ──────────────────────────────────────────────────────────────
let stopWatching: (() => void) | undefined;

/** Call from `lifecycle.mount`. Idempotent. The CSS is restricted to the canvas, not the editor's interface. */
export function startStylesheetSync() {
    sanitizeStylesheets();
    registerStylesheets(toStylesheetMap(internals.stylesheets, true), { canvas: true });

    stopWatching ??= watch(
        () => internals.stylesheets,
        () => registerStylesheets(toStylesheetMap(internals.stylesheets, true), { canvas: true }),
        { deep: true }
    );
}

/** Call from `lifecycle.unmount`. */
export function stopStylesheetSync() {
    stopWatching?.();
    stopWatching = undefined;
    clearStylesheets();
    setEditorApp(undefined);
}
