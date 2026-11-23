/**
 * ENTRY `<package>/runtime`: browser code imported by **generated frontends**.
 *
 * Everything that generated code imports from RUNTIME_TARGET must be exported here:
 * - the `v-stylesheets` directive (element panel `directive.build`);
 * - `registerStylesheets`, called by the `AppSetup` injection.
 *
 * Rules: browser-safe, no `@luna-park/design`, nothing editor-only. Vue is provided by the app.
 */
export {
    registerStylesheets,
    type TRegisterOptions,
    type TStylesheet,
    type TStylesheetMap,
    type TStylesheetsOptions,
    vStylesheets
} from "@/features/stylesheets/runtime.ts";
