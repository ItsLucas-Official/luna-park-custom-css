<!--
    Workspace section "Files": one tile per CSS file (in load order), plus tiles to create or import
    files. `.css` files can also be dropped on the grid to import them.

    Reordering is a pointer drag: the pressed tile is lifted and follows the pointer (slight tilt,
    shadow), the other tiles slide out of the way as it passes over them (`TransitionGroup` FLIP),
    and on release it settles into its slot before the new order is saved. Escape cancels.
    Alt + Left / Right moves the focused tile with the keyboard.
    The selected file is shared with the "File settings" and "Editor" sections (see ./state.ts).
-->
<template>
    <div
        ref="grid"
        class="files"
        :class="{ importing, sorting: Boolean(dragId) }"
        @dragleave.self="importing = false"
        @dragover="onFileOver"
        @drop.prevent="onFileDrop"
    >
        <TransitionGroup
            class="tiles"
            name="tile"
            tag="div"
        >
            <LStylesheetTile
                v-for="(entry, position) in shown"
                :key="entry.id"
                :active="entry.id === current?.id"
                class="file"
                :class="{ placeholder: entry.id === dragId }"
                :data-id="entry.id"
                :flag="flagOf(entry)"
                :icon="faFileCode"
                :meta="describe(entry.css)"
                :muted="entry.id === dragId"
                :position="position"
                :title="entry.name"
                @click="onClick(entry.id)"
                @dragstart.prevent
                @keydown.alt.left.prevent="shift(entry.id, -1)"
                @keydown.alt.right.prevent="shift(entry.id, 1)"
                @pointerdown="onPointerDown($event, entry.id)"
            />
        </TransitionGroup>

        <LStylesheetTile
            :icon="faPlus"
            :meta="entries.length ? 'Add another CSS file' : 'Create your first CSS file'"
            title="New file"
            variant="create"
            @click="create"
        />

        <LStylesheetTile
            :icon="faFileImport"
            meta="Choose or drop .css files"
            title="Import"
            variant="create"
            @click="picker?.click()"
        />

        <!-- The lifted tile, following the pointer -->
        <div
            v-if="ghost"
            aria-hidden="true"
            class="ghost"
            :class="{ lifted: ghost.lifted, settling: ghost.settling }"
            :style="{ '--tilt': `${ ghost.tilt }deg`, 'height': `${ ghost.height }px`, 'translate': `${ ghost.x }px ${ ghost.y }px`, 'width': `${ ghost.width }px` }"
        >
            <LStylesheetTile
                active
                class="ghost-tile"
                :flag="flagOf(ghost.entry)"
                :icon="faFileCode"
                :meta="describe(ghost.entry.css)"
                :position="ghost.position"
                tabindex="-1"
                :title="ghost.entry.name"
            />
        </div>

        <input
            ref="picker"
            accept=".css,text/css"
            aria-label="Import CSS files"
            hidden
            multiple
            type="file"
            @change="onPick"
        >
    </div>

    <p
        v-if="skipped.length"
        class="skipped"
        role="alert"
    >
        Not imported (not a .css file, or larger than 1 MB): {{ skipped.join(", ") }}
    </p>
</template>

<script setup lang="ts">
import { faFileCode, faFileImport, faPlus } from "@fortawesome/free-solid-svg-icons";
import { computed, nextTick, onBeforeUnmount, ref } from "vue";

import type { TStylesheetEntry } from "@/features/internals/internals.ts";
import { internals } from "@/features/internals/internals.ts";
import LStylesheetTile from "@/features/stylesheets/LStylesheetTile.vue";
import {
    addStylesheet,
    currentStylesheet as current,
    importFiles,
    moveStylesheetTo,
    orderedStylesheets as entries,
    selectedId
} from "@/features/stylesheets/state.ts";

/** Pointer distance before a press becomes a drag (below it, it stays a click). */
const DRAG_THRESHOLD = 5;
/** Share of a tile (centered) the pointer must be over to swap places with it. */
const SWAP_ZONE = 0.6;
const SETTLE_MS = 220;
const MAX_TILT = 7;

type TGhost = {
    entry: TStylesheetEntry;
    height: number;
    lifted: boolean;
    position: number;
    settling: boolean;
    tilt: number;
    width: number;
    x: number;
    y: number;
};

const grid = ref<HTMLElement>();
const picker = ref<HTMLInputElement>();
const importing = ref(false);
const skipped = ref<Array<string>>([]);

/** Order shown while dragging (ids), before it is saved. */
const draft = ref<Array<string>>();
const dragId = ref<string>();
const ghost = ref<TGhost>();

