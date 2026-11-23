<!--
    Workspace section "Export": how the CSS files are embedded in the exported app.
    Saved in `internals.minify`, read by `build.injections` (see ../../index.ts).
-->
<template>
    <LCard>
        <LSettingRow
            description="Remove comments and extra whitespace from the CSS files in the exported app. The editor keeps your files as written."
            title="Minify CSS"
        >
            <LSwitch
                v-model="internals.minify"
                small
            />
        </LSettingRow>
        <LSettingRow
            description="Version of the plugin loaded in this editor. If it is not the one you just published, reload the editor, or reinstall the plugin as name@version."
            title="Version"
        >
            <span class="version">v{{ PACKAGE_VERSION }}</span>
        </LSettingRow>
    </LCard>
</template>

<script setup lang="ts">
import { LCard, LSettingRow, LSwitch } from "@luna-park/design";

import { internals } from "@/features/internals/internals.ts";
import { PACKAGE_VERSION } from "@/meta.ts";
</script>

<style scoped>
.version {
    color: var(--color-content-lite);
    font-family: var(--font-monospace), ui-monospace, monospace;
    font-size: var(--font-size-s);
}
</style>
