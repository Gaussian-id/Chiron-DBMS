<script setup lang="ts">
import { ref, watch } from "vue";
import { chironCommentExtension } from "@/lib/chiron/comments";
import { useCellDetailEditor } from "@/composables/useCellDetailEditor";
import { useTheme } from "@/composables/useTheme";
import { useSettingsStore } from "@/stores/settingsStore";

const props = defineProps<{ modelValue: string; readOnly: boolean; label: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const host = ref<HTMLElement>();
const settings = useSettingsStore();
const { isDark, themePalette } = useTheme();
// Reuse the app's CodeMirror engine, search, undo, font and theme preferences.
// Do not attach an SQL grammar or relational completion/formatting rules.
const editor = useCellDetailEditor({
  lineNumbers: true,
  extensions: [chironCommentExtension],
  readOnly: () => props.readOnly,
  lineWrapping: () => settings.editorSettings.wordWrap,
  onChange: (value) => emit("update:modelValue", value),
  editorTheme: () => settings.editorSettings.theme,
  customColors: () => settings.editorSettings.customThemeColors,
  appAppearance: () => (isDark.value ? "dark" : "light"),
  appPalette: () => themePalette.value,
  fontSize: () => settings.editorSettings.fontSize,
  fontFamily: () => settings.editorSettings.fontFamily,
});
defineExpose({
  getSelectedOrAll: () => {
    const view = editor.view.value;
    if (!view) return props.modelValue;
    const selection = view.state.selection.main;
    return selection.empty ? editor.getValue() : view.state.sliceDoc(selection.from, selection.to);
  },
});
watch(host, async (element) => {
  if (!element) return;
  await editor.create(element, props.modelValue, "text");
  editor.view.value?.contentDOM.setAttribute("aria-label", props.label);
});
watch(
  () => props.modelValue,
  (value) => {
    if (editor.getValue() !== value) editor.setValue(value, "text");
  },
);
</script>

<template>
  <div ref="host" class="h-40 min-h-32 w-full overflow-hidden focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring" />
</template>
