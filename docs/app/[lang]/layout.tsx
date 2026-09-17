import "../global.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { RouteProgress } from "@/components/RouteProgress";
import { buildMetadata, DEFAULT_DESCRIPTION, getHtmlLang, SITE_NAME, SITE_URL } from "@/lib/metadata";
import { buildSiteStructuredData } from "@/lib/structuredData";
import { i18n, resolveLang } from "@/lib/i18n";

const LOCALE_MAP: Record<string, { locale: string; title: string; description: string }> = {
  en: {
    locale: "en_US",
    title: "Chiron Horizon desktop database workbench",
    description: DEFAULT_DESCRIPTION,
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const l = resolveLang(lang);
  const meta = LOCALE_MAP[l];

  const pageMetadata = buildMetadata({
    title: meta.title,
    description: meta.description,
    path: `/${l}`,
    lang: l,
  });

  return {
    ...pageMetadata,
    title: {
      default: meta.title,
      template: `%s | ${SITE_NAME}`,
    },
    metadataBase: new URL(SITE_URL),
    icons: {
      icon: "/favicon-64.png",
      shortcut: "/favicon-64.png",
      apple: "/logo.png",
    },
    robots: { index: true, follow: true },
    openGraph: { ...pageMetadata.openGraph, locale: meta.locale },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#08080a",
  colorScheme: "dark light",
};

export default async function LangLayout({ params, children }: { params: Promise<{ lang: string }>; children: ReactNode }) {
  const { lang } = await params;
  const locale = resolveLang(lang);
  const siteStructuredData = buildSiteStructuredData();

  return (
    <html lang={getHtmlLang(locale)} suppressHydrationWarning>
      <head>
        {siteStructuredData.map((structuredData) => (
          <script key={structuredData["@id"]} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        ))}
      </head>
      <body className="flex min-h-screen flex-col">
        <RouteProgress />
        {children}
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}
