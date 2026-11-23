<!--
    One tile of the "Files" section: a CSS file, or the "New file" / "Import" actions (`create` variant).
    Everything else (click, pointer events, class) falls through to the root `<button>`.
-->
<template>
    <button
        class="tile"
        :class="{ active, create: variant === 'create', muted }"
        type="button"
    >
        <span class="head">
            <LIcon :icon="icon" />
            <span
                v-if="position !== undefined"
                class="position"
            >
                {{ position + 1 }}
            </span>
            <LIcon
                v-if="flag === 'global'"
                class="flag"
                :icon="faGlobe"
                title="Global: loaded on every page"
            />
            <LIcon
                v-else-if="flag === 'scoped'"
                class="flag"
                :icon="faCrosshairs"
                title="Scoped: only applies inside the elements that import it"
            />
        </span>
        <span class="name">{{ title }}</span>
        <span class="meta">{{ meta }}</span>
    </button>
</template>

<script setup lang="ts">
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { faCrosshairs, faGlobe } from "@fortawesome/free-solid-svg-icons";
import { LIcon } from "@luna-park/design";

defineProps<{
    active?: boolean;
    flag?: "global" | "scoped";
    icon: IconDefinition;
    meta: string;
    /** Hides the content (the empty slot left by a tile that is being dragged). */
    muted?: boolean;
    /** Zero-based load position, shown as a number. */
    position?: number;
    title: string;
    variant?: "create" | "file";
}>();
</script>

<style scoped>
.tile {
    display: flex;
    flex-direction: column;
    gap: var(--length-xxs);
    align-items: flex-start;
    box-sizing: border-box;
    min-width: 0;
    padding: var(--length-s);
    border: 1px solid var(--color-background-2);
    border-radius: var(--length-radius-s);
    background: var(--color-background-dark);
    color: var(--color-content);
    font: inherit;
    text-align: left;
    cursor: pointer;
    user-select: none;
    -webkit-user-drag: none;
    transition: border-color 0.15s, background-color 0.15s, color 0.15s;

    &:hover {
        border-color: var(--color-content-liter);
    }

    &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
    }

    &.active {
        border-color: var(--color-primary);
        background: var(--color-primary-litest);
    }

    .head {
        display: flex;
        gap: var(--length-xs);
        align-items: center;
        margin-bottom: var(--length-xxs);
        color: var(--color-content-liter);
    }

    &.active .head {
        color: var(--color-primary);
    }

    .position {
        padding: 0 var(--length-xs);
        border-radius: var(--length-radius-xs);
        background: var(--color-soft);
        font-size: var(--font-size-xs);
        font-weight: 600;
    }

    .flag {
        color: var(--color-primary);
    }

    .name {
        overflow: hidden;
        max-width: 100%;
        font-family: var(--font-monospace), ui-monospace, monospace;
        font-size: var(--font-size-s);
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .meta {
        color: var(--color-content-liter);
        font-size: var(--font-size-xs);
    }

    &.muted {
        .head,
        .name,
        .meta {
            visibility: hidden;
        }
    }

    &.create {
        border-style: dashed;
        background: transparent;

        &:hover {
            border-color: var(--color-primary);
            color: var(--color-primary);
        }
    }
}
</style>
