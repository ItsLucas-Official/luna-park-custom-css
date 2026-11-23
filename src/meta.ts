/**
 * Plugin identity and import targets, kept in one place.
 */
import packageDefinition from "../package.json" with { type: "json" };

/**
 * Unique, stable plugin id. Projects store plugin data under this key
 * (`app.config.plugins[PLUGIN_ID]`), so never change it after you publish.
 */
export const PLUGIN_ID = "custom-css";

/** npm package name. The editor loads the plugin from `https://esm.sh/<PACKAGE_NAME>`. */
export const PACKAGE_NAME = packageDefinition.name;

/** Version installed in generated apps that import the runtime entry. */
export const PACKAGE_VERSION = packageDefinition.version;

/** Import target of generated code. Must match the "exports" field of package.json and vite.config.ts. */
export const RUNTIME_TARGET = `${ PACKAGE_NAME }/runtime`;

/** Added to the generated frontend's dependencies (`build.frontImports`). */
export const packageImport = { name: PACKAGE_NAME, version: PACKAGE_VERSION };
