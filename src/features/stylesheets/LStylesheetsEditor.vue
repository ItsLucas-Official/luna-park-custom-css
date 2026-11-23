<!--
    Workspace section "Editor": the code editor for the selected file. Saved automatically into
    `internals.stylesheets`; ./state.ts pushes it live into the canvas.
-->
<template>
    <LCard class="editor-card">
        <p
            v-if="!current"
            class="empty"
        >
            Select a file above, or create one, to start writing CSS.
        </p>

        <template v-else>
            <p
                v-if="current.global"
                class="notice"
            >
                <LIcon :icon="faGlobe" />
                Global file: loaded on every page.
            </p>

            <header class="toolbar">
                <span
                    class="problems"
                    :class="{ error: status.errors > 0 }"
                >
                    <LIcon :icon="status.errors ? faCircleExclamation : faCircleCheck" />
                    {{ status.errors ? `${ status.errors } syntax ${ status.errors === 1 ? "error" : "errors" }` : "No syntax error" }}
                </span>
                <LButton
                    :icon="faWandMagicSparkles"
                    small
                    title="Re-indent the file: one declaration per line"
                    @click="format"
                >
                    Format
                </LButton>
            </header>

            <div class="editor">
                <LCodeEditor
                    :key="current.id"
                    v-model="current.css"
                    @status="status = $event"
                />
            </div>

            <footer class="statusbar">
                <span>Ln {{ status.line }}, Col {{ status.column }}</span>
                <span>{{ status.lines }} {{ status.lines === 1 ? "line" : "lines" }}</span>
                <span :class="{ warn: tooLarge }">{{ size(status.length) }}</span>
                <span class="spacer" />
                <span class="saved">
                    <LIcon :icon="faCheck" />
                    Saved automatically
                </span>
            </footer>

            <p
                v-if="remote"
                class="notice warn-notice"
            >
                <LIcon :icon="faTriangleExclamation" />
                This file loads something from another site (@import or url(https://…)). Check that you trust its source: every visitor's browser will fetch it.
            </p>

            <p
                v-if="tooLarge"
                class="notice warn-notice"
            >
                <LIcon :icon="faTriangleExclamation" />
                This file is large and is shipped to every visitor that loads it. Consider splitting it.
            </p>
        </template>
    </LCard>
</template>

<script setup lang="ts">
import { faCheck, faCircleCheck, faCircleExclamation, faGlobe, faTriangleExclamation, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { LButton, LCard, LIcon } from "@luna-park/design";
import { computed, ref } from "vue";

import { formatCss } from "@/features/stylesheets/cssTools.ts";
import type { TEditorStatus } from "@/features/stylesheets/LCodeEditor.vue";
import LCodeEditor from "@/features/stylesheets/LCodeEditor.vue";
import { currentStylesheet as current } from "@/features/stylesheets/state.ts";

const LARGE_FILE = 200_000;
/** `@import` of anything, or a `url()` / `@import` pointing to another host. A file from someone else can use it to track visitors. */
const REMOTE_RESOURCE = /@import|url\(\s*["']?\s*(?:https?:)?\/\//i;

const status = ref<TEditorStatus>({ column: 1, errors: 0, length: 0, line: 1, lines: 1 });

const remote = computed(() => REMOTE_RESOURCE.test(current.value?.css ?? ""));
const tooLarge = computed(() => (current.value?.css.length ?? 0) > LARGE_FILE);

function format() {
    if (current.value) {
        current.value.css = formatCss(current.value.css);
    }
}

function size(length: number) {
    return length < 1024 ? `${ length } B` : `${ (length / 1024).toFixed(1) } KB`;
}
</script>

<style scoped>
.editor-card {
    overflow: hidden;

    p {
        margin: 0;
    }

    .empty {
        padding: var(--length-s);
        color: var(--color-content-liter);
        font-size: var(--font-size-s);
        text-align: center;
    }

    .notice {
        display: flex;
        gap: var(--length-xs);
        align-items: center;
        padding: var(--length-xs) var(--length-s);
        border-bottom: 1px solid var(--color-background-2);
        background: var(--color-primary-softer);
        color: var(--color-content-lite);
        font-size: var(--font-size-xs);
        line-height: 1.4;

        &.warn-notice {
            border-top: 1px solid var(--color-background-2);
            border-bottom: 0;
            background: var(--color-warning-soft);
        }
    }

    .toolbar {
        display: flex;
        gap: var(--length-xs);
        align-items: center;
        justify-content: space-between;
        padding: var(--length-xxs) var(--length-s);
        border-bottom: 1px solid var(--color-background-2);

        .problems {
            display: flex;
            gap: var(--length-xxs);
            align-items: center;
            color: var(--color-success);
            font-size: var(--font-size-xs);

            &.error {
                color: var(--color-error);
            }
        }
    }

    .editor {
        height: min(520px, 62vh);
        min-height: 280px;
    }

    .statusbar {
        display: flex;
        flex-wrap: wrap;
        gap: var(--length-s);
        align-items: center;
        padding: var(--length-xxs) var(--length-s);
        border-top: 1px solid var(--color-background-2);
        color: var(--color-content-liter);
        font-family: var(--font-monospace), ui-monospace, monospace;
        font-size: var(--font-size-xs);

        .spacer {
            flex: 1 1 auto;
        }

        .warn {
            color: var(--color-warning);
        }

        .saved {
            display: flex;
            gap: var(--length-xxs);
            align-items: center;
        }
    }
}
</style>
