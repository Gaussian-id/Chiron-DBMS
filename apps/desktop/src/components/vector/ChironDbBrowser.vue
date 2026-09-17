<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Play, RefreshCcw, Square } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ErrorBanner from "@/components/ui/ErrorBanner.vue";
import ChironQueryEditor from "./ChironQueryEditor.vue";
import { ChironScriptRun, type ChironScriptResult } from "@/lib/chiron/script";
import * as api from "@/lib/backend/api";
import { useTabUiState } from "@/lib/tabs/tabUiState";
import type { ChironDbReply, ChironDbRequest } from "@/types/chirondb";
import type { QueryResult } from "@/types/database";

const DataGrid = defineAsyncComponent(() => import("@/components/grid/DataGrid.vue"));
const props = defineProps<{ connectionId: string; collection: string; initialQuery?: string }>();
const emit = defineEmits<{ "update:query": [query: string]; "update:busy": [busy: boolean] }>();
const { t } = useI18n();
const { initialState, track: trackUiState } = useTabUiState<{ query?: string; collection?: string; trace?: boolean }>({}, "ChironDbBrowser");
const query = ref(initialState.query ?? props.initialQuery ?? "SHOW COLLECTIONS;");
const collection = ref(initialState.collection ?? props.collection);
const trace = ref(initialState.trace ?? false);
const collections = ref<string[]>([]);
const busy = ref(false);
const error = ref("");
const metadataError = ref("");
const reply = ref<ChironDbReply>();
const browseResult = ref(false);
const pending = ref<{ request: ChironDbRequest; message: string }>();
const queryEditor = ref<InstanceType<typeof ChironQueryEditor>>();
const scriptResults = ref<ChironScriptResult[]>([]);
let activeRun: ChironScriptRun | undefined;
let approvalResolver: ((approved: boolean) => void) | undefined;
function stopRun() {
  activeRun?.stop();
  approvalResolver?.(false);
  approvalResolver = undefined;
  pending.value = undefined;
}
function selectResult(item: ChironScriptResult) {
  reply.value = item.reply;
  browseResult.value = false;
}
let generation = 0;
let mounted = true;

trackUiState(() => ({ query: query.value, collection: collection.value, trace: trace.value }));
watch(query, (value) => {
  pending.value = undefined;
  emit("update:query", value);
});
watch([collection, trace], () => {
  pending.value = undefined;
});
watch(collection, () => {
  reply.value = undefined;
  browseResult.value = false;
});
watch(busy, (value) => emit("update:busy", value));
onBeforeUnmount(() => {
  stopRun();
  mounted = false;
  generation++;
  emit("update:busy", false);
});
watch(
  () => props.connectionId,
  () => {
    stopRun();
    generation++;
    scriptResults.value = [];
    pending.value = undefined;
    reply.value = undefined;
    error.value = "";
    busy.value = false;
    collection.value = props.collection;
    query.value = props.initialQuery ?? "SHOW COLLECTIONS;";
    void refreshCollections();
  },
);

const result = computed<QueryResult>(() => {
  const body = reply.value?.body;
  const objects = browseResult.value ? (body?.points ?? []) : (body?.rows ?? []);
  const columns = browseResult.value ? [...new Set(objects.flatMap(Object.keys))] : (body?.columns ?? []);
  return {
    columns,
    column_types: [],
    column_sortables: columns.map(() => false),
    rows: objects.map((row) => columns.map((column) => row[column] ?? null)) as QueryResult["rows"],
    affected_rows: typeof body?.stats?.affected === "number" ? body.stats.affected : 0,
    execution_time_ms: typeof body?.stats?.took_ms === "number" ? body.stats.took_ms : 0,
  };
});
const nextOffset = computed(() => (browseResult.value ? reply.value?.body.next_offset : null));
const diagnostics = computed(() => {
  const body = reply.value?.body;
  return body ? JSON.stringify({ query_id: body.query_id, stats: body.stats, next: body.next, trace: body.trace }, null, 2) : "";
});

async function refreshCollections() {
  const connectionId = props.connectionId;
  metadataError.value = "";
  try {
    const items = await api.vectorListCollections(connectionId, "default");
    if (mounted && connectionId === props.connectionId) collections.value = items.map((item) => item.name);
  } catch (cause) {
    if (mounted && connectionId === props.connectionId) metadataError.value = String(cause);
  }
}

