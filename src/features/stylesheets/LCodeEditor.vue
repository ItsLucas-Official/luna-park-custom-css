<!--
    CSS code editor (CodeMirror 6), editor only. `v-model` is the CSS text.

    Emits `status` ({ line, column, lines, length }) on every cursor or content change, so the
    parent can show a status bar. Colours come from the editor's CSS variables so it follows the
    light and dark themes; the syntax colours are mid-tones that read well on both.
-->
<template>
    <div
        ref="host"
        aria-label="CSS code editor"
        class="code-editor"
    />
</template>

<script setup lang="ts">
import type { CompletionContext } from "@codemirror/autocomplete";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { css, cssLanguage } from "@codemirror/lang-css";
import { bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { EditorState } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { Decoration, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, ViewPlugin } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import { collectCssVariables } from "@/features/stylesheets/cssVariables.ts";

export type TEditorStatus = {
    column: number;
    /** Number of syntax errors found by the CSS parser. */
    errors: number;
    length: number;
    line: number;
    lines: number;
};

const model = defineModel<string>({ default: "" });

const emits = defineEmits<(e: "status", value: TEditorStatus) => void>();

const host = ref<HTMLElement>();
let view: EditorView | undefined;

// Syntax colours come from Luna Park's theme variables, so they follow the light and dark themes.
const highlight = HighlightStyle.define([
    { color: "var(--color-type-interface)", tag: [tags.keyword, tags.atom] },
    { color: "var(--color-primary)", tag: [tags.propertyName, tags.className, tags.labelName] },
    { color: "var(--color-type-number)", tag: [tags.string, tags.url] },
    { color: "var(--color-warning)", tag: [tags.number, tags.unit, tags.color] },
    { color: "var(--color-type-string)", tag: [tags.tagName, tags.typeName, tags.variableName] },
    { color: "var(--color-content-liter)", fontStyle: "italic", tag: tags.comment }
]);

/** Suggests CSS variables after `--` and right after `var(`. */
function variableCompletion(context: CompletionContext) {
    const word = context.matchBefore(/--[\w-]*/);
    const call = word ? undefined : context.matchBefore(/var\(\s*$/);

    if (!word && !call) {
        return null;
    }

    return {
        from: word ? word.from : context.pos,
        options: collectCssVariables().map((label) => ({ label, type: "variable" })),
        validFor: /^--[\w-]*$/
    };
}

/** Underlines the parts the CSS parser could not understand. */
function errorRanges(state: EditorState) {
    const ranges: Array<Range<Decoration>> = [];
    const mark = Decoration.mark({ attributes: { title: "Syntax error" }, class: "cm-css-error" });

    syntaxTree(state).iterate({
        enter: (node) => {
            if (node.type.isError && state.doc.length > 0) {
                const from = Math.min(node.from, state.doc.length - 1);

                ranges.push(mark.range(from, Math.max(node.to, from + 1)));
            }
        }
    });

    return ranges;
}

const errorMarks = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = Decoration.set(errorRanges(view.state), true);
    }

    update(update: { docChanged: boolean; state: EditorState; view: EditorView; }) {
        if (update.docChanged) {
            this.decorations = Decoration.set(errorRanges(update.state), true);
        }
    }
}, { decorations: (plugin) => plugin.decorations });

const mono = "var(--font-monospace), ui-monospace, Consolas, monospace";
const subtle = "var(--color-soft-lite)";

const theme = EditorView.theme({
    "&": {
        backgroundColor: "var(--color-background-1)",
        color: "var(--color-content)",
        fontSize: "var(--font-size-s)",
        height: "100%"
    },
    "&.cm-focused": { outline: "none" },
    ".cm-activeLine": { backgroundColor: subtle },
    ".cm-activeLineGutter": { backgroundColor: subtle, color: "var(--color-content)" },
    ".cm-content": { caretColor: "var(--color-primary)", fontFamily: mono, padding: "var(--length-xs) 0" },
    ".cm-css-error": { textDecoration: "underline wavy var(--color-error)", textUnderlineOffset: "3px" },
    ".cm-cursor": { borderLeftColor: "var(--color-primary)", borderLeftWidth: "2px" },
    ".cm-foldGutter span": { cursor: "pointer" },
    ".cm-gutters": {
        backgroundColor: "var(--color-background-0)",
        borderRight: "1px solid var(--color-soft)",
        color: "var(--color-content-liter)"
    },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "var(--color-primary-soft)",
        outline: "1px solid var(--color-primary-liter)"
    },
    ".cm-scroller": { fontFamily: mono, lineHeight: "1.6", overflow: "auto" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
        backgroundColor: "var(--color-primary-litest)"
    },
    ".cm-tooltip": {
        backgroundColor: "var(--color-background-2)",
        border: "1px solid var(--color-soft)",
        borderRadius: "var(--length-radius-xs)",
        color: "var(--color-content)"
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "var(--color-primary-soft)",
        color: "var(--color-content)"
    }
});

function report(state: EditorState) {
    const head = state.selection.main.head;
    const line = state.doc.lineAt(head);

    emits("status", { column: head - line.from + 1, errors: errorRanges(state).length, length: state.doc.length, line: line.number, lines: state.doc.lines });
}

onMounted(() => {
    view = new EditorView({
        parent: host.value,
        state: EditorState.create({
            doc: model.value,
            extensions: [
                lineNumbers(),
                foldGutter(),
                highlightActiveLineGutter(),
                highlightActiveLine(),
                history(),
                drawSelection(),
                indentOnInput(),
                bracketMatching(),
                closeBrackets(),
                autocompletion(),
                css(),
                cssLanguage.data.of({ autocomplete: variableCompletion }),
                errorMarks,
                syntaxHighlighting(highlight),
                theme,
                keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
                EditorState.tabSize.of(4),
                indentUnit.of("    "),
                EditorView.contentAttributes.of({ "aria-label": "CSS code" }),
                EditorView.updateListener.of((update) => {
                    if (update.docChanged) {
                        model.value = update.state.doc.toString();
                    }

                    if (update.docChanged || update.selectionSet) {
                        report(update.state);
                    }
                })
            ]
        })
    });

    report(view.state);
});

// External change (another file selected, or the file changed elsewhere): replace the document.
watch(model, (value) => {
    if (view && value !== view.state.doc.toString()) {
        view.dispatch({ changes: { from: 0, insert: value, to: view.state.doc.length } });
    }
});

onBeforeUnmount(() => view?.destroy());

defineExpose({ focus: () => view?.focus() });
</script>

<style scoped>
.code-editor {
    height: 100%;
    min-height: 0;
}

.code-editor :deep(.cm-editor) {
    height: 100%;
}
</style>
