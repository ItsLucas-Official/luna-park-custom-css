<!--
    Workspace section "File settings": name, Global switch, duplicate and delete for the selected file.
-->
<template>
    <LCard>
        <p
            v-if="!current"
            class="empty"
        >
            Select a file above, or create one, to change its settings.
        </p>

        <template v-else>
            <LSettingRow
                :description="nameError || 'Enter confirms, Escape cancels. The .css extension is added for you.'"
                title="Name"
            >
                <LInput
                    class="name"
                    :error="nameError"
                    :model-value="draftName"
                    small
                    @enter="commitName"
                    @escape="resetName"
                    @focusout="commitName"
                    @update:model-value="draftName = String($event ?? '')"
                />
            </LSettingRow>
            <LSettingRow
                description="Load this file on every page without importing it. Keep selectors specific."
                title="Global"
            >
                <LSwitch
                    v-model="current.global"
                    :disabled="current.scoped === true"
                    small
                />
            </LSettingRow>
            <LSettingRow
                description="The CSS only applies inside the page or component that imports it (wrapped in @scope; use :scope for the root element). Not available for global files."
                title="Scoped"
            >
                <LSwitch
                    :disabled="current.global"
                    :model-value="current.scoped === true"
                    small
                    @update:model-value="current.scoped = Boolean($event)"
                />
            </LSettingRow>
            <LSettingRow
                description="Download this file as a .css file."
                title="Export"
            >
                <LButton
                    :icon="faDownload"
                    small
                    @click="exportStylesheet(current.id)"
                >
                    Download
                </LButton>
            </LSettingRow>
            <LSettingRow
                description="Create an independent copy of this file."
                title="Duplicate"
            >
                <LButton
                    :icon="faCopy"
                    small
                    @click="duplicate"
                >
                    Duplicate
                </LButton>
            </LSettingRow>
            <LSettingRow
                :description="confirming ? 'This cannot be undone.' : 'Pages and components importing it keep a “Deleted file” entry that you can remove.'"
                title="Delete"
            >
                <div class="actions">
                    <template v-if="confirming">
                        <LButton
                            small
                            @click="confirming = false"
                        >
                            Cancel
                        </LButton>
                        <LButton
                            error
                            :icon="faTrash"
                            small
                            @click="remove"
                        >
                            Delete
                        </LButton>
                    </template>
                    <LButton
                        v-else
                        error
                        :icon="faTrash"
                        small
                        @click="confirming = true"
                    >
                        Delete
                    </LButton>
                </div>
            </LSettingRow>
        </template>
    </LCard>
</template>

<script setup lang="ts">
import { faCopy, faDownload, faTrash } from "@fortawesome/free-solid-svg-icons";
import { LButton, LCard, LInput, LSettingRow, LSwitch } from "@luna-park/design";
import { ref, watch } from "vue";

import {
    currentStylesheet as current,
    duplicateStylesheet,
    exportStylesheet,
    normalizeName,
    orderedStylesheets,
    removeStylesheet,
    renameStylesheet,
    selectedId
} from "@/features/stylesheets/state.ts";

const confirming = ref(false);
const draftName = ref("");
const draftId = ref<string>();
const nameError = ref("");

// Keep the name field in sync with the selected file (and with renames made elsewhere).
watch(() => [current.value?.id, current.value?.name], () => {
    draftName.value = current.value?.name ?? "";
    draftId.value = current.value?.id;
    nameError.value = "";
    confirming.value = false;
}, { immediate: true });

function commitName() {
    // The draft belongs to `draftId`: never apply it to another file (e.g. when the field loses
    // focus because its file was just deleted or another one was selected).
    if (!current.value || draftId.value !== current.value.id || draftName.value === current.value.name) {
        return;
    }

    if (!normalizeName(draftName.value)) {
        nameError.value = "Enter a file name, for example buttons.css";

        return;
    }

    nameError.value = "";
    draftName.value = renameStylesheet(current.value.id, draftName.value);
}

function resetName() {
    draftName.value = current.value?.name ?? "";
    nameError.value = "";
}

function duplicate() {
    if (current.value) {
        selectedId.value = duplicateStylesheet(current.value.id) ?? selectedId.value;
    }
}

function remove() {
    const target = current.value;

    if (!target) {
        return;
    }

    // Select the neighbour of the deleted file (the one after it, else the one before).
    const ids = orderedStylesheets.value.map((entry) => entry.id);
    const index = ids.indexOf(target.id);
    const next = ids[index + 1] ?? ids[index - 1];

    confirming.value = false;
    selectedId.value = next;
    removeStylesheet(target.id);
}
</script>

<style scoped>
.empty {
    margin: 0;
    padding: var(--length-s);
    color: var(--color-content-liter);
    font-size: var(--font-size-s);
    text-align: center;
}

.name {
    width: 220px;
    font-family: var(--font-monospace), ui-monospace, monospace;
}

/* Buttons keep their label on one line, whatever the width of the row. */
.actions {
    display: flex;
    flex: none;
    flex-wrap: nowrap;
    gap: var(--length-xs);
    align-items: center;
    white-space: nowrap;

    :deep(button) {
        flex: none;
        white-space: nowrap;
    }
}
</style>
