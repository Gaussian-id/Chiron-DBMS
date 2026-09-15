import { defineI18n } from "fumadocs-core/i18n";
import { defineI18nUI } from "fumadocs-ui/i18n";

export const i18n = defineI18n({
  defaultLanguage: "en",
  languages: ["en"],
});

export const i18nUI = defineI18nUI(i18n, {
  en: { displayName: "English" },
});

export type DocsLang = "en";

/**
 * Narrow an arbitrary route segment to a supported docs language.
 *
 * The public documentation currently ships in English. Adding a language only
 * requires extending `i18n.languages` above.
 */
export function resolveLang(lang: string): DocsLang {
  return (i18n.languages as readonly string[]).includes(lang) ? (lang as DocsLang) : "en";
}
