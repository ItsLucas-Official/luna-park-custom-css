/**
 * `internals`: the plugin's persisted state, saved with the project.
 *
 * - Passed to `makePlugin({ internals })`.
 * - At load time the editor copies the saved values (`app.config.plugins[id].internals`) into it
 *   with a **shallow** `Object.assign`, and saves it back when it changes.
 * - `reactive()` so the workspace section can `v-model` straight into it.
 *
 * Every field needs a default, because older projects may have saved fewer fields. Fields added
 * after the first release (`order`, `scoped`) are optional for that reason.
 */
import { reactive } from "vue";

export type TStylesheetEntry = {
    css: string;
    /** Loaded on every page without being imported by an element. */
    global: boolean;
    id: string;
    /** File name shown in the UI, e.g. `buttons.css`. */
    name: string;
    /** Position in the load order (ascending). Missing on files saved by version 1.0.0. */
    order?: number;
    /** Only applies inside the elements that import the file (`@scope`). Missing means false. */
    scoped?: boolean;
};

export type TInternals = {
    /** Remove comments and extra whitespace from the CSS embedded in the exported app. */
    minify: boolean;
    /** CSS files created in the plugin workspace (see features/stylesheets). Keyed by stable id. */
    stylesheets: Record<string, TStylesheetEntry>;
};

export const internals = reactive<TInternals>({
    minify: true,
    stylesheets: {}
});