const shown = computed(() => draft.value ? draft.value.map((id) => internals.stylesheets[id]).filter(Boolean) : entries.value);

let press: { height: number; id: string; offsetX: number; offsetY: number; startIds: Array<string>; startX: number; startY: number; width: number; } | undefined;
let lastX = 0;
let tiltTimer: ReturnType<typeof setTimeout> | undefined;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let suppressClick = false;

function flagOf(entry: TStylesheetEntry) {
    return entry.global ? "global" : entry.scoped ? "scoped" : undefined;
}

function describe(css: string) {
    const lines = css.trim() ? css.trim().split("\n").length : 0;

    return lines ? `${ lines } ${ lines === 1 ? "line" : "lines" }` : "Empty";
}

function create() {
    selectedId.value = addStylesheet();
}

function onClick(id: string) {
    if (!suppressClick) {
        selectedId.value = id;
    }
}

// ─── Reordering ─────────────────────────────────────────────────────────────────────────────
function tileOf(id: string) {
    return grid.value?.querySelector<HTMLElement>(`.file[data-id="${ CSS.escape(id) }"]`) ?? undefined;
}

function onPointerDown(event: PointerEvent, id: string) {
    if (event.button !== 0 || !event.isPrimary || press || settleTimer) {
        return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

    press = {
        id,
        height: rect.height,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        startIds: entries.value.map((entry) => entry.id),
        startX: event.clientX,
        startY: event.clientY,
        width: rect.width
    };
    lastX = event.clientX;

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);
}

function stopListening() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("keydown", onKeyDown);
}

/** Pointer position in the grid's own coordinates (ignores transforms, unlike `getBoundingClientRect` of the tiles). */
function toGrid(event: PointerEvent) {
    const rect = grid.value!.getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function beginDrag() {
    if (!press) {
        return;
    }

    const entry = internals.stylesheets[press.id];
    const tile = tileOf(press.id);

    if (!entry || !tile) {
        return;
    }

    draft.value = [...press.startIds];
    dragId.value = press.id;
    selectedId.value = press.id;
    ghost.value = {
        entry,
        height: press.height,
        lifted: false,
        position: press.startIds.indexOf(press.id),
        settling: false,
        tilt: 0,
        width: press.width,
        x: tile.offsetLeft,
        y: tile.offsetTop
    };

    // Next frame: the lift transition (scale, shadow) plays from the resting state.
    requestAnimationFrame(() => {
        if (ghost.value) {
            ghost.value.lifted = true;
        }
    });
}

function onPointerMove(event: PointerEvent) {
    if (!press) {
        return;
    }

    if (!dragId.value) {
        if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < DRAG_THRESHOLD) {
            return;
        }

        beginDrag();
    }

    if (!ghost.value || !draft.value) {
        return;
    }

    const point = toGrid(event);

    ghost.value.x = point.x - press.offsetX;
    ghost.value.y = point.y - press.offsetY;

    // Lean into the movement, then relax when the pointer rests.
    ghost.value.tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, (event.clientX - lastX) * 0.8));
    lastX = event.clientX;
    clearTimeout(tiltTimer);
    tiltTimer = setTimeout(() => {
        if (ghost.value) {
            ghost.value.tilt = 0;
        }
    }, 90);

    // Swap places with the tile under the pointer.
    for (const tile of grid.value!.querySelectorAll<HTMLElement>(".file[data-id]")) {
        const id = tile.dataset.id!;
        const insetX = tile.offsetWidth * (1 - SWAP_ZONE) / 2;
        const insetY = tile.offsetHeight * (1 - SWAP_ZONE) / 2;
        const over = point.x > tile.offsetLeft + insetX && point.x < tile.offsetLeft + tile.offsetWidth - insetX &&
            point.y > tile.offsetTop + insetY && point.y < tile.offsetTop + tile.offsetHeight - insetY;

        if (over && id !== dragId.value) {
            const next = draft.value.filter((value) => value !== dragId.value);

            next.splice(draft.value.indexOf(id), 0, dragId.value!);
            draft.value = next;
            ghost.value.position = next.indexOf(dragId.value!);
            break;
        }
    }

    // Keep the number on the lifted tile in sync with its slot.
    ghost.value.position = draft.value.indexOf(dragId.value!);
}

