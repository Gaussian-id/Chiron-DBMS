<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ChironQueryEditor from "@/components/vector/ChironQueryEditor.vue";
import type { ChironAssistantReply, ChironAssistantRequest } from "@/types/chirondb";
import type { QueryResult } from "@/types/database";
import { chironResponseText } from "@/lib/ai/chironResponseText";
const DataGrid = defineAsyncComponent(() => import("@/components/grid/DataGrid.vue"));
const props = defineProps<{ value: ChironAssistantReply; busy: boolean; stale: boolean; connectionName: string; model: string }>();
const emit = defineEmits<{ action: [request: ChironAssistantRequest]; open: [query: string] }>();
const previewOpen = ref(false);
const result = computed<QueryResult>(() => {
  const body = props.value.result?.body;
  const rows = body?.rows ?? [];
  const columns = body?.columns ?? [...new Set(rows.flatMap(Object.keys))];
  return { columns, column_types: [], column_sortables: columns.map(() => false), rows: rows.map((row) => columns.map((c) => row[c] ?? null)) as QueryResult["rows"], affected_rows: Number(body?.stats?.affected ?? 0), execution_time_ms: Number(body?.stats?.took_ms ?? 0) };
});
function approve() {
  if (props.value.run_id && props.value.approval_token) emit("action", { action: "approve", run_id: props.value.run_id, approval_token: props.value.approval_token });
}
function cancel() {
  if (props.value.run_id) emit("action", { action: "cancel", run_id: props.value.run_id });
}
function share() {
  if (props.value.run_id && props.value.sharing_preview) emit("action", { action: "explain", run_id: props.value.run_id, approved_preview: props.value.sharing_preview });
  previewOpen.value = false;
}
async function copy() {
  await navigator.clipboard.writeText(props.value.query ?? "");
}
</script>

<template>
  <section class="mt-2 space-y-2 rounded border bg-background p-2" aria-label="ChironQL proposal and local results">
    <p class="break-all text-muted-foreground">{{ connectionName }} / {{ value.collection || "All collections" }} · {{ model }}</p>
    <ChironQueryEditor v-if="value.query" :model-value="value.query" read-only label="Generated ChironQL" />
    <div class="flex flex-wrap gap-2">
      <Button v-if="value.query" size="sm" variant="outline" @click="copy">Copy</Button>
      <Button v-if="value.query" size="sm" variant="outline" @click="emit('open', value.query)">Open in workspace</Button>
      <Button v-if="value.approval_token" size="sm" :disabled="busy || stale" @click="approve">Approve unchanged query</Button>
      <Button v-if="value.approval_token" size="sm" variant="outline" :disabled="busy" @click="cancel">Cancel</Button>
      <Button v-if="value.sharing_preview && value.sharing_preview !== '[]' && !value.approval_token" size="sm" variant="outline" :disabled="busy || stale" @click="previewOpen = true">Preview data sharing</Button>
    </div>
    <p v-if="stale" class="text-muted-foreground" role="status">Saved result. Generate a new proposal to run it again.</p>
    <p role="status" class="whitespace-pre-wrap [overflow-wrap:anywhere]">{{ chironResponseText(value.message) }}</p>
    <p v-if="value.result?.body.query_id" class="font-mono">Query ID: {{ value.result.body.query_id }}</p>
    <div v-if="value.result?.body.rows" class="h-64 overflow-hidden rounded border">
      <DataGrid :result="result" context="results" database-type="chirondb" :editable="false" :loading="false" class="h-full" />
    </div>
    <details v-if="value.result">
      <summary>Local response and diagnostics (not shared)</summary>
      <pre class="max-h-64 overflow-auto whitespace-pre-wrap">{{ JSON.stringify(value.result, null, 2) }}</pre>
    </details>
    <p v-if="value.explanation" class="whitespace-pre-wrap [overflow-wrap:anywhere]">{{ chironResponseText(value.explanation) }}</p>
    <Dialog v-model:open="previewOpen">
      <DialogContent class="max-w-2xl">
        <DialogHeader
          ><DialogTitle>Share this subset with {{ model }}?</DialogTitle><DialogDescription>Only the JSON below will be sent for this explanation: at most 20 rows and 16 KiB, with vector fields omitted. Review it for sensitive values. Cancelling sends no data.</DialogDescription></DialogHeader
        >
        <pre class="max-h-80 overflow-auto whitespace-pre-wrap text-xs">{{ value.sharing_preview }}</pre>
        <DialogFooter><Button variant="outline" @click="previewOpen = false">Cancel</Button><Button :disabled="busy || stale" @click="share">Share this preview and explain</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
