// @vitest-environment happy-dom
import { it, expect } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { history, undo, toggleLineComment } from "@codemirror/commands";
import { chironCommentExtension } from "./comments";
it("toggles selected ChironQL lines with -- and preserves undo", () => {
  const view = new EditorView({ state: EditorState.create({ doc: "COUNT a;\nCOUNT b;", selection: EditorSelection.range(0, 17), extensions: [chironCommentExtension, history()] }) });
  try {
    expect(toggleLineComment(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("-- COUNT a;\n-- COUNT b;");
    undo(view);
    expect(view.state.doc.toString()).toBe("COUNT a;\nCOUNT b;");
    toggleLineComment(view);
    toggleLineComment(view);
    expect(view.state.doc.toString()).toBe("COUNT a;\nCOUNT b;");
  } finally {
    view.destroy();
  }
});
it("does not modify a read-only document", () => {
  const view = new EditorView({ state: EditorState.create({ doc: "COUNT a;", extensions: [chironCommentExtension, EditorState.readOnly.of(true)] }) });
  try {
    toggleLineComment(view);
    expect(view.state.doc.toString()).toBe("COUNT a;");
  } finally {
    view.destroy();
  }
});