/** Moves the lifted tile into its slot, then saves (or discards) the new order. */
async function settle(save: boolean) {
    stopListening();
    clearTimeout(tiltTimer);

    const id = dragId.value;

    if (!id || !ghost.value || !draft.value) {
        press = undefined;

        return;
    }

    if (!save) {
        draft.value = [...(press?.startIds ?? draft.value)];
        await nextTick();
    }

    const slot = tileOf(id);
    const finalIndex = draft.value.indexOf(id);

    ghost.value.settling = true;
    ghost.value.lifted = false;
    ghost.value.tilt = 0;

    if (slot) {
        ghost.value.x = slot.offsetLeft;
        ghost.value.y = slot.offsetTop;
    }

    suppressClick = true;
    settleTimer = setTimeout(() => {
        if (save) {
            moveStylesheetTo(id, finalIndex);
        }

        draft.value = undefined;
        dragId.value = undefined;
        ghost.value = undefined;
        press = undefined;
        settleTimer = undefined;
        setTimeout(() => {
            suppressClick = false;
        }, 0);
    }, SETTLE_MS);
}

function onPointerUp() {
    if (!dragId.value) {
        // A plain click: the `click` event selects the file.
        stopListening();
        press = undefined;

        return;
    }

    void settle(true);
}

function onPointerCancel() {
    if (dragId.value) {
        void settle(false);
    }
    else {
        stopListening();
        press = undefined;
    }
}

function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && dragId.value) {
        void settle(false);
    }
}

/** Keyboard: Alt + Left / Right. The moved tile slides, and keeps the focus. */
async function shift(id: string, direction: -1 | 1) {
    const from = entries.value.findIndex((entry) => entry.id === id);

    moveStylesheetTo(id, from + direction);
    await nextTick();
    tileOf(id)?.focus();
}

onBeforeUnmount(() => {
    stopListening();
    clearTimeout(tiltTimer);
    clearTimeout(settleTimer);
});

// ─── Importing files dropped from outside the app ───────────────────────────────────────────
async function load(files: ArrayLike<File>) {
    const result = await importFiles(files);

    skipped.value = result.skipped;
    selectedId.value = result.ids.at(-1) ?? selectedId.value;
}

async function onPick(event: Event) {
    const input = event.target as HTMLInputElement;

    await load(input.files ?? []);
    input.value = "";
}

function onFileOver(event: DragEvent) {
    if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
        importing.value = true;
    }
}

async function onFileDrop(event: DragEvent) {
    importing.value = false;
    await load(event.dataTransfer?.files ?? []);
}
</script>

<style scoped>
.files {
    position: relative;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: var(--length-xs);
    border-radius: var(--length-radius-s);

    &.importing {
        outline: 2px dashed var(--color-primary);
        outline-offset: var(--length-xxs);
    }

    /* The wrapper only exists for TransitionGroup: its children are the grid items. */
    .tiles {
        display: contents;
    }

    .file {
        cursor: grab;
        touch-action: none;
    }

    /* The cursor is inherited by the tile's content. */
    &.sorting,
    &.sorting .file,
    &.sorting .ghost-tile {
        cursor: grabbing;
    }

    /* The slot the lifted tile will land in (its content is hidden by the tile's `muted` state). */
    .file.placeholder {
        border-style: dashed;
        border-color: var(--color-primary-liter);
        background: var(--color-primary-softest);
        opacity: 0.7;
    }

    /* Other tiles slide into place when the order changes. */
    .tile-move {
        transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    /* The lifted tile, following the pointer. */
    .ghost {
        position: absolute;
        inset: 0 auto auto 0;
        z-index: 10;
        box-sizing: border-box;
        pointer-events: none;
        will-change: translate, scale, rotate;
        transition: scale 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), rotate 0.18s ease-out, filter 0.18s;
        filter: drop-shadow(0 1px 2px rgb(0 0 0 / 15%));

        &.lifted {
            scale: 1.06;
            rotate: var(--tilt, 0deg);
            filter: drop-shadow(0 14px 22px rgb(0 0 0 / 35%));
        }

        &.settling {
            transition: translate 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), scale 0.22s ease-out, rotate 0.22s ease-out, filter 0.22s;
        }

        /* Same size as the tile it was lifted from, whatever its content. */
        .ghost-tile {
            width: 100%;
            height: 100%;
            border-color: var(--color-primary);
            background: var(--color-background-0);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .tile-move,
        .ghost,
        .ghost.settling {
            transition: none;
        }

        .ghost.lifted {
            rotate: 0deg;
        }
    }
}

.skipped {
    margin: var(--length-xs) 0 0;
    color: var(--color-warning);
    font-size: var(--font-size-xs);
}
</style>
