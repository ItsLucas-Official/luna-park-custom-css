/**
 * FEATURE: CSS files created in the plugin workspace, imported per page or component.
 *
 * Data: `internals.stylesheets` (saved with the project), edited by the workspace sections (LStylesheetsFiles, LStylesheetsSettings, LStylesheetsEditor).
 * Editor: ./state.ts pushes the files into the runtime on every change (live canvas preview).
 *         The panel only shows on the ROOT element of a page or component (see `isRootElement`),
 *         so a file is imported for the whole page, or for every use of the component. The
 *         panel's directive loads the files while that root element is mounted.
 * Build:  `getStylesheetInjections` makes the generated app register the files at startup. They
 *         are only added to the page when a page or component imports them (or when marked global).
 *
 * Docs: README.md in this folder.
 */
import { faCode, faFileCode, faFileExport, faSliders } from "@fortawesome/free-solid-svg-icons";
import type { TElementPanel, TLayoutSchema, TPluginWorkspaceSection } from "@luna-park/plugin";
import { EInjectionKey, LogicType } from "@luna-park/plugin";
import { markRaw } from "vue";

import type { TInternals } from "@/features/internals/internals.ts";
import { minifyCss } from "@/features/stylesheets/cssTools.ts";
import LStylesheetsEditor from "@/features/stylesheets/LStylesheetsEditor.vue";
import LStylesheetsExport from "@/features/stylesheets/LStylesheetsExport.vue";
import LStylesheetsFiles from "@/features/stylesheets/LStylesheetsFiles.vue";
import LStylesheetsPanel from "@/features/stylesheets/LStylesheetsPanel.vue";
import LStylesheetsSettings from "@/features/stylesheets/LStylesheetsSettings.vue";
import { vStylesheets } from "@/features/stylesheets/runtime.ts";
import { toStylesheetMap } from "@/features/stylesheets/state.ts";
import { RUNTIME_TARGET } from "@/meta.ts";

export { setEditorApp, startStylesheetSync, stopStylesheetSync } from "@/features/stylesheets/state.ts";

/**
 * True for the top-level element of a page or component. The plugin API has no page-level settings,
 * so the root element's inspector is where a page or component is configured.
 * A node without a parent is the root; the layout comparison is a second signal in case the editor
 * ever gives the root a parent.
 */
export function isRootElement(schema: TLayoutSchema) {
    return !schema.parent || schema.component?.layout?.id === schema.id;
}

export const stylesheetsPanel: TElementPanel = {
    id: "stylesheets",
    component: markRaw(LStylesheetsPanel),
    directive: {
        build: { name: "vStylesheets", from: RUNTIME_TARGET },
        value: vStylesheets
    },
    filter: isRootElement,
    icon: faFileCode,
    label: "Custom CSS",
    properties: {
        // Edited only by the custom component. `enabled` defaults to true so projects saved before it existed keep their files.
        enabled: LogicType.boolean({ name: "Enabled", default: true, options: { hidden: true } }),
        sheets: LogicType.array(LogicType.string(), { name: "Imported files", default: [], options: { hidden: true } })
    }
};

export const elementPanels: Array<TElementPanel> = [stylesheetsPanel];

export const sections: Array<TPluginWorkspaceSection> = [
    {
        id: "files",
        component: LStylesheetsFiles,
        description: "Your CSS files, in load order: drag a tile to move it. Select one to edit it, then import it on a page or a component.",
        icon: faFileCode,
        title: "Files"
    },
    {
        id: "settings",
        component: LStylesheetsSettings,
        description: "Name, global loading, duplicate and delete for the selected file.",
        icon: faSliders,
        title: "File settings"
    },
    {
        id: "editor",
        component: LStylesheetsEditor,
        description: "Write your CSS. It is saved automatically and previewed live in the canvas.",
        icon: faCode,
        title: "Editor"
    },
    {
        id: "export",
        component: LStylesheetsExport,
        description: "How the CSS files are embedded in the exported app, and the version of the plugin.",
        icon: faFileExport,
        title: "Export"
    }
];

/**
 * Makes JSON safe to paste into generated source. The CSS is user content, so inside the strings:
 * - `<` is escaped, so `</script>` or `<!--` can't end the SFC script block early;
 * - `[` is escaped, so the compiler's `[[file:id]]` placeholders can't be triggered from CSS;
 * - U+2028 / U+2029 are escaped, as they were line terminators in older JS engines.
 * The map holds only objects and strings (no arrays), so every `[` in the output is inside a string.
 */
function toSafeSource(json: string) {
    return json
        .replace(/</g, "\\u003c")
        .replace(/\[/g, "\\u005b")
        .replaceAll(String.fromCharCode(0x2028), "\\u2028")
        .replaceAll(String.fromCharCode(0x2029), "\\u2029");
}

/** Build side: `AppSetup` runs in the generated App.vue and registers the files at startup. */
export function getStylesheetInjections(source: TInternals["stylesheets"] | undefined, minify = false): Partial<Record<EInjectionKey, string>> {
    const map = toStylesheetMap(source);

    if (minify) {
        for (const sheet of Object.values(map)) {
            sheet.css = minifyCss(sheet.css);
        }
    }

    const json = toSafeSource(JSON.stringify(map));

    return {
        [EInjectionKey.AppSetup]: `
import { registerStylesheets } from "${ RUNTIME_TARGET }";
registerStylesheets(${ json });
`
    };
}
