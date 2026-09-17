export type ChironAssistantRequest =
  | { action: "generate"; config_id: string; model: string; prompt: string; collection: string; generate_only: boolean; text_attachments?: { name: string; content: string; truncated: boolean }[]; images?: { mediaType: string; data: string }[]; request_id?: string; conversation_id?: string }
  | { action: "status"; request_id: string }
  | { action: "approve"; run_id: string; approval_token: string }
  | { action: "cancel"; run_id: string }
  | { action: "explain"; run_id: string; approved_preview: string };
export type ChironDbRequest =
  | { operation: "browse"; collection: string; offset: string | null; limit: number }
  | { operation: "execute"; query: string; collection: string | null; trace: boolean; confirm: boolean; allow_destructive: boolean }
  | { operation: "parse"; query: string }
  | { operation: "metadata"; collection: string }
  | { operation: "assistant"; request: ChironAssistantRequest };

export interface ChironAssistantReply {
  phase?: string;
  run_id?: string;
  query?: string;
  collection?: string | null;
  approval_token?: string | null;
  message?: string;
  result?: ChironDbReply | null;
  sharing_preview?: string | null;
  explanation?: string | null;
}

export interface ChironTranscript {
  value: ChironAssistantReply;
  connectionId: string;
  connectionName: string;
  collection: string;
  model: string;
  epoch: number;
}

export interface ChironDbReply {
  status: number;
  body: Omit<ChironAssistantReply, "collection"> & {
    kind?: "rows" | "affected" | "empty" | "read" | "write" | "admin";
    ok?: boolean;
    statement?: string;
    collection?: string | null;
    columns?: string[];
    rows?: Record<string, unknown>[];
    points?: Record<string, unknown>[];
    next?: string | null;
    next_offset?: string | null;
    query_id?: string;
    stats?: Record<string, unknown>;
    trace?: unknown;
    code?: string;
    error?: string;
    hint?: string;
    position?: number;
    affected_estimate?: number;
  };
}
