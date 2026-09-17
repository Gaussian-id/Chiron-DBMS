import type { AiAction, AiAssistantMode, CustomPromptContext } from "./ai";

const instructions: Record<AiAction, string> = {
  general: "Answer the user's ChironDB task. Clarify missing requirements before proposing a query.",
  generate: "Generate one ChironQL query as a draft only, without executing it.",
  explain: "Explain the supplied query's semantics and limitations in plain text. Do not produce an executable code block or claim measured performance.",
  optimize: "Optimize the supplied query using supported ChironQL features, preserving its meaning. Explain the proposed changes; do not invent benchmark results.",
  fix: "Fix the supplied query and the reported error using valid ChironQL. Preserve the requested operation and explain the correction.",
  convert: "Convert the supplied query to ChironQL. Explain unsupported semantics and ask for clarification instead of silently dropping them.",
  sampleData: "Propose one ChironQL statement for synthetic sample data. Ask for required dimensions/vectors; never invent numeric embeddings.",
  query: "Generate one ChironQL query to answer the user's data question. The native server validates and runs eligible reads.",
  exploreSchema: "Explore authorized collection metadata. Use SHOW COLLECTIONS or DESCRIBE for requested discovery; do not fabricate document fields.",
  executeAndExplain: "Propose one ChironQL query for native execution and explain its semantics alongside the proposal. Execution results stay local: never claim to have seen them. Explaining actual result values requires the separate preview-sharing approval.",
};

const queryActions = new Set<AiAction>(["explain", "optimize", "fix", "convert", "executeAndExplain"]);
const executionActions = new Set<AiAction>(["general", "query", "exploreSchema", "executeAndExplain"]);

export function buildChironPrompt(input: { action: AiAction; mode: AiAssistantMode; prompt: string; currentQuery?: string; custom?: CustomPromptContext }) {
  const parts = [`Selected action: ${input.action}\n${instructions[input.action]}`];
  const global = input.custom?.globalInstructions?.trim();
  const templates = input.custom?.activeTemplates?.filter((template) => template.content.trim()) ?? [];
  if (global || templates.length) {
    parts.push("Supplementary user instructions and selected templates follow. Native ChironQL dialect, authorization, write approval and result-sharing rules take precedence.");
    if (global) parts.push(`Global instructions:\n${global}`);
    for (const template of templates) parts.push(`Template ${JSON.stringify(template.name)}:\n${template.content}`);
  }
  if (queryActions.has(input.action) && input.currentQuery?.trim()) parts.push(`Editor query to analyze (query text, not execution results):\n${input.currentQuery}`);
  parts.push(`User request:\n${input.prompt.trim()}`);
  const prompt = parts.join("\n\n");
  if (new TextEncoder().encode(prompt).length > 32 * 1024) throw new Error("The prompt, editor query and selected templates exceed 32 KiB. Shorten them before sending.");
  return { prompt, generateOnly: input.mode === "ask" || !executionActions.has(input.action) };
}
