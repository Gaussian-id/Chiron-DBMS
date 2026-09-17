import { EditorState, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { toggleLineComment } from "@codemirror/commands";

export const chironCommentExtension = [EditorState.languageData.of(() => [{ commentTokens: { line: "--" } }]), Prec.highest(keymap.of([{ key: "Mod-/", preventDefault: true, run: (view) => !view.state.readOnly && toggleLineComment(view) }]))];
