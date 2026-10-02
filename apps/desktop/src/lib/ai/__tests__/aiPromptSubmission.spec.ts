import { describe, expect, it } from "vitest";
import aiAssistantSource from "@/components/editor/AiAssistant.vue?raw";
import { canSubmitAiPrompt } from "@/lib/ai/aiPromptKeyboard";

function submissionState(overrides: Partial<Parameters<typeof canSubmitAiPrompt>[0]> = {}) {
  return {
    prompt: "",
    contextItemCount: 0,
    isAttachmentProcessing: false,
    hasTab: true,
    hasConnection: true,
    ...overrides,
  };
}

describe("AI prompt submission eligibility", () => {
  it("allows text and attachment submissions without requiring a tab-local database", () => {
    expect(canSubmitAiPrompt(submissionState({ prompt: "show current users" }))).toBe(true);
    expect(canSubmitAiPrompt(submissionState({ contextItemCount: 1 }))).toBe(true);
  });

  it("rejects empty, processing, and missing-context submissions", () => {
    expect(canSubmitAiPrompt(submissionState())).toBe(false);
    expect(canSubmitAiPrompt(submissionState({ prompt: "ask", isAttachmentProcessing: true }))).toBe(false);
    expect(canSubmitAiPrompt(submissionState({ prompt: "ask", hasTab: false }))).toBe(false);
    expect(canSubmitAiPrompt(submissionState({ prompt: "ask", hasConnection: false }))).toBe(false);
  });

  it("wires the click button to the shared eligibility rule", () => {
    expect(aiAssistantSource).toMatch(/const canSubmitPrompt = computed\(\s*\(\) =>/);
    expect(aiAssistantSource).toContain("!chironBusy.value");
    expect(aiAssistantSource).toContain(':disabled="!canSubmitPrompt"');
    expect(aiAssistantSource).not.toMatch(/:disabled=.*props\.tab\?\.database/);
  });
});
