import { Lexer, type Token, type Tokens } from "marked";

/** Presentation only. Never apply this to queries, result values, or approval snapshots. */
export function chironResponseText(text = ""): string {
  function render(tokens: Token[] = []): string {
    return tokens
      .map((token): string => {
        switch (token.type) {
          case "space":
            return "\n";
          case "br":
            return "\n";
          case "hr":
            return "\n";
          case "code":
          case "codespan":
            return token.text;
          case "list":
            return token.items.map((item: Tokens.ListItem) => render(item.tokens).trim()).join("\n") + "\n\n";
          case "table":
            return [token.header, ...token.rows].map((row: Tokens.TableCell[]) => row.map((cell) => render(cell.tokens)).join(" · ")).join("\n") + "\n\n";
          case "heading":
          case "paragraph":
          case "blockquote":
            return render(token.tokens) + "\n\n";
          default:
            if ("tokens" in token && token.tokens) return render(token.tokens);
            return "text" in token ? token.text : token.raw;
        }
      })
      .join("");
  }
  return render(Lexer.lex(text))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
