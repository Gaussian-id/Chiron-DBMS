import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../AiAssistant.vue", import.meta.url), "utf8");
const nativeSend = source.slice(source.indexOf("async function sendChiron()"), source.indexOf("async function chironAction"));

describe("native Chiron chat lifecycle wiring", () => {
  it("persists the user turn before calling the provider and the reply in finally", () => {
    expect(nativeSend.indexOf("persistConversationSnapshot")).toBeLessThan(nativeSend.indexOf('action: "generate"'));
    expect(nativeSend.slice(nativeSend.indexOf("} finally {"))).toContain("await persistConversationSnapshot");
    expect(nativeSend.slice(nativeSend.indexOf("} finally {"))).toContain("finishChiron()");
    expect(nativeSend).toContain("conversation_id: chatId");
  });
  it("blocks duplicate sends and exposes real phase plus elapsed time", () => {
    expect(nativeSend).toContain("if (chironBusy.value || !prompt.value.trim()) return;");
    expect(source).toContain('aria-label="ChironQL request in progress"');
    expect(source).toContain("{{ chironPhase }}");
    expect(source).toContain("{{ chironElapsed }}s");
    expect(source).toContain('action: "status"');
    expect(source).toContain("activityId === chironActivityId");
    const progress = source.indexOf("data-chiron-response-progress");
    expect(progress).toBeGreaterThan(source.indexOf('<ScrollArea ref="scrollRef"'));
    expect(progress).toBeLessThan(source.indexOf("</ScrollArea>", progress));
    expect(source.slice(source.indexOf('<div ref="promptPanelRef"'))).not.toContain("{{ chironPhase }}");
  });
  it("keeps cached history and reports load errors rather than replacing it with an empty list", () => {
    expect(source).not.toContain("loadAiConversations().catch(() => [])");
    const refresh = source.slice(source.indexOf("async function refreshConversationHistory()"), source.indexOf("function chatMessagesFromConversation"));
    expect(refresh).toContain("Could not load chat history");
    expect(refresh.slice(refresh.indexOf("catch"))).not.toContain("conversations.value =");
  });
  it("retains native results locally without restoring approval authority", () => {
    expect(source).toContain("epoch: -1");
    expect(source).toContain("approval_token: null");
    expect(source).toContain("run_id: undefined");
    expect(source).toContain("chiron: m.chiron");
  });
  it("offers a composer switch, concise context and saved-chat rename/delete", () => {
    expect(source).toContain('<Switch v-model="chironGenerateOnly"');
    expect(source).toContain("ChironQL · {{ connection.name }}</p>");
    expect(source).toContain("More options for ${conv.title}");
    expect(source).toContain("Rename chat</DropdownMenuItem>");
    expect(source).toContain("Delete chat</DropdownMenuItem>");
  });
});
