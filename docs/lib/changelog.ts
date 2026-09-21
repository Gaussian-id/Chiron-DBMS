import bundled from "../../crates/chiron-horizon-core/assets/changelog.json";
import { requestJson } from "./httpJson";
import type { DocsLang } from "@/lib/i18n";

export type ChangelogItem = {
  title: string;
  desc: string;
};

export type ChangelogSection = {
  type: string;
  title: string;
  items: ChangelogItem[];
};

export type ChangelogRelease = {
  tag: string;
  name: string;
  date: string;
  unreleased?: boolean;
  markdown?: string;
  sections: ChangelogSection[];
};

export type ChangelogData = {
  updatedAt: string;
  releases: ChangelogRelease[];
};

export type ChangelogIndexEntry = {
  tag: string;
  name: string;
  date: string;
  unreleased?: boolean;
};

export type ChangelogIndex = {
  updatedAt: string;
  releases: ChangelogIndexEntry[];
};

export type ChangelogBootstrap = {
  index: ChangelogIndexEntry[];
  initialRelease: ChangelogRelease | null;
  // index-cn.json 与 releases-cn/ 尚未发布到 R2 时，退回全量 releases JSON，
  // 并把全量数据交给客户端按需取用，避免逐版本请求 404。
  fallbackReleases: ChangelogRelease[] | null;
};

const CHANGELOG_URL = "https://raw.githubusercontent.com/Gaussian-id/Chiron-Horizon/main/crates/chiron-horizon-core/assets/changelog.json";
export type ChangelogLang = "en" | "cn";
export function changelogDataLang(lang: DocsLang): ChangelogLang { return lang === "cn" ? "cn" : "en"; }
export function changelogUrl(_lang: ChangelogLang) { return CHANGELOG_URL; }
export function changelogIndexUrl(lang: ChangelogLang) { return changelogUrl(lang); }
export function changelogReleaseUrl(lang: ChangelogLang, _tag: string) { return changelogUrl(lang); }
export async function fetchChangelog(lang: ChangelogLang): Promise<ChangelogData> {
  try {
    const remote=await requestJson<ChangelogData>(changelogUrl(lang),{cache:"force-cache"});
    if (Array.isArray(remote.releases) && remote.releases.some(r=>r.tag==="v0.1.0")) return remote;
  } catch { /* Offline builds retain the bundled Chiron Horizon changelog. */ }
  return bundled;
}
export async function fetchChangelogIndex(lang: ChangelogLang): Promise<ChangelogIndex> { return fetchChangelog(lang); }
export async function fetchChangelogRelease(lang: ChangelogLang, tag: string): Promise<ChangelogRelease> {
  const release=(await fetchChangelog(lang)).releases.find(r=>r.tag===tag);
  if (!release) throw new Error("Unknown Chiron Horizon version");
  return release;
}
export async function loadChangelogBootstrap(lang: ChangelogLang): Promise<ChangelogBootstrap> {
  const full=await fetchChangelog(lang);
  return {index:full.releases,initialRelease:full.releases[0]??null,fallbackReleases:full.releases};
}
