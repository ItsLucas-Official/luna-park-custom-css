/**
 * Plugin entry point: the module the Luna Park editor loads.
 *
 * Custom CSS plugin: CSS files written in the plugin workspace, imported on a whole page or component, from
 * page (see src/features/stylesheets/README.md).
 *
 * Docs: README.md, AGENTS.md
 */
import type { TSchema } from "@luna-park/plugin";
import { makePlugin } from "@luna-park/plugin";

import type { TInternals } from "@/features/internals/internals.ts";
import { internals } from "@/features/internals/internals.ts";
import {
    elementPanels,
    getStylesheetInjections,
    sections,
    setEditorApp,
    startStylesheetSync,
    stopStylesheetSync
} from "@/features/stylesheets/index.ts";
import llm from "@/llm.md?raw";
import icon from "@/logo.svg";
import { packageImport, PLUGIN_ID } from "@/meta.ts";

export default makePlugin<TSchema, TInternals>({
    // ─── Identity ───────────────────────────────────────────────────────────────────────────
    /** Unique and stable: projects store the plugin's data under this id. */
    id: PLUGIN_ID,
    name: "Custom CSS",
    description: "Write your own CSS by hand in separate files, then import them on a whole page or component.",
    icon,
    llm,

    /** Persisted state: the CSS files (features/stylesheets). */
    internals,

    // ─── Lifecycle (editor only) ────────────────────────────────────────────────────────────
    lifecycle: {
        mount: ({ app }) => {
            setEditorApp(app);
            startStylesheetSync();
        },
        unmount: () => stopStylesheetSync()
    },

    // ─── Editor contributions ───────────────────────────────────────────────────────────────
    editor: {
        panel: {
            element: elementPanels
        }
    },

    // ─── Build (code generation of the exported app) ─────────────────────────────────────────
    build: {
        frontImports: [packageImport],
        injections: ({ internals: current }) => getStylesheetInjections(current.stylesheets, current.minify)
    },

    /** Workspace section where the CSS files are written. */
    workspace: {
        sections
    }
});
