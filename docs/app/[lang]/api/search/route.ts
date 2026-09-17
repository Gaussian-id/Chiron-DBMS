import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";
import { i18n } from "@/lib/i18n";

export const revalidate = false;
export const { staticGET: GET } = createFromSource(source);

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}
