<!--
    Panel UI (editor only): turn Custom CSS on or off for this page or component, and choose which CSS
    files it imports. It is only offered on the root element (see `isRootElement` in ./index.ts).
    Contract: props `modelValue` = `{ enabled?: boolean, sheets: string[] }`, emit `update:modelValue` with the whole object.
-->
<template>
    <div class="panel">
        <div class="switch-row">
            <span class="label">
                <span class="title">Enable custom CSS</span>
                <span class="hint">{{ enabled ? "The files below are loaded." : "Nothing is loaded. Your list is kept." }}</span>
            </span>
            <LSwitch
                :model-value="enabled"
                small
                @update:model-value="setEnabled"
            />
        </div>

        <div
            class="files"
            :class="{ off: !enabled }"
        >
            <ul
                v-if="imported.length || missing.length"
                aria-label="Imported CSS files"
                class="list"
            >
                <li
                    v-for="entry in imported"
                    :key="entry.id"
                    class="row"
                >
                    <LIcon
                        class="icon"
                        :icon="faFileCode"
                    />
                    <span
                        class="name"
                        :title="entry.name"
                    >{{ entry.name }}</span>
                    <LButton
                        :disabled="!enabled"
                        :icon="faXmark"
                        small
                        square
                        :title="`Remove ${ entry.name }`"
                        transparent
                        @click="remove(entry.id)"
                    />
                </li>

                <li
                    v-for="id in missing"
                    :key="id"
                    class="row missing"
                >
                    <LIcon
                        class="icon"
                        :icon="faTriangleExclamation"
                    />
                    <span class="name">Deleted file</span>
                    <LButton
                        :disabled="!enabled"
                        :icon="faXmark"
                        small
                        square
                        title="Remove this import"
                        transparent
                        @click="remove(id)"
                    />
                </li>
            </ul>
            <p
                v-else
                class="empty"
            >
                No file added yet.
            </p>

            <LDropdown
                class="add"
                :disabled="!enabled || !available.length"
                :model-value="undefined"
                :options="available"
                :placeholder="available.length ? 'Add a CSS file…' : 'No other file to add'"
                small
                @update:model-value="add(String($event))"
            />

            <p
                v-if="!entries.length"
                class="hint"
            >
                Create CSS files in the plugin workspace first.
            </p>
            <p
                v-else-if="globals.length"
                class="hint"
            >
                Global files are always loaded: {{ globals.map((entry) => entry.name).join(", ") }}.
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { faFileCode, faTriangleExclamation, faXmark } from "@fortawesome/free-solid-svg-icons";
import { LButton, LDropdown, LIcon, LSwitch } from "@luna-park/design";
import type { TElementPanelProps } from "@luna-park/plugin";
import { computed } from "vue";

import { internals } from "@/features/internals/internals.ts";
import type { TStylesheetsOptions } from "@/features/stylesheets/runtime.ts";
import { orderedStylesheets as entries } from "@/features/stylesheets/state.ts";

const props = defineProps<TElementPanelProps<TStylesheetsOptions>>();

const emits = defineEmits<(e: "update:modelValue", value: TStylesheetsOptions) => void>();

/** Missing (project saved before the switch existed) means on. */
const enabled = computed(() => props.modelValue?.enabled !== false);
const selected = computed(() => props.modelValue?.sheets ?? []);

const imported = computed(() => selected.value.flatMap((id) => Object.hasOwn(internals.stylesheets, id) ? [internals.stylesheets[id]] : []));
/** Imported ids whose file was deleted. */
const missing = computed(() => selected.value.filter((id) => !Object.hasOwn(internals.stylesheets, id)));
const globals = computed(() => entries.value.filter((entry) => entry.global));
/** Files that can still be added: not global (always loaded) and not already imported. */
const available = computed(() => entries.value
    .filter((entry) => !entry.global && !selected.value.includes(entry.id))
    .map((entry) => ({ label: entry.name, value: entry.id })));

function update(patch: Partial<TStylesheetsOptions>) {
    emits("update:modelValue", { ...props.modelValue, enabled: enabled.value, sheets: selected.value, ...patch });
}

function setEnabled(value: boolean) {
    update({ enabled: value });
}

function add(id: string) {
    if (Object.hasOwn(internals.stylesheets, id) && !selected.value.includes(id)) {
        update({ sheets: [...selected.value, id] });
    }
}

function remove(id: string) {
    update({ sheets: selected.value.filter((value) => value !== id) });
}
</script>

<style scoped>
.panel {
    display: flex;
    flex-direction: column;
    gap: var(--length-xs);
    padding: var(--length-xxs) var(--length-xs);
    font-size: var(--font-size-s);

    .switch-row {
        display: flex;
        gap: var(--length-s);
        align-items: center;
        justify-content: space-between;

        .label {
            display: flex;
            flex-direction: column;
            gap: var(--length-xxxs);
            min-width: 0;
        }

        .title {
            font-weight: 600;
        }
    }

    .hint {
        margin: 0;
        color: var(--color-content-liter);
        font-size: var(--font-size-xs);
        line-height: 1.4;
    }

    .files {
        display: flex;
        flex-direction: column;
        gap: var(--length-xs);
        transition: opacity 0.15s;

        &.off {
            opacity: 0.5;
        }
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: var(--length-xxxs);
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .row {
        display: flex;
        gap: var(--length-xs);
        align-items: center;
        padding: var(--length-xxxs) var(--length-xxxs) var(--length-xxxs) var(--length-xs);
        border-radius: var(--length-radius-xs);
        background: var(--color-soft-lite);

        .icon {
            flex: none;
            color: var(--color-content-liter);
        }

        .name {
            flex: 1 1 auto;
            overflow: hidden;
            min-width: 0;
            font-family: var(--font-monospace), ui-monospace, monospace;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        &.missing {
            color: var(--color-warning);
            font-style: italic;
        }
    }

    .empty {
        margin: 0;
        color: var(--color-content-liter);
        font-size: var(--font-size-xs);
    }
}
</style>