async function submit(request: ChironDbRequest) {
  if (busy.value) return;
  const current = ++generation;
  pending.value = undefined;
  error.value = "";
  busy.value = true;
  try {
    const response = await api.chirondbRequest(props.connectionId, request);
    if (current !== generation) return;
    if (response.status < 200 || response.status >= 300) {
      const body = response.body;
      const message = [body.error || `HTTP ${response.status}`, body.hint, body.code, body.position != null ? `${t("chiron.bytePosition")}: ${body.position}` : "", body.query_id].filter(Boolean).join("\n");
      if (request.operation === "execute" && (body.code === "dbm.confirmation_required" || body.code === "chironql.confirmation_required")) {
        pending.value = {
          request: { ...request, allow_destructive: true, confirm: body.code === "chironql.confirmation_required" },
          message: body.affected_estimate != null ? `${message}\n${t("chiron.affectedEstimate")}: ${body.affected_estimate}` : message,
        };
      } else {
        error.value = message;
      }
      // Keep failures inspectable, including the server's partial trace.
      reply.value = response;
      browseResult.value = false;
      return;
    }
    reply.value = response;
    browseResult.value = request.operation === "browse";
    if (request.operation === "execute") void refreshCollections();
  } catch (cause) {
    if (current === generation) error.value = String(cause);
  } finally {
    if (current === generation) busy.value = false;
  }
}

async function execute() {
  if (busy.value || pending.value) return;
  const current = ++generation;
  error.value = "";
  reply.value = undefined;
  browseResult.value = false;
  busy.value = true;
  const run = new ChironScriptRun({
    source: queryEditor.value?.getSelectedOrAll?.() ?? query.value,
    connectionId: props.connectionId,
    collection: collection.value || null,
    trace: trace.value,
    request: api.chirondbRequest,
    approve: (request, message) =>
      new Promise<boolean>((resolve) => {
        if (!mounted || current !== generation) {
          resolve(false);
          return;
        }
        pending.value = { request: { ...request }, message: `Connection: ${props.connectionId}\nCollection: ${request.collection ?? "Explicit query target"}\n${message}` };
        approvalResolver = resolve;
      }),
    changed: (results) => {
      if (!mounted || current !== generation) return;
      scriptResults.value = results;
      const latest = results.filter((r) => r.reply).slice(-1)[0];
      if (latest) reply.value = latest.reply;
      const failure = results.find((r) => r.status === "failed" || r.status === "uncertain");
      if (failure) error.value = failure.message ?? "Run failed.";
    },
  });
  activeRun = run;
  try {
    await run.execute();
  } catch (cause) {
    if (current === generation) error.value = String(cause);
  } finally {
    if (current === generation) {
      activeRun = undefined;
      approvalResolver = undefined;
      pending.value = undefined;
      busy.value = false;
      void refreshCollections();
    }
  }
}
function browse(offset: string | null = null) {
  scriptResults.value = [];
  return submit({ operation: "browse", collection: collection.value, offset, limit: 100 });
}
function approve() {
  const resolve = approvalResolver;
  approvalResolver = undefined;
  pending.value = undefined;
  resolve?.(true);
}
function editorKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    if (!busy.value && !pending.value && query.value.trim()) void execute();
  }
}

