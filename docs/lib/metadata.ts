import type { Metadata } from "next";

export const SITE_URL = "https://github.com/Gaussian-id/Chiron-DBMS";
export const SITE_NAME = "Chiron Horizon";
export const DEFAULT_DESCRIPTION = "Chiron Horizon desktop database workbench with AI and MCP support.";
export const DEFAULT_OG_IMAGE = "/logo.png";

const LOCALE_MAP: Record<string, string> = {
  en: "en_US",
};

const HTML_LANG_MAP: Record<string, string> = {
  en: "en",
};

export function getHtmlLang(lang: string): string {
  return HTML_LANG_MAP[lang] ?? "en";
}

function swapLang(path: string, to: string): string {
  return path.replace(/^\/(en|cn)(?=\/|$)/, `/${to}`);
}

interface BuildMetadataParams {
  title: string;
  description: string;
  path: string;
  lang: string;
  ogType?: "website" | "article";
  images?: string[];
  lastModified?: Date;
  markdownPath?: string;
}

export function buildMetadata({ title, description, path, lang, ogType = "website", images, lastModified, markdownPath }: BuildMetadataParams): Metadata {
  const normalizedPath = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const canonical = `${SITE_URL}${normalizedPath}`;
  const locale = LOCALE_MAP[lang] ?? "en_US";
  const defaultImage = { url: DEFAULT_OG_IMAGE, width: 1792, height: 896 };
  const ogImages = images?.map((url) => (url === DEFAULT_OG_IMAGE ? defaultImage : { url })) ?? [defaultImage];

  const base: Metadata = {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `${SITE_URL}${swapLang(normalizedPath, "en")}`,
        "x-default": `${SITE_URL}${swapLang(normalizedPath, "en")}`,
      },
      ...(markdownPath ? { types: { "text/markdown": `${SITE_URL}${markdownPath}` } } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
      type: ogType,
      locale,
      alternateLocale: Object.values(LOCALE_MAP).filter((alternate) => alternate !== locale),
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images ?? [DEFAULT_OG_IMAGE],
    },
    other: {
      "og:image:alt": title,
    },
  };

  if (lastModified) {
    base.other = { ...base.other, "article:modified_time": lastModified.toISOString() };
  }

  return base;
}