onMounted(async () => {
  const connectionId = props.connectionId;
  await refreshCollections();
  if (mounted && connectionId === props.connectionId && props.collection) void browse();
});
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col bg-background" :aria-label="t('chiron.workspace')">
    <header class="flex shrink-0 flex-wrap items-center gap-3 border-b bg-card px-3 py-2">
      <div class="mr-auto">
        <h2 class="text-sm font-semibold">ChironDB <span class="text-muted-foreground">/ ChironQL</span></h2>
      </div>
      <label class="flex items-center gap-2 text-xs">
        {{ t("chiron.collection") }}
        <select v-model="collection" class="h-8 max-w-56 rounded-md border bg-background px-2" :disabled="busy || !!pending">
          <option value="">{{ t("chiron.noCollection") }}</option>
          <option v-if="collection && !collections.includes(collection)" :value="collection">{{ collection }}</option>
          <option v-for="name in collections" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <Button variant="outline" size="sm" :disabled="busy || !!pending" :aria-label="t('chiron.refreshCollections')" @click="refreshCollections"><RefreshCcw class="h-3.5 w-3.5" /></Button>
      <Button variant="outline" size="sm" :disabled="busy || !collection || !!pending" @click="browse()">{{ t("chiron.browse") }}</Button>
    </header>
    <p class="border-b px-3 py-2 text-xs text-muted-foreground">{{ t("chiron.sessionHint") }}</p>
    <ErrorBanner v-if="metadataError" :message="metadataError" />
    <div class="flex min-h-36 shrink-0 flex-col border-b">
      <ChironQueryEditor ref="queryEditor" v-model="query" :read-only="busy || !!pending" :label="t('chiron.query')" @keydown.capture="editorKeydown" />
      <div class="flex items-center justify-between gap-3 bg-muted/30 px-3 py-2">
        <label class="flex items-center gap-2 text-xs"><input v-model="trace" type="checkbox" :disabled="busy || !!pending" />{{ t("chiron.trace") }}</label>
        <Button v-if="busy" variant="outline" size="sm" @click="stopRun"><Square class="mr-1 h-3 w-3" />Stop</Button>
        <Button size="sm" :disabled="busy || !query.trim() || !!pending" @click="execute"><Play class="mr-1.5 h-3.5 w-3.5" />{{ busy ? t("chiron.running") : t("chiron.run") }}</Button>
      </div>
    </div>
    <div v-if="scriptResults.length" class="max-h-48 shrink-0 overflow-auto border-b px-3 py-2 text-xs" aria-label="Statement results" aria-live="polite">
      <button v-for="(item, index) in scriptResults" :key="index" class="my-1 block w-full rounded border p-2 text-left hover:bg-muted" @click="selectResult(item)">
        <span class="font-semibold">{{ index + 1 }} · {{ item.status }} · {{ item.collection || "Explicit query target" }}</span>
        <code class="block max-h-16 overflow-auto whitespace-pre-wrap">{{ item.query }}</code>
        <span v-if="item.reply?.body.query_id">{{ item.reply.body.query_id }} · </span>
        <span v-if="item.reply?.body.stats?.affected != null">Affected: {{ item.reply.body.stats.affected }} · </span>
        <span v-if="item.reply?.body.rows">Rows: {{ item.reply.body.rows.length }}</span>
        <span v-if="item.message" class="block whitespace-pre-wrap">{{ item.message }}</span>
      </button>
    </div>
    <ErrorBanner v-if="error" :message="error" copy-mode="label" />
    <div v-if="reply" class="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-xs" aria-live="polite">
      <span>{{ result.rows.length }} {{ t("chiron.rows") }}</span>
      <span v-if="reply.body.stats?.affected != null">{{ t("chiron.affected") }}: {{ reply.body.stats.affected }}</span>
      <span v-if="reply.body.stats?.took_ms != null">{{ reply.body.stats.took_ms }} ms</span>
      <span v-if="reply.body.stats?.degraded === true" class="text-warning">{{ t("chiron.degraded") }}</span>
      <code v-if="reply.body.query_id" class="select-text">{{ reply.body.query_id }}</code>
      <Button v-if="nextOffset != null" variant="outline" size="sm" :disabled="busy || !!pending" @click="browse(nextOffset)">{{ t("chiron.nextPage") }}</Button>
    </div>
    <div class="min-h-32 flex-1">
      <DataGrid v-if="reply && reply.status >= 200 && reply.status < 300" :result="result" context="results" database-type="chirondb" :editable="false" :loading="busy" :show-execution-time="typeof reply.body.stats?.took_ms === 'number'" class="h-full" />
      <p v-else class="px-3 py-6 text-xs text-muted-foreground">{{ t("chiron.resultsHint") }}</p>
    </div>
    <details v-if="reply" class="shrink-0 border-t px-3 py-2 text-xs">
      <summary class="cursor-pointer">{{ t("chiron.diagnostics") }}</summary>
      <pre class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono">{{ diagnostics }}</pre>
    </details>
    <Dialog :open="!!pending" @update:open="!$event && stopRun()">
      <DialogContent>
        <DialogHeader
          ><DialogTitle>{{ t("chiron.confirmTitle") }}</DialogTitle
          ><DialogDescription>{{ t("chiron.confirmHint") }}</DialogDescription></DialogHeader
        >
        <pre class="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{{ pending?.message }}</pre>
        <pre class="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border bg-muted p-3 font-mono text-xs">{{ pending?.request.operation === "execute" ? pending.request.query : "" }}</pre>
        <DialogFooter
          ><Button variant="outline" @click="stopRun">{{ t("chiron.cancel") }}</Button
          ><Button variant="destructive" @click="approve">{{ t("chiron.confirm") }}</Button></DialogFooter
        >
      </DialogContent>
    </Dialog>
  </section>
</template>
